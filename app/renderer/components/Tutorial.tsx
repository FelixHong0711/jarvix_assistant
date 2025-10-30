import './Tutorial.css';

interface TutorialProps {
  onClose: () => void;
}

export default function Tutorial({ onClose }: TutorialProps) {
  return (
    <div className="tutorial-backdrop" role="dialog" aria-modal="true">
      <div className="tutorial-modal">
        <h2>Welcome to JARVIX</h2>
        <ol className="tutorial-steps">
          <li>Open Settings and paste your OpenAI API key.</li>
          <li>Select your microphone in the top bar.</li>
          <li>Click Start to record; Stop to auto-summarize.</li>
          <li>Use Summarize Now anytime to refresh results.</li>
          <li>Export notes via the Export button.</li>
        </ol>
        <div className="tutorial-actions">
          <button onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}


