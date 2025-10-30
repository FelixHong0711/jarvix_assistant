import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import './Settings.css';

export default function Settings() {
  const { settings, updateSettings } = useStore();
  const [apiKey, setApiKey] = useState('');
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);

  useEffect(() => {
    // Check if a key exists in Keychain, but do not prefill the field
    window.electronAPI.openai.getKey().then((key: string | null) => {
      if (key) {
        setHasStoredKey(true);
        updateSettings({ apiKey: key });
      } else {
        setHasStoredKey(false);
      }
    });
  }, [updateSettings]);

  const handleTestKey = async () => {
    if (!apiKey) {
      setKeyTestResult('error: Enter a key to test');
      return;
    }

    await testKey(apiKey);
  };

  const testKey = async (key: string) => {
    setTestingKey(true);
    setKeyTestResult(null);

    try {
      const isValid = await window.electronAPI.openai.testKey(key);
      if (isValid) {
        setKeyTestResult('success: API key is valid');
        await window.electronAPI.openai.setKey(key);
        updateSettings({ apiKey: key });
      } else {
        setKeyTestResult('error: Invalid API key');
      }
    } catch (error) {
      setKeyTestResult('error: Failed to test key');
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey) {
      return;
    }

    try {
      await window.electronAPI.openai.setKey(apiKey);
      updateSettings({ apiKey });
      setHasStoredKey(true);
      setKeyTestResult('success: API key saved');
    } catch (error) {
      setKeyTestResult('error: Failed to save key');
    }
  };

  const handleClearKey = async () => {
    setClearing(true);
    setKeyTestResult(null);
    try {
      const ok = await window.electronAPI.openai.deleteKey();
      if (ok) {
        setApiKey('');
        setHasStoredKey(false);
        updateSettings({ apiKey: '' as any });
        setKeyTestResult('success: API key removed');
      } else {
        setKeyTestResult('error: Failed to remove key');
      }
    } catch {
      setKeyTestResult('error: Failed to remove key');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="settings">
      <section className="settings-section">
        <h3>OpenAI API Configuration</h3>
        <div className="settings-field">
          <label>API Key</label>
          <div className="api-key-input-group">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="api-key-input"
            />
            <button onClick={handleTestKey} disabled={testingKey || !apiKey}>
              {testingKey ? 'Testing...' : 'Test'}
            </button>
            <button onClick={handleSaveKey} disabled={!apiKey}>
              Save
            </button>
            <button onClick={handleClearKey} disabled={clearing}>
              {clearing ? 'Clearing...' : 'Clear'}
            </button>
          </div>
          {hasStoredKey && !apiKey && (
            <div className="key-test-result success">Key saved in Keychain (input is empty for privacy)</div>
          )}
          {keyTestResult && (
            <div
              className={`key-test-result ${
                keyTestResult.startsWith('success') ? 'success' : 'error'
              }`}
            >
              {keyTestResult.replace(/^(success|error):\s*/, '')}
            </div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h3>Help</h3>
        <div className="settings-field">
          <label>First-time Tutorial</label>
          <div>
            <button
              onClick={async () => {
                try {
                  await window.electronAPI.settings.set('hasSeenTutorial', false);
                } catch {}
                window.dispatchEvent(new Event('show-tutorial'));
              }}
            >
              Show Tutorial
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h3>Transcription Settings</h3>
        <div className="settings-field">
          <label>Use Realtime API</label>
          <input
            type="checkbox"
            checked={settings.useRealtime}
            onChange={(e) => updateSettings({ useRealtime: e.target.checked })}
          />
        </div>
        <div className="settings-field">
          <label>Language</label>
          <select
            value={settings.language}
            onChange={(e) => updateSettings({ language: e.target.value })}
          >
            <option value="en">English (Default)</option>
            <option value="auto">Auto-detect</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
            <option value="th">Thai</option>
          </select>
          <small style={{ color: '#888', fontSize: '11px', marginTop: '4px', display: 'block' }}>
            {settings.language === 'auto' 
              ? '⚠️ Auto-detect may misidentify language. Use a specific language for best results.' 
              : `Using ${settings.language === 'en' ? 'English' : 'selected language'} for transcription.`}
          </small>
        </div>
        <div className="settings-field">
          <label>Chunk Size (seconds)</label>
          <input
            type="number"
            min="2"
            max="10"
            value={settings.chunkSize}
            onChange={(e) => updateSettings({ chunkSize: parseInt(e.target.value) || 5 })}
          />
        </div>
        <div className="settings-field">
          <label>VAD Threshold</label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={settings.vadThreshold}
            onChange={(e) =>
              updateSettings({ vadThreshold: parseFloat(e.target.value) || 0.5 })
            }
          />
          <small style={{ color: '#888', fontSize: '11px', marginTop: '4px', display: 'block' }}>
            Lower values = more sensitive to pauses (more speaker changes)
          </small>
        </div>
      </section>

      <section className="settings-section">
        <h3>Summarization Settings</h3>
        <div className="settings-field">
          <label>Model</label>
          <select
            value={settings.model}
            onChange={(e) => updateSettings({ model: e.target.value })}
          >
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
          </select>
        </div>
        <div className="settings-field">
          <label>Summarize Cadence (seconds)</label>
          <input
            type="number"
            min="10"
            max="60"
            value={settings.summarizeCadence}
            onChange={(e) =>
              updateSettings({ summarizeCadence: parseInt(e.target.value) || 30 })
            }
          />
        </div>
      </section>
    </div>
  );
}

