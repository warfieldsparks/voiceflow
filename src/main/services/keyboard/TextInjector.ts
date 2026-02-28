import { clipboard } from 'electron';
import { createLogger } from '../../utils/logger';

const log = createLogger('text-injector');

/**
 * Type text into the active window.
 * Speed 0 = instant (clipboard paste), otherwise character-by-character.
 */
export class TextInjector {
  private typingSpeed: number; // chars per second, 0 = instant

  constructor(typingSpeed = 0) {
    this.typingSpeed = typingSpeed;
  }

  setSpeed(speed: number): void {
    this.typingSpeed = speed;
  }

  async type(text: string): Promise<void> {
    if (!text) return;

    log.info(`Typing ${text.length} chars (speed: ${this.typingSpeed})`);

    if (this.typingSpeed === 0) {
      // Instant mode — clipboard paste (much faster than simulated keystrokes)
      await this.pasteText(text);
    } else {
      // Character-by-character with simulated keystrokes
      await this.typeCharByChar(text);
    }
  }

  /**
   * Paste text via clipboard + Ctrl+V.
   * Saves and restores the user's clipboard contents.
   */
  private async pasteText(text: string): Promise<void> {
    try {
      // Save current clipboard
      const previousClipboard = clipboard.readText();

      // Set our text
      clipboard.writeText(text);

      // Small delay to ensure clipboard is ready
      await this.delay(30);

      // Press Ctrl+V to paste
      const { keyboard, Key } = await import('@nut-tree-fork/nut-js');
      await keyboard.pressKey(Key.LeftControl);
      await keyboard.pressKey(Key.V);
      await keyboard.releaseKey(Key.V);
      await keyboard.releaseKey(Key.LeftControl);

      // Small delay then restore clipboard
      await this.delay(100);
      clipboard.writeText(previousClipboard);

      log.info(`Pasted ${text.length} chars via clipboard`);
    } catch (err) {
      log.error('Clipboard paste failed, falling back to keyboard.type', err);
      // Fallback to nut-js type
      const { keyboard } = await import('@nut-tree-fork/nut-js');
      await keyboard.type(text);
    }
  }

  private async typeCharByChar(text: string): Promise<void> {
    try {
      const { keyboard } = await import('@nut-tree-fork/nut-js');
      const delayMs = Math.round(1000 / this.typingSpeed);
      for (const char of text) {
        await keyboard.type(char);
        await this.delay(delayMs);
      }
    } catch (err) {
      log.error('Failed to type text', err);
      throw err;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
