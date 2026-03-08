import { globalShortcut } from 'electron';
import { uIOhook, UiohookKey, UiohookKeyboardEvent } from 'uiohook-napi';
import { createLogger } from './utils/logger';
import {
  startWindowsCtrlWinHelper,
  stopWindowsCtrlWinHelper,
} from './services/hotkeys/WindowsCtrlWinHelper';
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

// Win key suppression: does the active hotkey use Meta/Win?
let hotkeyUsesWin = false;
let winSuppressionHeld = false;
let winSuppressionReleaseTimer: ReturnType<typeof setTimeout> | null = null;

// Preferred trigger path for non-modifier combos: let the OS own the shortcut so
// the final printable key never reaches the focused app.
let registeredAccelerator: string | null = null;
let acceleratorRegistered = false;
let ctrlWinHelperRegistered = false;

// Stale key cleanup timer — clears ghost keys after 5s of keyboard inactivity
let staleTimer: ReturnType<typeof setTimeout> | null = null;
const STALE_TIMEOUT_MS = 5000;
const SANITY_CAP = 10;

function resetStaleTimer(): void {
  if (staleTimer) clearTimeout(staleTimer);
  staleTimer = setTimeout(() => {
    if (pressedKeys.size === 0) return;

    // In hold mode, keyboard inactivity is expected while the user is dictating.
    // Clearing the held combo here causes us to miss the eventual key-up and leaves
    // the recorder running until some other recovery path kicks in.
    if (hotkeyMode === 'hold' && holdActive) {
      log.debug(`Stale key cleanup skipped while hold recording is active (${currentHotkeyId})`);
      resetStaleTimer();
      return;
    }

    log.info(`Stale key cleanup: clearing ${pressedKeys.size} ghost keys`);
    pressedKeys.clear();
    holdActive = false;
  }, STALE_TIMEOUT_MS);
}

// ── Preset Hotkey Definitions ──
// Maps preset IDs to the set of uiohook key codes

type HotkeyPreset = {
  keys: number[];
  accelerator?: string;
};

const PRESETS: Record<string, HotkeyPreset> = {
  'Ctrl+Win':            { keys: [UiohookKey.Ctrl, UiohookKey.Meta] },
  'Ctrl+Shift+Space':    { keys: [UiohookKey.Ctrl, UiohookKey.Shift, UiohookKey.Space], accelerator: 'Control+Shift+Space' },
  'Ctrl+Alt+Space':      { keys: [UiohookKey.Ctrl, UiohookKey.Alt, UiohookKey.Space], accelerator: 'Control+Alt+Space' },
  'Alt+Z':               { keys: [UiohookKey.Alt, UiohookKey.Z], accelerator: 'Alt+Z' },
  'Ctrl+Shift+Z':        { keys: [UiohookKey.Ctrl, UiohookKey.Shift, UiohookKey.Z], accelerator: 'Control+Shift+Z' },
  'F9':                  { keys: [UiohookKey.F9], accelerator: 'F9' },
};

function clearWinSuppressionReleaseTimer(): void {
  if (winSuppressionReleaseTimer) {
    clearTimeout(winSuppressionReleaseTimer);
    winSuppressionReleaseTimer = null;
  }
}

function isCtrlWinHotkey(): boolean {
  return currentHotkeyId === 'Ctrl+Win';
}

function isUsingCtrlWinHelper(): boolean {
  return ctrlWinHelperRegistered && isCtrlWinHotkey();
}

function areAnyRequiredKeysStillPressed(): boolean {
  for (const key of requiredKeys) {
    if (pressedKeys.has(key)) {
      return true;
    }
  }

  return false;
}

function engageWinSuppression(reason: string): void {
  if (!hotkeyUsesWin || process.platform !== 'win32') return;

  clearWinSuppressionReleaseTimer();

  if (winSuppressionHeld) return;

  try {
    // Hold F13 for the duration of the Win combo so Windows never treats the
    // Windows key as a standalone Start-menu gesture.
    uIOhook.keyToggle(UiohookKey.F13, 'down');
    winSuppressionHeld = true;
    log.debug(`Win suppression engaged (${reason})`);
  } catch (err) {
    log.warn('Win key suppression engage failed:', err);
  }
}

