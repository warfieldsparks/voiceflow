import React from 'react';
import { createRoot } from 'react-dom/client';
import './mock-api';
import App from './App';
import './styles/global.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
