import { globalShortcut } from 'electron';
import { createLogger } from './utils/logger';

const log = createLogger('hotkey');

let currentHotkey: string | null = null;
let hotkeyCallback: (() => void) | null = null;

/**
 * Register a global hotkey that triggers the given callback.
 * Unregisters any previously registered hotkey first.
 */
export function registerHotkey(accelerator: string, callback: () => void): boolean {
  unregisterHotkey();

  try {
    const success = globalShortcut.register(accelerator, callback);
    if (success) {
      currentHotkey = accelerator;
      hotkeyCallback = callback;
      log.info(`Global hotkey registered: ${accelerator}`);
    } else {
      log.warn(`Failed to register hotkey: ${accelerator} (already in use?)`);
    }
    return success;
  } catch (err) {
    log.error(`Error registering hotkey: ${accelerator}`, err);
    return false;
  }
}

/**
 * Unregister the current global hotkey.
 */
export function unregisterHotkey(): void {
  if (currentHotkey) {
    try {
      globalShortcut.unregister(currentHotkey);
      log.info(`Global hotkey unregistered: ${currentHotkey}`);
    } catch {
      // Ignore — may already be unregistered
    }
    currentHotkey = null;
    hotkeyCallback = null;
  }
}

/**
 * Update the hotkey accelerator (re-registers with new key combo).
 */
export function updateHotkey(newAccelerator: string): boolean {
  if (newAccelerator === currentHotkey) return true;

  const cb = hotkeyCallback;
  if (!cb) {
    log.warn('Cannot update hotkey — no callback registered');
    return false;
  }

  return registerHotkey(newAccelerator, cb);
}

/**
 * Unregister all global shortcuts (called on app quit).
 */
export function unregisterAll(): void {
  globalShortcut.unregisterAll();
  currentHotkey = null;
  hotkeyCallback = null;
  log.info('All global shortcuts unregistered');
}

export function getCurrentHotkey(): string | null {
  return currentHotkey;
}
