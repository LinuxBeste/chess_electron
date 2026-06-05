/**
 * Application entry point.
 *
 * Uses React 18's createRoot API.  HashRouter is used instead of
 * BrowserRouter because the app may run under Electron's file:// protocol,
 * where the History API pushState does not work reliably.
 *
 * HashRouter uses the URL hash (#/path) to synchronise the UI with
 * the URL bar — compatible with both HTTP and file:// serving.
 */

import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';

const container = document.getElementById('app')!;
const root = createRoot(container);
root.render(
  <HashRouter>
    <App />
  </HashRouter>,
);
