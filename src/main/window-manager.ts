import { BrowserWindow, screen, app } from 'electron';
import { join } from 'path';
import { createLogger } from './utils/logger';

const log = createLogger('window-manager');

let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

// Overlay readiness tracking
let overlayReadyResolve: (() => void) | null = null;
let overlayReadyPromise: Promise<void> | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * In dev:  __dirname = <project>/dist/main/main
 * Packaged: app.getAppPath() = <...>/resources/app.asar
 *
 * We use app.getAppPath() as the root so paths work in both cases.
 */
function getAppRoot(): string {
  return app.getAppPath();
}

function getPreloadPath(): string {
  return join(getAppRoot(), 'dist', 'main', 'preload', 'index.js');
}

function getRendererUrl(hash = ''): string {
  if (isDev) {
    return `http://localhost:5173${hash ? '#' + hash : ''}`;
  }
  const htmlPath = join(getAppRoot(), 'dist', 'renderer', 'index.html');
  return `file://${htmlPath}${hash ? '#' + hash : ''}`;
}

// ── Overlay Window ──

function initOverlayReadyPromise(): void {
  overlayReadyPromise = new Promise<void>((resolve) => {
    overlayReadyResolve = resolve;
  });

  // Safety timeout — resolve after 5s even if did-finish-load never fires
  setTimeout(() => {
    if (overlayReadyResolve) {
      log.warn('Overlay ready timeout — resolving after 5s');
      overlayReadyResolve();
      overlayReadyResolve = null;
    }
  }, 5000);
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  if (overlayWindow === null) {
    // Fresh creation — no warning needed
  } else {
    log.warn('Overlay window was destroyed — recreating');
  }

  initOverlayReadyPromise();

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  log.info(`Preload path: ${getPreloadPath()}`);
  log.info(`Renderer URL: ${getRendererUrl('overlay')}`);

  overlayWindow = new BrowserWindow({
    width: 420,
    height: 64,
    x: Math.round((screenWidth - 420) / 2),
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  overlayWindow.loadURL(getRendererUrl('overlay'));

  overlayWindow.setIgnoreMouseEvents(false);

  overlayWindow.webContents.on('did-finish-load', () => {
    if (overlayReadyResolve) {
      overlayReadyResolve();
      overlayReadyResolve = null;
    }
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    // Reset readiness so next creation sets up a new promise
    overlayReadyResolve = null;
    overlayReadyPromise = null;
  });

  // Log load errors
  overlayWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    log.error(`Overlay failed to load: ${code} ${desc}`);
    // Resolve the ready promise anyway so callers don't hang
    if (overlayReadyResolve) {
      overlayReadyResolve();
      overlayReadyResolve = null;
    }
  });

  log.info('Overlay window created');
  return overlayWindow;
}

/**
 * Wait for the overlay window to finish loading.
 * If the overlay doesn't exist, creates it and waits.
 */
export async function waitForOverlayReady(): Promise<void> {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
  }
  if (overlayReadyPromise) {
    await overlayReadyPromise;
  }
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

  settingsWindow.setMenuBarVisibility(false);

  // Log load errors
  settingsWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    log.error(`Settings failed to load: ${code} ${desc}`);
  });

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
