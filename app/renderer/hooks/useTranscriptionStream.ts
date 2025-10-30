import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { WhisperClient } from '../lib/whisperClient';
import { Diarizer } from '../lib/diarize';
import { generateId, formatTime } from '../lib/utils';
import type { TranscriptSegment } from '../lib/types';

export function useTranscriptionStream() {
  const { segments, addSegment, settings, setProcessing, setAudioLevel } = useStore();
  const whisperClientRef = useRef<WhisperClient | null>(null);
  const diarizerRef = useRef<Diarizer>(new Diarizer(16000)); // 16kHz sample rate
  const mediaRecorderRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastChunkEndTimeRef = useRef<number>(0);
  const isRecordingRef = useRef<boolean>(false);

  useEffect(() => {
    if (settings.apiKey) {
      whisperClientRef.current = new WhisperClient({
        apiKey: settings.apiKey,
        language: settings.language === 'auto' ? undefined : settings.language,
      });
    }
  }, [settings.apiKey, settings.language]);

  const startTranscription = async (deviceId?: string) => {
    // Check if API key is set
    if (!settings.apiKey) {
      throw new Error('OpenAI API key not set. Please add your API key in Settings.');
    }

    // Reset diarizer for new session
    diarizerRef.current.reset();
    console.log('🔄 Diarizer reset - starting with Speaker A');

    // Check if WhisperClient is initialized
    if (!whisperClientRef.current) {
      whisperClientRef.current = new WhisperClient({
        apiKey: settings.apiKey,
        language: settings.language === 'auto' ? undefined : settings.language,
      });
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? {
              deviceId: { exact: deviceId },
            }
          : true,
      };

      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Microphone access granted');
      streamRef.current = stream;

      // Use Web Audio API to record raw PCM audio instead of MediaRecorder
      // This avoids fragment issues and produces clean WAV files
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // 16kHz is sufficient for speech
      });
      
      const source = audioContext.createMediaStreamSource(stream);
      
      // Use ScriptProcessorNode (deprecated but widely supported) to capture raw audio
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      // Store raw PCM audio data
      const audioDataArray: Float32Array[] = [];
      
      // Use a ref for isProcessingChunk so it's accessible across closures
      const isProcessingChunkRef = { current: false };
      isRecordingRef.current = true;
      startTimeRef.current = Date.now();
      lastChunkEndTimeRef.current = 0;
      
      processor.onaudioprocess = (event) => {
        // Always collect audio when recording - don't block during processing
        if (!isRecordingRef.current) {
          return;
        }
        
        // Get the input audio data
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Calculate audio level for meter visualization
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const avgLevel = sum / inputData.length;
        setAudioLevel(avgLevel);
        
        // Copy the audio data (Float32Array)
        const copiedData = new Float32Array(inputData.length);
        copiedData.set(inputData);
        
        // Store for later processing (always collect, even during processing)
        audioDataArray.push(copiedData);
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // Store references for cleanup
      (audioContext as any).source = source;
      (audioContext as any).processor = processor;
      (audioContext as any).audioDataArray = audioDataArray; // Store audioData reference
      mediaRecorderRef.current = audioContext as any; // Store audioContext for cleanup
      
      console.log('Web Audio API recording started');
      
      // Helper to convert PCM audio data to WAV blob
      const pcmToWav = (audioData: Float32Array[], sampleRate: number): Blob => {
        // Calculate total length
        const totalLength = audioData.reduce((sum, chunk) => sum + chunk.length, 0);
        const arrayBuffer = new ArrayBuffer(44 + totalLength * 2); // 44 bytes WAV header + 16-bit PCM data
        const view = new DataView(arrayBuffer);
        
        // WAV header
        const writeString = (offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + totalLength * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // Byte rate
        view.setUint16(32, 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample
        writeString(36, 'data');
        view.setUint32(40, totalLength * 2, true);
        
        // Convert float samples to 16-bit PCM
        let offset = 44;
        for (const chunk of audioData) {
          for (let i = 0; i < chunk.length; i++) {
            const sample = Math.max(-1, Math.min(1, chunk[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
          }
        }
        
        return new Blob([arrayBuffer], { type: 'audio/wav' });
      };
      
      // Helper to detect if audio contains actual speech (voice activity detection)
      const hasSpeech = (audioData: Float32Array[]): boolean => {
        if (audioData.length === 0) return false;
        
        // Calculate RMS (Root Mean Square) energy across all audio buffers
        let totalEnergy = 0;
        let totalSamples = 0;
        
        for (const chunk of audioData) {
          for (let i = 0; i < chunk.length; i++) {
            totalEnergy += chunk[i] * chunk[i];
            totalSamples++;
          }
        }
        
        if (totalSamples === 0) return false;
        
        const rms = Math.sqrt(totalEnergy / totalSamples);
        const energyThreshold = 0.01; // Minimum energy level to consider as speech
        
        const hasVoice = rms > energyThreshold;
        
        return hasVoice;
      };
      
      const processChunks = async () => {
        if (audioDataArray.length === 0 || !isRecordingRef.current) {
          return;
        }

        // Don't block if already processing - just skip this interval
        if (isProcessingChunkRef.current) {
          console.log('Skipping chunk processing - previous chunk still processing');
          return;
        }
        
        // Copy audio data for processing (snapshot at this moment)
        // Note: audio continues to be collected in audioDataArray while we process
        const audioDataToProcess = [...audioDataArray];
        
        // Check if there's actual speech before processing
        if (!hasSpeech(audioDataToProcess)) {
          console.log('⏭️ Skipping silence - no speech detected in chunk');
          // Clear the silent audio data so we don't accumulate it
          audioDataArray.length = 0;
          return;
        }
        
        isProcessingChunkRef.current = true;
        
        // Clear the array now that we've confirmed there's speech
        audioDataArray.length = 0;
        
        // Calculate timing
        const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
        const chunkStartTime = lastChunkEndTimeRef.current > 0 
          ? lastChunkEndTimeRef.current 
          : Math.max(0, elapsedSeconds - settings.chunkSize);
        
        // Process asynchronously so we can return quickly and continue collecting audio
        (async () => {
          try {
            // Convert PCM to WAV
            const wavBlob = pcmToWav(audioDataToProcess, audioContext.sampleRate);
            console.log(`Processing chunk: ${wavBlob.size} bytes WAV from ${audioDataToProcess.length} PCM buffers`);
            
            // Combine audio data arrays into single Float32Array for voice analysis
            const totalLength = audioDataToProcess.reduce((sum, arr) => sum + arr.length, 0);
            const combinedAudioData = new Float32Array(totalLength);
            let offset = 0;
            for (const arr of audioDataToProcess) {
              combinedAudioData.set(arr, offset);
              offset += arr.length;
            }
            
            // Transcribe as WAV (which always works)
            await transcribeChunkFromBlobs([wavBlob], chunkStartTime, combinedAudioData);
          } catch (error) {
            console.error('Error processing chunk:', error);
          } finally {
            isProcessingChunkRef.current = false;
          }
        })();
      };

      // Process chunks at intervals - faster intervals for lower latency
      const initialChunkSize = 1.5; // 1.5 seconds for first chunk (faster response)
      let chunkCount = 0;
      
      chunkIntervalRef.current = window.setInterval(async () => {
        if (isRecordingRef.current) {
          chunkCount++;
          console.log(`Processing chunk ${chunkCount}...`);
          await processChunks();
          
          // After first chunk, switch to normal interval
          if (chunkCount === 1) {
            clearInterval(chunkIntervalRef.current!);
            chunkIntervalRef.current = window.setInterval(async () => {
              if (isRecordingRef.current) {
                await processChunks();
              }
            }, Math.min(settings.chunkSize, 3) * 1000); // Cap at 3 seconds for faster response
          }
        }
      }, initialChunkSize * 1000);
      
      console.log('Transcription started successfully');
    } catch (error: any) {
      console.error('Error starting transcription:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission denied. Please allow microphone access in your browser/system settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      } else {
        throw new Error(`Failed to start recording: ${error.message || error}`);
      }
    }
  };

  const transcribeChunkFromBlobs = async (chunks: Blob[], chunkStartTime: number, audioData?: Float32Array) => {
    if (!whisperClientRef.current) {
      console.warn('WhisperClient not initialized, cannot transcribe');
      return;
    }

    if (chunks.length === 0) {
      console.log('No audio chunks to transcribe');
      return;
    }

    try {
      const totalSize = chunks.reduce((acc, c) => acc + c.size, 0);
      console.log(`Transcribing ${chunks.length} audio chunks (${totalSize} bytes)...`);
      
      // Validate chunks
      if (chunks.length === 0 || totalSize === 0) {
        console.warn('No valid audio chunks to transcribe');
        return;
      }
      
      // Check if chunks are valid (not empty)
      const validChunks = chunks.filter(c => c && c.size > 0);
      if (validChunks.length === 0) {
        console.warn('All audio chunks are empty');
        return;
      }
      
      setProcessing(true);
      // For complete chunks (from stop/restart), use the chunk's original type
      // For combined chunks, default to webm
      const blobType = chunks.length === 1 && chunks[0].type 
        ? chunks[0].type 
        : 'audio/webm';
      const blob = validChunks.length === 1 
        ? validChunks[0] // Use single chunk as-is (complete file)
        : new Blob(validChunks, { type: blobType });
      console.log(`Created blob: ${blob.size} bytes, type: ${blob.type}, from ${validChunks.length} chunks`);
      
      // Additional validation: check if blob looks valid
      if (blob.size < 500) {
        console.warn(`Blob size very small (${blob.size} bytes), might be incomplete`);
      }

      const transcriptionStart = Date.now();
      const result = await whisperClientRef.current.transcribe(blob);
      const transcriptionEnd = Date.now();
      
      setProcessing(false);
      
      // Calculate chunk duration based on actual elapsed time
      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
      const chunkEndTime = elapsedSeconds; // Use actual elapsed time for accurate timestamps
      
      // If chunkStartTime is invalid or zero, calculate it from chunkEndTime
      const validChunkStartTime = (chunkStartTime > 0 && isFinite(chunkStartTime)) 
        ? chunkStartTime 
        : Math.max(0, chunkEndTime - settings.chunkSize);
      
      // Update last chunk end time for next chunk
      lastChunkEndTimeRef.current = chunkEndTime;

      // Filter out false positives and suspicious transcriptions
      const trimmedText = result.text.trim();
      
      // Skip empty or very short transcriptions
      if (!trimmedText || trimmedText.length < 2) {
        console.log(`⚠️ Skipping suspicious transcription: "${trimmedText}"`);
        return;
      }
      
      // Skip common false positive phrases - these are often generated from background noise
      // Always reject these common phrases unless they're part of longer speech
      const lowerText = trimmedText.toLowerCase().trim();
      const commonFalsePositives = [
        '.', 
        'bye', 'bye.', 'bye bye', 'bye bye.', 'bye-bye', 'bye-bye.',
        'thank you', 'thank you.', 'thanks', 'thanks.', 'thank', 'thank.',
        'hi', 'hi.', 'hello', 'hello.', 'hey', 'hey.',
        'okay', 'ok', 'ok.', 'okay.',
        'yes', 'yes.', 'no', 'no.',
        'uh', 'uh.', 'um', 'um.', 'ah', 'ah.',
        'hmm', 'hmm.', 'hmm hmm',
        'see you', 'see you later', 'goodbye', 'good bye'
      ];
      
      // Check if text is exactly a false positive (not just containing it)
      const isExactFalsePositive = commonFalsePositives.includes(lowerText) || 
                                   commonFalsePositives.some(fp => lowerText === fp.trim());
      
      // Also check if it's a very short phrase that looks like a false positive
      const isShortFalsePositive = trimmedText.length <= 20 && 
                                   (lowerText.includes('bye') || 
                                    lowerText.includes('thank') ||
                                    lowerText.includes('goodbye'));
      
      if (isExactFalsePositive || isShortFalsePositive) {
        // Always reject these, regardless of segment count
        console.log(`⚠️ Skipping likely false positive: "${trimmedText}"`);
        return;
      }
      
      // Skip transcriptions that are just punctuation
      if (/^[^\w\s]+$/.test(trimmedText)) {
        console.log(`⚠️ Skipping punctuation-only transcription: "${trimmedText}"`);
        return;
      }
      
      if (trimmedText) {
        const previousSegment = segments.length > 0 ? segments[segments.length - 1] : undefined;
        const speaker = diarizerRef.current.assignSpeaker(
          trimmedText,
          chunkStartTime,
          chunkEndTime,
          previousSegment,
          audioData // Pass audio data for voice-based speaker recognition
        );

        const segment: TranscriptSegment = {
          id: generateId(),
          start: formatTime(validChunkStartTime),
          end: formatTime(chunkEndTime),
          speaker,
          text: trimmedText,
          interim: false,
        };

        console.log(`✓ Transcript added: "${result.text.substring(0, 50)}..." (${((transcriptionEnd - transcriptionStart) / 1000).toFixed(2)}s)`);
        addSegment(segment);
      }
    } catch (error) {
      console.error('Error transcribing chunk:', error);
      setProcessing(false);
    }
  };

  const stopTranscription = async () => {
    isRecordingRef.current = false;
    
    // Stop the interval first
    if (chunkIntervalRef.current !== null) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }

    // Process any remaining audio data (Web Audio API approach)
    const audioContext = mediaRecorderRef.current as any;
    if (audioContext && audioContext.audioDataArray && audioContext.audioDataArray.length > 0) {
      // Convert remaining PCM to WAV
      const wavBlob = convertPCMToWAV(audioContext.audioDataArray, audioContext.sampleRate);
      const finalChunkStartTime = lastChunkEndTimeRef.current || ((Date.now() - startTimeRef.current) / 1000);
      
      // Combine remaining audio data for voice analysis
      const totalLength = audioContext.audioDataArray.reduce((sum: number, arr: Float32Array) => sum + arr.length, 0);
      const combinedAudioData = new Float32Array(totalLength);
      let offset = 0;
      for (const arr of audioContext.audioDataArray) {
        combinedAudioData.set(arr, offset);
        offset += arr.length;
      }
      
      await transcribeChunkFromBlobs([wavBlob], finalChunkStartTime, combinedAudioData);
    }

    // Clean up Web Audio API nodes
    if (mediaRecorderRef.current) {
      const audioContext = mediaRecorderRef.current as any;
      if (audioContext.processor) {
        audioContext.processor.disconnect();
      }
      if (audioContext.source) {
        audioContext.source.disconnect();
      }
      if (audioContext.close) {
        await audioContext.close();
      }
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Reset audio level when stopping
    setAudioLevel(0);
  };
  
  // Helper function for PCM to WAV conversion (needed in stopTranscription)
  const convertPCMToWAV = (audioData: Float32Array[], sampleRate: number): Blob => {
    const totalLength = audioData.reduce((sum, chunk) => sum + chunk.length, 0);
    const arrayBuffer = new ArrayBuffer(44 + totalLength * 2);
    const view = new DataView(arrayBuffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + totalLength * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, totalLength * 2, true);
    
    let offset = 44;
    for (const chunk of audioData) {
      for (let i = 0; i < chunk.length; i++) {
        const sample = Math.max(-1, Math.min(1, chunk[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  return {
    startTranscription,
    stopTranscription,
  };
}

