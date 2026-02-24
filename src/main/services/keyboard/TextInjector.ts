import { createLogger } from '../../utils/logger';

const log = createLogger('text-injector');

/**
 * Type text into the active window using nut-js keyboard.
 * Supports configurable typing speed (0 = instant).
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

    try {
      const { keyboard } = await import('@nut-tree-fork/nut-js');

      if (this.typingSpeed === 0) {
        // Instant mode — use clipboard-based injection for speed
        await keyboard.type(text);
      } else {
        // Character-by-character with delay
        const delayMs = Math.round(1000 / this.typingSpeed);
        for (const char of text) {
          await keyboard.type(char);
          await this.delay(delayMs);
        }
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
