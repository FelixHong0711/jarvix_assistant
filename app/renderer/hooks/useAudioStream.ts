import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';

export function useAudioStream() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const { setSelectedDevice, setAudioLevel, selectedDeviceId } = useStore();

  useEffect(() => {
    // Get audio devices
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Stop the temporary stream
        stream.getTracks().forEach((track) => track.stop());

        return navigator.mediaDevices.enumerateDevices();
      })
      .then((deviceList) => {
        const audioDevices = deviceList.filter((device) => device.kind === 'audioinput');
        setDevices(audioDevices);
        if (audioDevices.length > 0 && !selectedDeviceId) {
          setSelectedDevice(audioDevices[0].deviceId);
        }
      })
      .catch((error) => {
        console.error('Error accessing audio devices:', error);
      });
  }, [setSelectedDevice, selectedDeviceId]);

  const startCapture = async (deviceId?: string): Promise<Float32Array[]> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? {
              deviceId: { exact: deviceId },
            }
          : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const float32Data = new Float32Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          float32Data[i] = inputData[i];
        }

        // Calculate audio level for meter
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const avgLevel = sum / inputData.length;
        setAudioLevel(avgLevel);

        // Return audio data for transcription
        return float32Data;
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      processorRef.current = processor;

      return [];
    } catch (error) {
      console.error('Error starting audio capture:', error);
      throw error;
    }
  };

  const stopCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setAudioLevel(0);
  };

  // Audio frames are handled via MediaRecorder in useTranscriptionStream
  // This hook provides device selection and monitoring only

  return {
    devices,
    startCapture,
    stopCapture,
  };
}

