// Data models
export interface TranscriptSegment {
  id: string;
  start: string;
  end: string;
  speaker: string;
  text: string;
  interim?: boolean;
}

export interface ActionItem {
  owner: string;
  task: string;
  due: string;
  priority: 'High' | 'Medium' | 'Low' | 'N/A';
}

export interface MeetingExportData {
  title: string;
  date: string;
  participants: string[];
  summary: string[];
  decisions: string[];
  actionItems: ActionItem[];
  transcript: TranscriptSegment[];
}

export interface Settings {
  apiKey?: string;
  useRealtime: boolean;
  language: string;
  vadThreshold: number;
  chunkSize: number;
  summarizeCadence: number;
  model: string;
}

