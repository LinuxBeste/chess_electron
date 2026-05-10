/**
 * Electron preload script / context bridge.
 *
 * Uses contextBridge to expose a minimal API from the main process
 * to the renderer.  Only what is explicitly listed here is available
 * to the renderer — no Node.js or Electron internals leak through.
 *
 * Security principle: expose only the specific functions the renderer
 * needs, nothing more.  This prevents a compromised renderer from
 * accessing the file system or spawning child processes.
 */

import { contextBridge, ipcRenderer } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/* Read CHESS_SERVER_URL from .env file at project root */
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
} catch {} /* .env missing — use default */

contextBridge.exposeInMainWorld('electronAPI', {
  /** Platform string (darwin/win32/linux) for OS-specific UI adjustments */
  platform: process.platform,

  /** Open a second window for testing multi-player */
  openNewWindow: () => ipcRenderer.send('open-new-window'),

  /** Server URL for the chess API — from .env CHESS_SERVER_URL or default */
  serverUrl,
});
