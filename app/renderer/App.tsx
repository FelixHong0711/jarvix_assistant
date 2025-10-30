import { useEffect, useState } from 'react';
import TopBar from './components/TopBar';
// Types are global via electron.d.ts - no need to import
import TranscriptPane from './components/TranscriptPane';
import SummaryPane from './components/SummaryPane';
import ActionItemsTable from './components/ActionItemsTable';
import Settings from './components/Settings';
import Tabs from './components/Tabs';
import { useStore } from './state/store';
import './App.css';
import Tutorial from './components/Tutorial';

function App() {
  const [activeTab, setActiveTab] = useState<'summary' | 'action-items' | 'settings'>(
    'summary'
  );
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    // Load API key on startup
    window.electronAPI.openai.getKey().then((key: string | null) => {
      if (key) {
        console.log('✓ Loaded API key from keychain');
        useStore.getState().updateSettings({ apiKey: key });
      } else {
        console.log('⚠ No API key found in keychain. Please add one in Settings.');
      }
    }).catch((error) => {
      console.error('Error loading API key:', error);
    });

    // Show tutorial for first-time users
    window.electronAPI.settings.get('hasSeenTutorial')
      .then((seen: boolean) => {
        if (!seen) setShowTutorial(true);
      })
      .catch(() => {});

    // Listen for manual tutorial trigger
    const handler = () => setShowTutorial(true);
    window.addEventListener('show-tutorial', handler as EventListener);
    return () => {
      window.removeEventListener('show-tutorial', handler as EventListener);
    };
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="app-content">
        <div className="left-pane">
          <TranscriptPane />
        </div>
        <div className="right-pane">
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="tab-content">
            {activeTab === 'summary' && <SummaryPane />}
            {activeTab === 'action-items' && <ActionItemsTable />}
            {activeTab === 'settings' && <Settings />}
          </div>
        </div>
      </div>
      {showTutorial && (
        <Tutorial
          onClose={async () => {
            try {
              await window.electronAPI.settings.set('hasSeenTutorial', true);
            } catch {}
            setShowTutorial(false);
          }}
        />
      )}
    </div>
  );
}

export default App;

