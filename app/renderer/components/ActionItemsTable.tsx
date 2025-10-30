import { useStore } from '../state/store';
import './ActionItemsTable.css';

export default function ActionItemsTable() {
  const { actionItems } = useStore();

  return (
    <div className="action-items-table">
      {actionItems.length === 0 ? (
        <p className="empty">No action items extracted yet. Click "Summarize Now" to generate.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Owner</th>
              <th>Task</th>
              <th>Due</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            {actionItems.map((item, idx) => (
              <tr key={idx}>
                <td>{item.owner || 'N/A'}</td>
                <td>{item.task || 'N/A'}</td>
                <td>{item.due || 'N/A'}</td>
                <td>
                  <span className={`priority priority-${item.priority.toLowerCase().replace('/', '-')}`}>
                    {item.priority || 'N/A'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

