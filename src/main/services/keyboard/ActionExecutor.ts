import { ParsedSegment, CommandAction } from '../../../shared/types';
import { ParseResult } from '../commands/CommandTypes';
import { mapKey } from './KeyMapper';
import { TextInjector } from './TextInjector';
import { createLogger } from '../../utils/logger';

const log = createLogger('action-executor');

export class ActionExecutor {
  private textInjector: TextInjector;
  private pendingModifier: 'capitalize' | 'allCaps' | 'noCaps' | null = null;

  constructor(typingSpeed = 0) {
    this.textInjector = new TextInjector(typingSpeed);
  }

  setTypingSpeed(speed: number): void {
    this.textInjector.setSpeed(speed);
  }

  /**
   * Execute a parsed result — process all segments in order.
   */
  async execute(result: ParseResult): Promise<void> {
    this.pendingModifier = null;
    let lastWasPaste = false;

    for (const segment of result.segments) {
      if (segment.type === 'text') {
        await this.executeText(segment.value);
        lastWasPaste = this.textInjector.isInstantMode();
      } else if (segment.command) {
        // After a clipboard paste, wait for the target app to process it
        // before sending key commands. Prevents "hello enter" from firing
        // Enter before the paste lands.
        if (lastWasPaste) {
          await new Promise((r) => setTimeout(r, 50));
        }
        await this.executeAction(segment.command.action);
        lastWasPaste = false;
      }
      // Small inter-segment delay for reliability
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  private async executeText(text: string): Promise<void> {
    let processedText = text;

    if (this.pendingModifier) {
      processedText = this.applyModifier(processedText, this.pendingModifier);
      this.pendingModifier = null;
    }

    await this.textInjector.type(processedText);
  }

  private async executeAction(action: CommandAction): Promise<void> {
    switch (action.type) {
      case 'key':
        await this.pressKey(action.key);
        break;
      case 'combo':
        await this.pressCombo(action.keys);
        break;
      case 'text':
        await this.textInjector.type(action.text);
        break;
      case 'sequence':
        for (const subAction of action.actions) {
          await this.executeAction(subAction);
        }
        break;
      case 'modifier':
        this.pendingModifier = action.modifier;
        break;
    }
  }

  private async pressKey(keyName: string): Promise<void> {
    try {
      const { keyboard, Key } = await import('@nut-tree-fork/nut-js');
      const mappedKey = mapKey(keyName);
      const nutKey = (Key as any)[mappedKey];
      if (nutKey !== undefined) {
        await keyboard.pressKey(nutKey);
        await keyboard.releaseKey(nutKey);
        log.info(`Pressed key: ${keyName} → ${mappedKey}`);
      } else {
        log.warn(`Unknown key: ${keyName} (mapped: ${mappedKey})`);
      }
    } catch (err) {
      log.error(`Failed to press key: ${keyName}`, err);
    }
  }

  private async pressCombo(keys: string[]): Promise<void> {
    try {
      const { keyboard, Key } = await import('@nut-tree-fork/nut-js');
      const nutKeys = keys.map((k) => {
        const mapped = mapKey(k);
        return (Key as any)[mapped];
      }).filter((k) => k !== undefined);

      if (nutKeys.length > 0) {
        // Press all keys
        for (const k of nutKeys) {
          await keyboard.pressKey(k);
        }
        // Release in reverse order
        for (const k of nutKeys.reverse()) {
          await keyboard.releaseKey(k);
        }
        log.info(`Pressed combo: ${keys.join('+')}`);
      }
    } catch (err) {
      log.error(`Failed to press combo: ${keys.join('+')}`, err);
    }
  }

  private applyModifier(text: string, modifier: 'capitalize' | 'allCaps' | 'noCaps'): string {
    // Apply modifier to the first word only
    const words = text.split(/(\s+)/);
    if (words.length === 0) return text;

    switch (modifier) {
      case 'capitalize':
        words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
        break;
      case 'allCaps':
        words[0] = words[0].toUpperCase();
        break;
      case 'noCaps':
        words[0] = words[0].toLowerCase();
        break;
    }

    return words.join('');
  }
}
