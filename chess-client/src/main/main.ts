import { app, BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';

/* Disable GPU acceleration for environments without a GPU (Docker, remote, VMs) */
app.disableHardwareAcceleration();

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

/* IPC handler to open an additional window for multi-player testing */
ipcMain.on('open-new-window', () => {
  createWindow();
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
