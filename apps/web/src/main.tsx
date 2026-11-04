import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Missing #root element');
}

// LocatorJS (dev only): hold Option/Alt and click a component to open it in your editor.
// The import is dropped from production builds.
if (import.meta.env.DEV) {
  void import('@locator/runtime').then(({ default: setupLocatorUI }) => {
    setupLocatorUI();
  });
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
