import { platform } from 'os';

export const isMac = platform() === 'darwin';
export const isWindows = platform() === 'win32';
export const isLinux = platform() === 'linux';

/** Return the OS-appropriate modifier key name */
export function modifierKey(): string {
  return isMac ? 'Meta' : 'Control';
}

/** Map abstract key combos to OS-specific ones (e.g., Ctrl → Cmd on mac) */
export function platformCombo(keys: string[]): string[] {
  if (!isMac) return keys;
  return keys.map((k) => (k === 'Control' ? 'Meta' : k));
}
