import { BrowserWindow, screen, app } from 'electron';
import { join } from 'path';
import { createLogger } from './utils/logger';

const log = createLogger('window-manager');

let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getPreloadPath(): string {
  return join(__dirname, '../preload/index.js');
}

function getRendererUrl(hash = ''): string {
  if (isDev) {
    return `http://localhost:5173${hash ? '#' + hash : ''}`;
  }
  return `file://${join(__dirname, '../renderer/index.html')}${hash ? '#' + hash : ''}`;
}

// ── Overlay Window ──

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 400,
    height: 80,
    x: Math.round((screenWidth - 400) / 2),
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  overlayWindow.loadURL(getRendererUrl('overlay'));

  // Make click-through on supported platforms
  overlayWindow.setIgnoreMouseEvents(false);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  log.info('Overlay window created');
  return overlayWindow;
}

export function showOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
  }
  overlayWindow?.show();
}

export function hideOverlay(): void {
  overlayWindow?.hide();
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow && !overlayWindow.isDestroyed() ? overlayWindow : null;
}

// ── Settings Window ──

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 720,
    height: 560,
    minWidth: 600,
    minHeight: 400,
    frame: true,
    show: false,
    title: 'VoiceFlow Settings',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  settingsWindow.loadURL(getRendererUrl('settings'));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  // Remove menu bar
  settingsWindow.setMenuBarVisibility(false);

  log.info('Settings window created');
  return settingsWindow;
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null;
}

// ── Cleanup ──

export function destroyAllWindows(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
    overlayWindow = null;
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.destroy();
    settingsWindow = null;
  }
}
