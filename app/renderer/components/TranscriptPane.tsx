import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import './TranscriptPane.css';

export default function TranscriptPane() {
  const { segments, isRecording, isProcessing } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new segments
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [segments]);

  return (
    <div className="transcript-pane" ref={containerRef}>
      <div className="transcript-header">
        <h2>Live Transcript</h2>
        <span className="segment-count">{segments.length} segments</span>
      </div>
      <div className="transcript-content">
        {segments.length === 0 && !isRecording ? (
          <div className="empty-state">
            <p>No transcript yet. Click Start to begin recording.</p>
          </div>
        ) : (
          <>
            {isRecording && segments.length === 0 && (
              <div className="recording-indicator">
                <div className="pulse-dot"></div>
                <p>Recording... First transcript will appear in a few seconds.</p>
              </div>
            )}
          </>
        )}
        {segments.length > 0 && (
          segments.map((segment) => (
            <div
              key={segment.id}
              className={`transcript-segment ${segment.interim ? 'interim' : ''}`}
            >
              <div className="segment-header">
                <span className="segment-time">{segment.start}</span>
              </div>
              <div className="segment-text">{segment.text}</div>
            </div>
          ))
        )}
        {isProcessing && (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <p>Processing audio...</p>
          </div>
        )}
      </div>
    </div>
  );
}

