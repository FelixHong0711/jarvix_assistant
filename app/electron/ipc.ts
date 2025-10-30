// IPC channel names and type definitions
export const IPC_CHANNELS = {
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

