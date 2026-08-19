import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installAuthFetch } from './lib/authFetch';

// Before anything renders, so the first request a component makes already carries
// the token rather than 401ing on mount.
installAuthFetch();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);