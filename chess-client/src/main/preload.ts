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

contextBridge.exposeInMainWorld('electronAPI', {
  /** Platform string (darwin/win32/linux) for OS-specific UI adjustments */
  platform: process.platform,

  /** Open a second window for testing multi-player */
  openNewWindow: () => ipcRenderer.send('open-new-window'),
});
