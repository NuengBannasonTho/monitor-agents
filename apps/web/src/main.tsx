import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Prompt (Google Fonts), bundled with the app: no request to Google, works offline. Only the
// weights the UI uses; each covers Thai and Latin, loaded per script as text needs it.
import '@fontsource/prompt/400.css';
import '@fontsource/prompt/400-italic.css';
import '@fontsource/prompt/500.css';
import '@fontsource/prompt/600.css';
import '@fontsource/prompt/700.css';
import '@fontsource/prompt/800.css';
import './styles/global.css';
import { Walkers } from './walkers/Walkers';

/** /?walkers is the desktop strip (apps/desktop): just the walking bananas. */
const WALKERS = new URLSearchParams(window.location.search).has('walkers');
if (WALKERS) document.documentElement.dataset.walkers = '';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Missing #root element');
}

// LocatorJS (dev only): hold Option/Alt and click a component to open it in your editor.
// The import is dropped from production builds.
if (import.meta.env.DEV) {
  void import('@locator/runtime').then(({ default: setupLocatorUI }) => {
    setupLocatorUI();
    // Its panels are white but leave most text in the default color, which our
    // `color-scheme: light dark` turns white when the system is dark: white on white.
    // Keep them light. Locator mounts on the next tick, so this runs right after it.
    setTimeout(() => {
      const shadow = document.getElementById('locatorjs-wrapper')?.shadowRoot;
      if (shadow === null || shadow === undefined) return;
      const style = document.createElement('style');
      style.textContent = '#locatorjs-layer { color-scheme: light; color: #111827; }';
      shadow.append(style);
    }, 0);
  });
}

createRoot(container).render(<StrictMode>{WALKERS ? <Walkers /> : <App />}</StrictMode>);
