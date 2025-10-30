import OpenAI from 'openai';

export interface WhisperConfig {
  apiKey: string;
  language?: string;
}

export class WhisperClient {
  private client: OpenAI;
  private language?: string;

  constructor(config: WhisperConfig) {
    // Allow browser mode in Electron renderer (sandboxed, API key comes from main process)
    this.client = new OpenAI({ 
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true
    });

    this.language = config.language === 'auto' ? undefined : (config.language || 'en');
  }

  async transcribe(audioBlob: Blob): Promise<{ text: string; segments?: any[] }> {
    try {
      const languageToUse = this.language || 'en';
      
      // If blob is already WAV (from Web Audio API), use directly
      // Otherwise, try to convert from WebM (for backward compatibility)
      let wavBlob: Blob;
      if (audioBlob.type === 'audio/wav' || audioBlob.type === 'audio/wave') {
        wavBlob = audioBlob;
        console.log(`✅ Using WAV directly: ${wavBlob.size}b`);
      } else {
        try {
          wavBlob = await this.convertWebmToWav(audioBlob);
          console.log(`✅ Converted to WAV: ${audioBlob.size}b → ${wavBlob.size}b`);
        } catch (conversionError) {
          console.warn('WAV conversion failed, trying direct upload:', conversionError);
          
          // Fallback: Send original format directly
          const blobType = audioBlob.type || 'audio/webm';
          const ext = blobType.includes('webm') ? 'webm' : 'wav';
          const file = new File([audioBlob], `audio.${ext}`, { type: blobType });
          
          console.log(`🌐 Transcribing (direct): language=${languageToUse || 'auto'}, format=${ext}, size=${audioBlob.size}b`);
          
          if (audioBlob.size < 500) {
            throw new Error(`Audio blob too small: ${audioBlob.size} bytes`);
          }
          
          try {
            const transcription = await this.client.audio.transcriptions.create({
              file: file as any,
              model: 'whisper-1',
              language: languageToUse as any,
              response_format: 'verbose_json',
            });
            
            return {
              text: transcription.text,
              segments: (transcription as any).segments || [],
            };
          } catch (apiError: any) {
            throw new Error(`Transcription failed: ${apiError.message || 'Invalid audio format'}. Please try recording again.`);
          }
        }
      }
      
      // Use WAV format
      const file = new File([wavBlob], 'audio.wav', { type: 'audio/wav' });
      console.log(`🌐 Transcribing (WAV): language=${languageToUse || 'auto'}, size=${wavBlob.size}b`);
      
      if (wavBlob.size < 500) {
        throw new Error(`WAV blob too small: ${wavBlob.size} bytes`);
      }
      
      // Skip very small audio files that are likely noise (< 0.8 seconds of audio at 16kHz)
      // WAV header is 44 bytes, so we subtract that for more accurate calculation
      const audioDataSize = wavBlob.size - 44; // Subtract WAV header
      const estimatedSeconds = audioDataSize / (16000 * 2); // 16-bit samples at 16kHz
      if (estimatedSeconds < 0.8 || wavBlob.size < 1000) {
        console.log(`⚠️ Skipping very short audio chunk: ${estimatedSeconds.toFixed(2)}s (${wavBlob.size} bytes)`);
        return { text: '', segments: [] };
      }
      
      const transcription = await this.client.audio.transcriptions.create({
        file: file as any,
        model: 'whisper-1',
        language: languageToUse as any,
        response_format: 'verbose_json',
      });

      return {
        text: transcription.text,
        segments: (transcription as any).segments || [],
      };
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw error;
    }
  }

  async transcribeBuffer(audioBuffer: AudioBuffer): Promise<{ text: string; segments?: any[] }> {
    // Convert AudioBuffer to WAV blob
    const wav = this.audioBufferToWav(audioBuffer);
    return this.transcribe(wav);
  }

  private async convertWebmToWav(webmBlob: Blob): Promise<Blob> {
    try {
      // Check if blob is large enough and valid
      if (webmBlob.size === 0) {
        throw new Error('Empty blob');
      }
      
      if (webmBlob.size < 500) {
        throw new Error(`Blob too small for conversion: ${webmBlob.size} bytes`);
      }
      
      // Create audio context to decode webm
      const arrayBuffer = await webmBlob.arrayBuffer();
      
      // Validate the array buffer
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Empty array buffer');
      }
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      
      // Try to decode - don't validate header, just attempt decode
      // MediaRecorder chunks may work even without full headers
      let decodedData: AudioBuffer;
      try {
        decodedData = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      } catch (decodeError) {
        // If decode fails, it's likely a fragment - throw to trigger fallback
        throw new Error(`Cannot decode audio data: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
      }
      
      // Validate decoded data
      if (!decodedData || decodedData.length === 0) {
        throw new Error('Invalid decoded audio data');
      }
      
      // Convert to WAV
      return this.audioBufferToWav(decodedData);
    } catch (error: any) {
      console.warn('WebM to WAV conversion failed:', error.message || error);
      throw error; // Re-throw so caller can handle fallback
    }
  }

  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}

