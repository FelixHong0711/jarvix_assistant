import type { TranscriptSegment } from './types';


export class Diarizer {
  constructor(_sampleRate: number = 16000) {
    // No initialization needed
  }

  reset(): void {
    // No state to reset
  }

  /**
   * Assign speaker - returns empty string (no speaker labels)
   */
  assignSpeaker(
    _text: string,
    _startTime: number,
    _endTime: number,
    _previousSegment?: TranscriptSegment,
    _audioData?: Float32Array
  ): string {
    return '';
  }

  /**
   * Get current speaker - returns empty string
   */
  getCurrentSpeaker(): string {
    return '';
  }

  /**
   * Force speaker change - no-op, returns empty string
   */
  forceSpeakerChange(): string {
    return '';
  }
}
