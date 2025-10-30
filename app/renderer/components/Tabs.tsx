import './Tabs.css';

interface TabsProps {
  activeTab: 'summary' | 'action-items' | 'settings';
  onTabChange: (tab: 'summary' | 'action-items' | 'settings') => void;
}

export default function Tabs({ activeTab, onTabChange }: TabsProps) {
  return (
    <div className="tabs">
      <button
        className={activeTab === 'summary' ? 'active' : ''}
        onClick={() => onTabChange('summary')}
      >
        Summary
      </button>
      <button
        className={activeTab === 'action-items' ? 'active' : ''}
        onClick={() => onTabChange('action-items')}
      >
        Action Items
      </button>
      <button
        className={activeTab === 'settings' ? 'active' : ''}
        onClick={() => onTabChange('settings')}
      >
        ⚙ Settings
      </button>
    </div>
  );
}

