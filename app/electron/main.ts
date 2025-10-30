import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron';
import path from 'path';
import * as keytar from 'keytar';
import { OpenAI } from 'openai';
import WebSocket from 'ws';
import { IPC_CHANNELS } from './ipc';

const SERVICE_NAME = 'jarvix-meeting-assistant';
const ACCOUNT_NAME = 'openai-api-key';

let mainWindow: BrowserWindow | null = null;
let openaiClient: OpenAI | null = null;
let realtimeSocket: WebSocket | null = null;
let isTranscribing = false;
let settingsStore: any = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // In production, load the built Vite renderer from dist/
  // __dirname resolves to dist-electron/app/electron inside app.asar.
  // The built renderer lives at app.asar/dist/index.html → go up 3 levels.
  const rendererIndexPath = path.join(__dirname, '../../../dist/index.html');
  try {
    const fs = require('fs');
    if (!fs.existsSync(rendererIndexPath)) {
      console.error('Renderer index not found:', rendererIndexPath);
    }
  } catch {}
  mainWindow.loadFile(rendererIndexPath).catch((err) => {
    console.error('Failed to load renderer:', err);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('did-fail-load:', { errorCode, errorDescription, validatedURL });
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('render-process-gone:', details);
  });

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
    const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    if (!apiKey) return null;
    return new OpenAI({ apiKey });
  } catch {
    return null;
  }
};

// IPC Handlers

// Audio handlers (stub - will be implemented in renderer with getUserMedia)
ipcMain.handle(IPC_CHANNELS.AUDIO_GET_DEVICES, async () => {
  // In production, we'll handle this via getUserMedia in renderer
  return [];
});

ipcMain.handle(IPC_CHANNELS.AUDIO_START_CAPTURE, async () => {
  // Audio capture handled in renderer
});

ipcMain.handle(IPC_CHANNELS.AUDIO_STOP_CAPTURE, async () => {
  // Audio capture handled in renderer
});

// OpenAI handlers
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

ipcMain.handle(
  IPC_CHANNELS.OPENAI_START_TRANSCRIPTION,
  async (_event, audioStream?: Float32Array[]) => {
    if (isTranscribing) return;
    isTranscribing = true;

    try {
      const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
      if (!apiKey) {
        throw new Error('OpenAI API key not set');
      }

      // Note: OpenAI Realtime API uses WebSocket connections
      // This will be handled primarily in the renderer, but we can set up the connection here
      // For now, we'll let the renderer handle WebSocket connections directly
    } catch (error) {
      isTranscribing = false;
      throw error;
    }
  }
);

ipcMain.handle(IPC_CHANNELS.OPENAI_STOP_TRANSCRIPTION, async () => {
  if (realtimeSocket) {
    realtimeSocket.close();
    realtimeSocket = null;
  }
  isTranscribing = false;
});

// Export handlers
ipcMain.handle(
  IPC_CHANNELS.EXPORT_SAVE_FILE,
  async (_event, content: string, filename: string, type: 'markdown' | 'text' | 'json') => {
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
  }
);

// Settings handlers
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

// App lifecycle
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

