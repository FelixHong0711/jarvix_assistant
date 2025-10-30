import { useState } from 'react';
import { useStore } from '../state/store';
import { useAudioStream } from '../hooks/useAudioStream';
import { useTranscriptionStream } from '../hooks/useTranscriptionStream';
import { useSummarizer } from '../hooks/useSummarizer';
import DeviceSelect from './DeviceSelect';
import Meter from './Meter';
import './TopBar.css';

export default function TopBar() {
  const {
    isRecording,
    setRecording,
    selectedDeviceId,
    latency,
    wpm,
    segments,
    meetingTitle,
    setMeetingTitle,
    resetMeeting,
  } = useStore();
  const { devices } = useAudioStream();
  const { startTranscription, stopTranscription } = useTranscriptionStream();
  const { summarize } = useSummarizer();
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleStartStop = async () => {
    if (isRecording) {
      await stopTranscription();
      setRecording(false);
      // Auto-summarize on stop
      if (segments.length > 0) {
        await summarize();
      }
    } else {
      try {
        console.log('Starting transcription...');
        await startTranscription(selectedDeviceId || undefined);
        setRecording(true);
        console.log('Recording started successfully');
      } catch (error: any) {
        console.error('Failed to start transcription:', error);
        alert(error.message || 'Failed to start transcription. Please check your microphone permissions and API key.');
      }
    }
  };

  const handleExport = async (format: 'markdown' | 'text' | 'json') => {
    const { exportMarkdown, exportText, exportJSON } = await import('../lib/export');
    const {
      segments,
      summary,
      decisions,
      actionItems,
      meetingTitle,
      meetingDate,
      participants,
    } = useStore.getState();

    const data = {
      title: meetingTitle,
      date: meetingDate,
      participants,
      summary,
      decisions,
      actionItems,
      transcript: segments,
    };

    let content: string;
    let filename: string;
    let type: 'markdown' | 'text' | 'json';

    if (format === 'markdown') {
      content = exportMarkdown(data);
      filename = `${meetingTitle.replace(/\s+/g, '_')}_${meetingDate}.md`;
      type = 'markdown';
    } else if (format === 'text') {
      content = exportText(data);
      filename = `${meetingTitle.replace(/\s+/g, '_')}_${meetingDate}.txt`;
      type = 'text';
    } else {
      content = exportJSON(data);
      filename = `${meetingTitle.replace(/\s+/g, '_')}_${meetingDate}.json`;
      type = 'json';
    }

    await window.electronAPI.export.saveFile(content, filename, type);
    setShowExportMenu(false);
  };

  const handleReset = () => {
    if (isRecording) {
      alert('Please stop recording before resetting the meeting.');
      return;
    }
    
    const hasData = segments.length > 0;
    if (hasData) {
      const confirmed = confirm(
        'Are you sure you want to reset the meeting? This will clear all transcripts, summaries, action items, and decisions. This action cannot be undone.'
      );
      if (!confirmed) return;
    }
    
    resetMeeting();
    console.log('Meeting reset successfully');
  };

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <input
          type="text"
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          className="meeting-title-input"
          placeholder="Meeting Title"
        />
        <DeviceSelect devices={devices} />
        <Meter />
      </div>
      <div className="top-bar-center">
        <button
          className={`record-button ${isRecording ? 'recording' : ''}`}
          onClick={handleStartStop}
        >
          {isRecording ? '⏹ Stop' : '🎙 Start'}
        </button>
        {isRecording && (
          <>
            <span className="stat">Latency: {latency}ms</span>
            <span className="stat">WPM: {wpm}</span>
          </>
        )}
        <button onClick={summarize} disabled={segments.length === 0}>
          Summarize Now
        </button>
      </div>
      <div className="top-bar-right">
        <button 
          onClick={handleReset}
          className="reset-button"
          title="Reset meeting - clears all transcripts, summaries, and action items"
        >
          🗑️ Reset
        </button>
        <div className="export-menu-container">
          <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={segments.length === 0}>
            Export
          </button>
          {showExportMenu && (
            <div className="export-menu">
              <button onClick={() => handleExport('markdown')}>Markdown</button>
              <button onClick={() => handleExport('text')}>Text</button>
              <button onClick={() => handleExport('json')}>JSON</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

