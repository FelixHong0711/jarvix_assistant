import { contextBridge, ipcRenderer } from 'electron';
import type { AudioDevice, AudioStreamData, TranscriptionEvent } from './ipc';

// IPC channel names - inlined to avoid require issues in sandboxed context
const IPC_CHANNELS = {
  // Audio
  AUDIO_GET_DEVICES: 'audio:get-devices',
  AUDIO_START_CAPTURE: 'audio:start-capture',
  AUDIO_STOP_CAPTURE: 'audio:stop-capture',
  AUDIO_STREAM_DATA: 'audio:stream-data',

  // OpenAI
  OPENAI_SET_KEY: 'openai:set-key',
  OPENAI_GET_KEY: 'openai:get-key',
  OPENAI_TEST_KEY: 'openai:test-key',
  OPENAI_DELETE_KEY: 'openai:delete-key',
  OPENAI_START_TRANSCRIPTION: 'openai:start-transcription',
  OPENAI_STOP_TRANSCRIPTION: 'openai:stop-transcription',
  OPENAI_TRANSCRIPTION_EVENT: 'openai:transcription-event',

  // Export
  EXPORT_SAVE_FILE: 'export:save-file',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // App info
  ABOUT_GET_VERSION: 'about:get-version',
} as const;

// Secure preload bridge - exposes whitelisted APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Audio APIs
  audio: {
    getDevices: (): Promise<AudioDevice[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIO_GET_DEVICES),
    startCapture: (deviceId?: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIO_START_CAPTURE, deviceId),
    stopCapture: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIO_STOP_CAPTURE),
    onStreamData: (callback: (data: AudioStreamData) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AUDIO_STREAM_DATA, (_event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.AUDIO_STREAM_DATA);
    },
  },

  // OpenAI APIs
  openai: {
    setKey: (key: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENAI_SET_KEY, key),
    getKey: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENAI_GET_KEY),
    testKey: (key: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENAI_TEST_KEY, key),
    deleteKey: (): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENAI_DELETE_KEY),
    startTranscription: (deviceId?: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENAI_START_TRANSCRIPTION, deviceId),
    stopTranscription: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENAI_STOP_TRANSCRIPTION),
    onTranscriptionEvent: (callback: (event: TranscriptionEvent) => void) => {
      ipcRenderer.on(IPC_CHANNELS.OPENAI_TRANSCRIPTION_EVENT, (_event, event) => callback(event));
      return () => ipcRenderer.removeAllListeners(IPC_CHANNELS.OPENAI_TRANSCRIPTION_EVENT);
    },
  },

  // Export APIs
  export: {
    saveFile: (content: string, filename: string, type: 'markdown' | 'text' | 'json'): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPORT_SAVE_FILE, content, filename, type),
  },

  // Settings APIs
  settings: {
    get: (key: string): Promise<any> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
    set: (key: string, value: any): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  },

  // About APIs
  about: {
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.ABOUT_GET_VERSION),
  },
});

// Type declarations for window.electronAPI
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

