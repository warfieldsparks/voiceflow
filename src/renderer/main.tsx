import React from 'react';
import { createRoot } from 'react-dom/client';
import './mock-api'; // Must load before App so window.voiceflow exists
import App from './App';
import './styles/global.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
