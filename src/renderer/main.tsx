import React from 'react';
import { createRoot } from 'react-dom/client';
import './mock-api';
import App from './App';
import './styles/global.css';
import type { LogLevel } from '../shared/types';

function serializeLogValue(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;
  }

  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function forwardRendererLog(level: LogLevel, tag: string, message: string, details?: unknown): void {
  (window as any).voiceflow?.logEvent?.({
    level,
    tag,
    message,
    details,
    source: 'renderer',
  });
}

function installRendererLogging(): void {
  const originalConsole = {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  const consoleMap: Record<'debug' | 'info' | 'log' | 'warn' | 'error', LogLevel> = {
    debug: 'debug',
    info: 'info',
    log: 'info',
    warn: 'warn',
    error: 'error',
  };

  (Object.keys(consoleMap) as Array<keyof typeof consoleMap>).forEach((method) => {
    console[method] = (...args: unknown[]) => {
      originalConsole[method](...args);

      const message = args.map(serializeLogValue).join(' ');
      forwardRendererLog(consoleMap[method], 'renderer-console', message);
    };
  });

  window.addEventListener('error', (event) => {
    forwardRendererLog('error', 'renderer-window', 'Unhandled window error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error instanceof Error
        ? {
            name: event.error.name,
            message: event.error.message,
            stack: event.error.stack,
          }
        : serializeLogValue(event.error),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    forwardRendererLog('error', 'renderer-window', 'Unhandled promise rejection', {
      reason: event.reason instanceof Error
        ? {
            name: event.reason.name,
            message: event.reason.message,
            stack: event.reason.stack,
          }
        : serializeLogValue(event.reason),
    });
  });
}

installRendererLogging();

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
