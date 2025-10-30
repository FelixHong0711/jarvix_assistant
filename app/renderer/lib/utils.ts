export function formatTime(seconds: number): string {
  // Handle invalid input
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    console.warn(`Invalid time value: ${seconds}, defaulting to 0`);
    seconds = 0;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateWPM(text: string, durationSeconds: number): number {
  const words = text.trim().split(/\s+/).length;
  const minutes = durationSeconds / 60;
  return minutes > 0 ? Math.round(words / minutes) : 0;
}

