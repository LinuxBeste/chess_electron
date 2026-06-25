import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// root element always exists — guaranteed by index.html
createRoot(document.getElementById('root')!).render(
  // StrictMode double-invokes effects in dev to surface bugs
  <StrictMode>
    <App />
  </StrictMode>,
);
