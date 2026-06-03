import { app, BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import dotenv from 'dotenv';

/* Load .env from project root */
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

/* Disable GPU acceleration unless DISABLE_HARDWARE_ACCEL is explicitly 'false' */
if (process.env.DISABLE_HARDWARE_ACCEL !== 'false') {
  app.disableHardwareAcceleration();
}

/* ─── Env-driven config ─── */
const serverUrl = process.env.CHESS_SERVER_URL || 'http://localhost:3000';
const devtoolsEnabled = process.env.DEVTOOLS === 'true' || process.env.NODE_ENV === 'development' || process.argv.includes('--devtools');
const windowTitle = process.env.WINDOW_TITLE || 'Chess';
const defaultWidth = parseInt(process.env.WINDOW_WIDTH || '1280', 10);
const defaultHeight = parseInt(process.env.WINDOW_HEIGHT || '900', 10);
const minWidth = parseInt(process.env.WINDOW_MIN_WIDTH || '960', 10);
const minHeight = parseInt(process.env.WINDOW_MIN_HEIGHT || '700', 10);

/* Window sized for a chess board + side panels, not full-screen by default */
function createWindow(): void {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.min(defaultWidth, Math.round(screenWidth * 0.8)),
    height: Math.min(defaultHeight, Math.round(screenHeight * 0.85)),
    minWidth,
    minHeight,
    backgroundColor: '#0e0e10',
    show: false,
    title: windowTitle,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  /* Wait for DOM ready before showing to avoid white flash on dark theme */
  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (devtoolsEnabled) {
    win.webContents.openDevTools();
  }
}

/* IPC handler to open an additional window for multi-player testing.
   Uses a unique session partition so the new window has its own
   localStorage — the user can log in as a different player. */
let windowCounter = 0;
ipcMain.on('open-new-window', () => {
  windowCounter++;
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.min(defaultWidth, Math.round(screenWidth * 0.8)),
    height: Math.min(defaultHeight, Math.round(screenHeight * 0.85)),
    minWidth,
    minHeight,
    backgroundColor: '#0e0e10',
    show: false,
    title: `${windowTitle} (${windowCounter})`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: `persist:chess-window-${windowCounter}`,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (devtoolsEnabled) {
    win.webContents.openDevTools();
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
