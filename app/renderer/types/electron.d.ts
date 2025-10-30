// Type declarations for Electron preload API
export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: string;
}

export interface AudioStreamData {
  data: Float32Array;
  sampleRate: number;
}

export interface TranscriptionEvent {
  type: 'interim' | 'final' | 'error';
  text: string;
  timestamp?: number;
}

declare global {
  interface Window {
    electronAPI: {
      audio: {
        getDevices: () => Promise<AudioDevice[]>;
        startCapture: (deviceId?: string) => Promise<void>;
        stopCapture: () => Promise<void>;
        onStreamData: (callback: (data: AudioStreamData) => void) => () => void;
      };
      openai: {
        setKey: (key: string) => Promise<void>;
        getKey: () => Promise<string | null>;
        testKey: (key: string) => Promise<boolean>;
        deleteKey: () => Promise<boolean>;
        startTranscription: (deviceId?: string) => Promise<void>;
        stopTranscription: () => Promise<void>;
        onTranscriptionEvent: (callback: (event: TranscriptionEvent) => void) => () => void;
      };
      export: {
        saveFile: (content: string, filename: string, type: 'markdown' | 'text' | 'json') => Promise<void>;
      };
      settings: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
      };
      about: {
        getVersion: () => Promise<string>;
      };
    };
  }
}

