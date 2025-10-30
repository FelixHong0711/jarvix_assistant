import { create } from 'zustand';
import type { TranscriptSegment, ActionItem, Settings } from '../lib/types';

interface AppState {
  // Transcript
  segments: TranscriptSegment[];
  addSegment: (segment: TranscriptSegment) => void;
  updateSegment: (id: string, updates: Partial<TranscriptSegment>) => void;
  clearTranscript: () => void;

  // Recording state
  isRecording: boolean;
  setRecording: (recording: boolean) => void;
  isProcessing: boolean;
  setProcessing: (processing: boolean) => void;

  // Audio
  selectedDeviceId: string | null;
  setSelectedDevice: (deviceId: string | null) => void;
  audioLevel: number;
  setAudioLevel: (level: number) => void;

  // Summary
  summary: string[];
  setSummary: (summary: string[]) => void;
  decisions: string[];
  setDecisions: (decisions: string[]) => void;

  // Action items
  actionItems: ActionItem[];
  setActionItems: (items: ActionItem[]) => void;

  // Speakers
  speakerNames: Record<string, string>;
  renameSpeaker: (oldName: string, newName: string) => void;

  // Stats
  latency: number;
  setLatency: (latency: number) => void;
  wpm: number;
  setWpm: (wpm: number) => void;

  // Settings
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;

  // Meeting metadata
  meetingTitle: string;
  setMeetingTitle: (title: string) => void;
  meetingDate: string;
  setMeetingDate: (date: string) => void;
  participants: string[];
  setParticipants: (participants: string[]) => void;

  // Reset meeting
  resetMeeting: () => void;
}

export const useStore = create<AppState>((set) => ({
  segments: [],
  addSegment: (segment) =>
    set((state) => ({
      segments: [...state.segments, segment],
    })),
  updateSegment: (id, updates) =>
    set((state) => ({
      segments: state.segments.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
  clearTranscript: () => set({ segments: [] }),

  isRecording: false,
  setRecording: (recording) => set({ isRecording: recording }),
  isProcessing: false,
  setProcessing: (processing) => set({ isProcessing: processing }),

  selectedDeviceId: null,
  setSelectedDevice: (deviceId) => set({ selectedDeviceId: deviceId }),
  audioLevel: 0,
  setAudioLevel: (level) => set({ audioLevel: level }),

  summary: [],
  setSummary: (summary) => set({ summary }),
  decisions: [],
  setDecisions: (decisions) => set({ decisions }),

  actionItems: [],
  setActionItems: (items) => set({ actionItems: items }),

  speakerNames: {},
  renameSpeaker: (oldName, newName) =>
    set((state) => {
      const newNames = { ...state.speakerNames, [oldName]: newName };
      // Update all segments with this speaker
      const updatedSegments = state.segments.map((s) =>
        s.speaker === oldName ? { ...s, speaker: newName } : s
      );
      return { speakerNames: newNames, segments: updatedSegments };
    }),

  latency: 0,
  setLatency: (latency) => set({ latency }),
  wpm: 0,
  setWpm: (wpm) => set({ wpm }),

  settings: {
    useRealtime: true,
    language: 'en', // Default to English instead of auto to avoid misdetection
    vadThreshold: 0.5,
    chunkSize: 2.5, // Reduced from 5 to 2.5 seconds for faster transcription
    summarizeCadence: 30,
    model: 'gpt-4o-mini',
  },
  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),

  meetingTitle: 'Untitled Meeting',
  setMeetingTitle: (title) => set({ meetingTitle: title }),
  meetingDate: new Date().toISOString().split('T')[0],
  setMeetingDate: (date) => set({ meetingDate: date }),
  participants: [],
  setParticipants: (participants) => set({ participants }),

  resetMeeting: () =>
    set({
      segments: [],
      summary: [],
      decisions: [],
      actionItems: [],
      speakerNames: {},
      meetingTitle: 'Untitled Meeting',
      meetingDate: new Date().toISOString().split('T')[0],
      participants: [],
      latency: 0,
      wpm: 0,
      audioLevel: 0,
    }),
}));

