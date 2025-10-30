export interface RealtimeConfig {
  apiKey: string;
  model?: string;
}

export interface TranscriptionCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: Error) => void;
}

export class OpenAIRealtimeClient {
  private socket: WebSocket | null = null;
  private callbacks: TranscriptionCallbacks | null = null;
  private apiKey: string;

  constructor(config: RealtimeConfig) {
    this.apiKey = config.apiKey;
  }

  async connect(callbacks: TranscriptionCallbacks): Promise<void> {
    this.callbacks = callbacks;

    // OpenAI Realtime API endpoint
    const url = `wss://api.openai.com/v1/realtime?model=whisper-1`;

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(url, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        } as any);

        this.socket.onopen = () => {
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.socket.onerror = (error) => {
          this.callbacks?.onError(new Error('WebSocket error'));
          reject(error);
        };

        this.socket.onclose = () => {
          this.socket = null;
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: any): void {
    // Handle OpenAI Realtime API message format
    // This is a simplified implementation - actual Realtime API may differ
    if (data.type === 'response.audio_transcript.delta' && data.delta) {
      this.callbacks?.onInterim(data.delta);
    } else if (data.type === 'response.audio_transcript.done') {
      if (data.transcript) {
        this.callbacks?.onFinal(data.transcript);
      }
    }
  }

  sendAudio(audioData: Float32Array): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    // Convert Float32Array to base64 or send as binary
    // OpenAI Realtime API expects audio in specific format
    // This is a placeholder - actual implementation depends on API spec
    const message = {
      type: 'input_audio_buffer.append',
      audio: Array.from(audioData),
    };

    this.socket.send(JSON.stringify(message));
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

// Note: OpenAI Realtime API might use a different WebSocket protocol
// This implementation should be updated based on the actual API specification
// For now, we'll use Whisper HTTP API as primary and implement Realtime when available

