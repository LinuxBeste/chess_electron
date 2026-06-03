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
import * as path from 'path';
import dotenv from 'dotenv';

/* Load .env from project root */
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const serverUrl = process.env.CHESS_SERVER_URL || 'http://localhost:3000';
const wsUrl = process.env.CHESS_WS_URL || '';
const defaultUsername = process.env.DEFAULT_USERNAME || '';
const autoConnect = process.env.AUTO_CONNECT !== 'false';
const defaultTheme = process.env.THEME || 'default';
const defaultSound = process.env.SOUND_ENABLED !== 'false';
const defaultHints = process.env.SHOW_LEGAL_HINTS !== 'false';

contextBridge.exposeInMainWorld('electronAPI', {
  /** Platform string (darwin/win32/linux) for OS-specific UI adjustments */
  platform: process.platform,

  /** Open a second window for testing multi-player */
  openNewWindow: () => ipcRenderer.send('open-new-window'),

  /** Server URL for the chess API — from .env CHESS_SERVER_URL or default */
  serverUrl,

  /** WebSocket URL override (defaults to serverUrl with http→ws) */
  wsUrl,

  /** Pre-fill login username */
  defaultUsername,

  /** Whether to auto-connect WebSocket on startup */
  autoConnect,

  /** Default board theme */
  defaultTheme,

  /** Default sound enabled state */
  defaultSound,

  /** Default legal hints enabled state */
  defaultHints,
});