function releaseWinSuppression(delayMs = 75): void {
  if (!winSuppressionHeld || process.platform !== 'win32') return;

  clearWinSuppressionReleaseTimer();
  winSuppressionReleaseTimer = setTimeout(() => {
    try {
      uIOhook.keyToggle(UiohookKey.F13, 'up');
      log.debug('Win suppression released');
    } catch (err) {
      log.warn('Win key suppression release failed:', err);
    } finally {
      winSuppressionHeld = false;
      winSuppressionReleaseTimer = null;
    }
  }, delayMs);
}

function unregisterAccelerator(): void {
  if (!registeredAccelerator) {
    acceleratorRegistered = false;
    return;
  }

  try {
    globalShortcut.unregister(registeredAccelerator);
  } catch (err) {
    log.warn(`Failed to unregister accelerator ${registeredAccelerator}:`, err);
  }

  acceleratorRegistered = false;
  registeredAccelerator = null;
}

function triggerHotkeyPress(source: string): void {
  if (hotkeyMode === 'toggle') {
    log.info(`Toggle hotkey fired via ${source}: ${currentHotkeyId}`);
    toggleCallback?.();
    return;
  }

  if (!holdActive) {
    holdActive = true;
    log.info(`Hold hotkey pressed via ${source}: ${currentHotkeyId}`);
    holdStartCallback?.();
  }
}

function triggerHotkeyRelease(source: string): void {
  if (hotkeyMode !== 'hold' || !holdActive) {
    return;
  }

  holdActive = false;
  log.info(`Hold hotkey released via ${source}: ${currentHotkeyId}`);
  holdStopCallback?.();
}

function triggerFromAccelerator(): void {
  triggerHotkeyPress('globalShortcut');
}

function registerCtrlWinHelperIfNeeded(hotkeyId: string): boolean {
  stopWindowsCtrlWinHelper();
  ctrlWinHelperRegistered = false;

  if (hotkeyId !== 'Ctrl+Win' || process.platform !== 'win32') {
    return false;
  }

  const started = startWindowsCtrlWinHelper({
    onDown: () => {
      if (!isCtrlWinHotkey()) return;
      triggerHotkeyPress('native Ctrl+Win helper');
    },
    onUp: () => {
      if (!isCtrlWinHotkey()) return;
      triggerHotkeyRelease('native Ctrl+Win helper');
      pressedKeys.clear();
    },
    onExit: () => {
      const shouldRelease = isCtrlWinHotkey();
      ctrlWinHelperRegistered = false;

      if (shouldRelease) {
        triggerHotkeyRelease('Ctrl+Win helper exit');
        pressedKeys.clear();
        log.warn('Ctrl+Win helper exited — falling back to uiohook suppression');
      }
    },
  });

  ctrlWinHelperRegistered = started;
  return started;
}

function registerAccelerator(accelerator: string | undefined): boolean {
  unregisterAccelerator();

  if (!accelerator) {
    return false;
  }

  try {
    const ok = globalShortcut.register(accelerator, triggerFromAccelerator);
    if (ok) {
      registeredAccelerator = accelerator;
      acceleratorRegistered = true;
      log.info(`Registered accelerator trigger: ${accelerator}`);
      return true;
    }

    log.warn(`globalShortcut registration failed for ${accelerator} — falling back to uiohook-only`);
    return false;
  } catch (err) {
    log.warn(`globalShortcut registration threw for ${accelerator} — falling back to uiohook-only`, err);
    return false;
  }
}

function ensureHookStarted(): void {
  if (hookStarted) return;

  uIOhook.on('keydown', onKeyDown);
  uIOhook.on('keyup', onKeyUp);
  uIOhook.start();
  hookStarted = true;
  log.info('uiohook global keyboard hook started');
}

