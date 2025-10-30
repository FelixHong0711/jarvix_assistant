import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron';
import path from 'path';
import * as keytar from 'keytar';
import { OpenAI } from 'openai';
import { IPC_CHANNELS } from './ipc';
// Removed dotenv/.env fallback to avoid reading API keys from environment in dev

const SERVICE_NAME = 'jarvix-meeting-assistant';
const ACCOUNT_NAME = 'openai-api-key';

let mainWindow: BrowserWindow | null = null;
let openaiClient: OpenAI | null = null;
let settingsStore: any = null;

const createWindow = () => {
  // In dev mode, preload is in the same directory as main.dev.js (dist-electron/app/electron)
  // Use absolute path to ensure module resolution works in sandboxed context
  const preloadPath = path.resolve(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // Load Vite dev server in development
  if (process.env.VITE_DEV === '1') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Initialize OpenAI client
const initOpenAIClient = async (): Promise<OpenAI | null> => {
  try {
    // First try to get from keytar (system keychain)
    const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    
    if (!apiKey) return null;
    return new OpenAI({ apiKey });
  } catch {
    return null;
  }
};

// IPC Handlers
ipcMain.handle(IPC_CHANNELS.OPENAI_SET_KEY, async (_event, key: string) => {
  try {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
    openaiClient = new OpenAI({ apiKey: key });
    return true;
  } catch (error) {
    console.error('Failed to save API key:', error);
    throw error;
  }
});

ipcMain.handle(IPC_CHANNELS.OPENAI_GET_KEY, async () => {
  try {
    return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  } catch {
    return null;
  }
});

ipcMain.handle(IPC_CHANNELS.OPENAI_TEST_KEY, async (_event, key: string) => {
  try {
    const client = new OpenAI({ apiKey: key });
    await client.models.list();
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle(IPC_CHANNELS.OPENAI_DELETE_KEY, async () => {
  try {
    await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    openaiClient = null;
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle(IPC_CHANNELS.EXPORT_SAVE_FILE, async (_event, content: string, filename: string, type: 'markdown' | 'text' | 'json') => {
  if (!mainWindow) return;

  const extensions = {
    markdown: 'md',
    text: 'txt',
    json: 'json',
  };

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    filters: [
      {
        name: type === 'markdown' ? 'Markdown' : type === 'json' ? 'JSON' : 'Text',
        extensions: [extensions[type]],
      },
    ],
  });

  if (!result.canceled && result.filePath) {
    const fs = await import('fs/promises');
    await fs.writeFile(result.filePath, content, 'utf-8');
  }
});

ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_event, key: string) => {
  const defaults: Record<string, any> = {
    useRealtime: true,
    language: 'auto',
    vadThreshold: 0.5,
    chunkSize: 5,
    summarizeCadence: 30,
    model: 'gpt-4o-mini',
  };
  if (settingsStore) {
    return settingsStore.get(key, defaults[key] ?? null);
  }
  return defaults[key] ?? null;
});

ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, key: string, value: any) => {
  if (settingsStore) {
    settingsStore.set(key, value);
  }
});

ipcMain.handle(IPC_CHANNELS.ABOUT_GET_VERSION, async () => {
  return app.getVersion();
});

// Audio handlers (stub - handled in renderer)
ipcMain.handle(IPC_CHANNELS.AUDIO_GET_DEVICES, async () => {
  return [];
});

ipcMain.handle(IPC_CHANNELS.AUDIO_START_CAPTURE, async () => {
  // Audio capture handled in renderer
});

ipcMain.handle(IPC_CHANNELS.AUDIO_STOP_CAPTURE, async () => {
  // Audio capture handled in renderer
});

ipcMain.handle(IPC_CHANNELS.OPENAI_START_TRANSCRIPTION, async () => {
  // Transcription handled in renderer
});

ipcMain.handle(IPC_CHANNELS.OPENAI_STOP_TRANSCRIPTION, async () => {
  // Transcription handled in renderer
});

app.whenReady().then(async () => {
  openaiClient = await initOpenAIClient();
  try {
    const ElectronStore = (await import('electron-store')).default as any;
    settingsStore = new ElectronStore({
      name: 'settings',
      defaults: {
        useRealtime: true,
        language: 'auto',
        vadThreshold: 0.5,
        chunkSize: 5,
        summarizeCadence: 30,
        model: 'gpt-4o-mini',
      },
    });
  } catch {
    settingsStore = null;
  }
  createWindow();

  // Register DevTools toggle: CmdOrCtrl+Alt+I
  globalShortcut.register('CommandOrControl+Alt+I', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      const wc = win.webContents;
      if (wc.isDevToolsOpened()) wc.closeDevTools();
      else wc.openDevTools({ mode: 'detach' });
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

