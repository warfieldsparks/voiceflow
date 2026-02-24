/**
 * Maps abstract key names (from CommandDefinition) to nut-js Key enum values.
 * This is used by ActionExecutor to dispatch key presses.
 */
export const KEY_MAP: Record<string, string> = {
  // Standard keys
  Return: 'Return',
  Enter: 'Return',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Escape: 'Escape',
  Space: 'Space',

  // Navigation
  Up: 'Up',
  Down: 'Down',
  Left: 'Left',
  Right: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',

  // Modifiers
  Control: 'LeftControl',
  Shift: 'LeftShift',
  Alt: 'LeftAlt',
  Meta: 'LeftSuper',

  // Function keys
  F1: 'F1',
  F2: 'F2',
  F3: 'F3',
  F4: 'F4',
  F5: 'F5',
  F6: 'F6',
  F7: 'F7',
  F8: 'F8',
  F9: 'F9',
  F10: 'F10',
  F11: 'F11',
  F12: 'F12',

  // Letters (for combos like Ctrl+A)
  a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F',
  g: 'G', h: 'H', i: 'I', j: 'J', k: 'K', l: 'L',
  m: 'M', n: 'N', o: 'O', p: 'P', q: 'Q', r: 'R',
  s: 'S', t: 'T', u: 'U', v: 'V', w: 'W', x: 'X',
  y: 'Y', z: 'Z',
};

export function mapKey(keyName: string): string {
  return KEY_MAP[keyName] || keyName;
}
