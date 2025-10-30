import { useStore } from '../state/store';
import './SummaryPane.css';

export default function SummaryPane() {
  const { summary, decisions } = useStore();

  return (
    <div className="summary-pane">
      <section className="summary-section">
        <h3>🧾 Executive Summary</h3>
        {summary.length === 0 ? (
          <p className="empty">No summary yet. Click "Summarize Now" to generate.</p>
        ) : (
          <ul className="summary-list">
            {summary.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="summary-section">
        <h3>✅ Key Decisions</h3>
        {decisions.length === 0 ? (
          <p className="empty">No decisions extracted yet.</p>
        ) : (
          <ul className="summary-list">
            {decisions.map((decision, idx) => (
              <li key={idx}>{decision}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