function onKeyDown(e: UiohookKeyboardEvent): void {
  // Ignore our own synthetic F13 injections (Win key suppression)
  if (e.keycode === UiohookKey.F13) return;
  if (isUsingCtrlWinHelper()) return;

  resetStaleTimer();

  // Sanity cap — no human holds 10+ keys simultaneously
  if (pressedKeys.size > SANITY_CAP) {
    log.warn(`pressedKeys exceeded sanity cap (${pressedKeys.size}), clearing`);
    pressedKeys.clear();
  }

  pressedKeys.add(e.keycode);

  if (hotkeyUsesWin && requiredKeys.has(e.keycode)) {
    engageWinSuppression('hotkey keydown');
  }

  // Check if all required keys are currently pressed
  if (requiredKeys.size === 0) return;
  const allPressed = [...requiredKeys].every((k) => pressedKeys.has(k));
  if (!allPressed) return;

  if (hotkeyUsesWin) {
    engageWinSuppression('combo detected');
  }

  if (hotkeyMode === 'toggle') {
    if (acceleratorRegistered) return;

    // Only fire on the exact moment all keys become pressed (not on repeat)
    // We detect this by checking if this keydown event's key is one of the required keys
    if (requiredKeys.has(e.keycode)) {
      triggerHotkeyPress('uiohook');
    }
  } else if (hotkeyMode === 'hold') {
    if (acceleratorRegistered) return;

    if (!holdActive) {
      triggerHotkeyPress('uiohook');
    }
  }
}

function onKeyUp(e: UiohookKeyboardEvent): void {
  // Ignore our own synthetic F13 injections (Win key suppression)
  if (e.keycode === UiohookKey.F13) return;
  if (isUsingCtrlWinHelper()) return;

  resetStaleTimer();
  pressedKeys.delete(e.keycode);
  const releasedRequiredKey = requiredKeys.has(e.keycode);
  const comboStillHeld = areAnyRequiredKeysStillPressed();

  if (hotkeyUsesWin && releasedRequiredKey) {
    if (comboStillHeld) {
      engageWinSuppression('waiting for full combo release');
    } else {
      releaseWinSuppression(125);
    }
  }

  // For hold mode: if any required key is released, stop recording
  if (hotkeyMode === 'hold' && holdActive) {
    if (releasedRequiredKey) {
      triggerHotkeyRelease('uiohook');
      if (!comboStillHeld) {
        pressedKeys.clear();
      }
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
  const preset = PRESETS[hotkeyId];
  if (!preset) {
    log.warn(`Unknown hotkey preset: ${hotkeyId}`);
    return false;
  }

  unregisterAccelerator();
  stopWindowsCtrlWinHelper();
  ctrlWinHelperRegistered = false;

  const { keys, accelerator } = preset;
  currentHotkeyId = hotkeyId;
  requiredKeys = new Set(keys);
  pressedKeys = new Set();
  holdActive = false;
  hotkeyUsesWin = keys.includes(UiohookKey.Meta) || keys.includes(UiohookKey.MetaRight);

  hotkeyMode = options?.mode || 'toggle';
  toggleCallback = callback;
  holdStartCallback = options?.onStart || null;
  holdStopCallback = options?.onStop || null;

  ensureHookStarted();
  const usingCtrlWinHelper = registerCtrlWinHelperIfNeeded(hotkeyId);
  registerAccelerator(usingCtrlWinHelper ? undefined : accelerator);

  log.info(
    `Hotkey registered: ${hotkeyId} (mode: ${hotkeyMode}, keys: [${keys.join(', ')}], accelerator: ${usingCtrlWinHelper ? 'native-helper' : accelerator || 'none'})`
  );
  return true;
}

export function unregisterHotkey(): void {
  unregisterAccelerator();
  stopWindowsCtrlWinHelper();
  ctrlWinHelperRegistered = false;
  releaseWinSuppression(0);
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
  releaseWinSuppression(0);
  log.info(`Hotkey mode changed to: ${mode}`);
}

export function unregisterAll(): void {
  unregisterHotkey();
  if (staleTimer) {
    clearTimeout(staleTimer);
    staleTimer = null;
  }
  clearWinSuppressionReleaseTimer();
  unregisterAccelerator();
  stopWindowsCtrlWinHelper();
  ctrlWinHelperRegistered = false;
  releaseWinSuppression(0);
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
