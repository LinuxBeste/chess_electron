import { app, BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/* Disable GPU acceleration for environments without a GPU (Docker, remote, VMs) */
app.disableHardwareAcceleration();

/* Load .env from project root for CHESS_SERVER_URL config */
let serverUrl = 'http://localhost:3000';
try {
  const envPath = path.join(__dirname, '..', '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key === 'CHESS_SERVER_URL' && val) serverUrl = val;
      }
    }
  }
} catch {} /* .env file missing — use default */

/* Window sized for a chess board + side panels, not full-screen by default */
function createWindow(): void {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.min(1280, Math.round(screenWidth * 0.8)),
    height: Math.min(900, Math.round(screenHeight * 0.85)),
    minWidth: 960,
    minHeight: 700,
    backgroundColor: '#0e0e10',
    show: false,
    title: 'Chess',
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

  /* Open DevTools in development mode to surface errors */
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--devtools')) {
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
    width: Math.min(1280, Math.round(screenWidth * 0.8)),
    height: Math.min(900, Math.round(screenHeight * 0.85)),
    minWidth: 960,
    minHeight: 700,
    backgroundColor: '#0e0e10',
    show: false,
    title: `Chess (${windowCounter})`,
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

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--devtools')) {
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
