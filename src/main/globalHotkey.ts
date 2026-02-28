import { uIOhook, UiohookKey, UiohookKeyboardEvent } from 'uiohook-napi';
import { createLogger } from './utils/logger';
import type { HotkeyMode } from '../shared/types';

const log = createLogger('hotkey');

// ── State ──
let hotkeyMode: HotkeyMode = 'toggle';
let toggleCallback: (() => void) | null = null;
let holdStartCallback: (() => void) | null = null;
let holdStopCallback: (() => void) | null = null;
let currentHotkeyId: string = '';
let hookStarted = false;

// Hold mode
let holdActive = false;

// Hotkey definition: set of key codes that must all be held
let requiredKeys: Set<number> = new Set();
let pressedKeys: Set<number> = new Set();

// ── Preset Hotkey Definitions ──
// Maps preset IDs to the set of uiohook key codes

const PRESETS: Record<string, number[]> = {
  'Ctrl+Win':            [UiohookKey.Ctrl, UiohookKey.Meta],
  'Ctrl+Shift+Space':    [UiohookKey.Ctrl, UiohookKey.Shift, UiohookKey.Space],
  'Ctrl+Alt+Space':      [UiohookKey.Ctrl, UiohookKey.Alt, UiohookKey.Space],
  'Alt+Z':               [UiohookKey.Alt, UiohookKey.Z],
  'Ctrl+Shift+Z':        [UiohookKey.Ctrl, UiohookKey.Shift, UiohookKey.Z],
  'F9':                  [UiohookKey.F9],
};

function ensureHookStarted(): void {
  if (hookStarted) return;

  uIOhook.on('keydown', onKeyDown);
  uIOhook.on('keyup', onKeyUp);
  uIOhook.start();
  hookStarted = true;
  log.info('uiohook global keyboard hook started');
}

function onKeyDown(e: UiohookKeyboardEvent): void {
  pressedKeys.add(e.keycode);

  // Check if all required keys are currently pressed
  if (requiredKeys.size === 0) return;
  const allPressed = [...requiredKeys].every((k) => pressedKeys.has(k));
  if (!allPressed) return;

  if (hotkeyMode === 'toggle') {
    // Only fire on the exact moment all keys become pressed (not on repeat)
    // We detect this by checking if this keydown event's key is one of the required keys
    if (requiredKeys.has(e.keycode)) {
      log.info(`Toggle hotkey fired: ${currentHotkeyId}`);
      toggleCallback?.();
    }
  } else if (hotkeyMode === 'hold') {
    if (!holdActive) {
      holdActive = true;
      log.info(`Hold hotkey pressed: ${currentHotkeyId}`);
      holdStartCallback?.();
    }
  }
}

function onKeyUp(e: UiohookKeyboardEvent): void {
  pressedKeys.delete(e.keycode);

  // For hold mode: if any required key is released, stop recording
  if (hotkeyMode === 'hold' && holdActive) {
    if (requiredKeys.has(e.keycode)) {
      holdActive = false;
      log.info(`Hold hotkey released: ${currentHotkeyId}`);
      holdStopCallback?.();
    }
  }
}

/**
 * Register a global hotkey using uiohook-napi.
 * Supports Win/Meta key and proper hold-to-record.
 */
export function registerHotkey(
  hotkeyId: string,
  callback: () => void,
  options?: {
    mode?: HotkeyMode;
    onStart?: () => void;
    onStop?: () => void;
  }
): boolean {
  const keys = PRESETS[hotkeyId];
  if (!keys) {
    log.warn(`Unknown hotkey preset: ${hotkeyId}`);
    return false;
  }

  currentHotkeyId = hotkeyId;
  requiredKeys = new Set(keys);
  pressedKeys = new Set();
  holdActive = false;

  hotkeyMode = options?.mode || 'toggle';
  toggleCallback = callback;
  holdStartCallback = options?.onStart || null;
  holdStopCallback = options?.onStop || null;

  ensureHookStarted();

  log.info(`Hotkey registered: ${hotkeyId} (mode: ${hotkeyMode}, keys: [${keys.join(', ')}])`);
  return true;
}

export function unregisterHotkey(): void {
  requiredKeys = new Set();
  pressedKeys = new Set();
  holdActive = false;
  currentHotkeyId = '';
  toggleCallback = null;
  holdStartCallback = null;
  holdStopCallback = null;
}

export function updateHotkey(newHotkeyId: string): boolean {
  if (newHotkeyId === currentHotkeyId) return true;

  const cb = toggleCallback;
  if (!cb) {
    log.warn('Cannot update hotkey — no callback registered');
    return false;
  }

  return registerHotkey(newHotkeyId, cb, {
    mode: hotkeyMode,
    onStart: holdStartCallback || undefined,
    onStop: holdStopCallback || undefined,
  });
}

export function updateHotkeyMode(mode: HotkeyMode): void {
  if (mode === hotkeyMode) return;
  hotkeyMode = mode;
  holdActive = false;
  pressedKeys = new Set();
  log.info(`Hotkey mode changed to: ${mode}`);
}

export function unregisterAll(): void {
  unregisterHotkey();
  if (hookStarted) {
    try {
      uIOhook.stop();
    } catch {
      // Ignore — may already be stopped
    }
    hookStarted = false;
    log.info('uiohook hook stopped');
  }
}

export function getCurrentHotkey(): string | null {
  return currentHotkeyId || null;
}

export function getCurrentMode(): HotkeyMode {
  return hotkeyMode;
}

/** Get available preset hotkey IDs */
export function getHotkeyPresets(): string[] {
  return Object.keys(PRESETS);
}
