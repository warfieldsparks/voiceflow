import { describe, it, expect, beforeEach } from 'vitest';
import { CommandParser } from '../../src/main/services/commands/CommandParser';
import { CommandRegistry } from '../../src/main/services/commands/CommandRegistry';

describe('CommandParser', () => {
  let registry: CommandRegistry;
  let parser: CommandParser;

  beforeEach(() => {
    // Use the default command set
    registry = new CommandRegistry();
    parser = new CommandParser(registry);
  });

  // ── Basic text passthrough ──

  it('should pass through plain text', () => {
    const result = parser.parse('hello world');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].type).toBe('text');
    expect(result.segments[0].value).toBe('hello world');
  });

  it('should handle empty string', () => {
    const result = parser.parse('');
    expect(result.segments).toHaveLength(0);
  });

  it('should handle whitespace-only string', () => {
    const result = parser.parse('   ');
    expect(result.segments).toHaveLength(0);
  });

  // ── Standalone commands ──

  it('should detect standalone "enter" as command', () => {
    const result = parser.parse('enter');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].type).toBe('command');
    expect(result.segments[0].command?.phrase).toBe('enter');
  });

  it('should detect standalone "period" as command', () => {
    const result = parser.parse('period');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].type).toBe('command');
  });

  it('should detect standalone multi-word "select all"', () => {
    const result = parser.parse('select all');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].type).toBe('command');
    expect(result.segments[0].command?.phrase).toBe('select all');
  });

  // ── Commands at end of text ──

  it('should detect "period" at end: "hello world period"', () => {
    const result = parser.parse('hello world period');
    expect(result.segments.length).toBeGreaterThanOrEqual(2);
    const last = result.segments[result.segments.length - 1];
    expect(last.type).toBe('command');
    expect(last.command?.phrase).toBe('period');
  });

  it('should detect "enter" at end: "goodbye enter"', () => {
    const result = parser.parse('goodbye enter');
    const last = result.segments[result.segments.length - 1];
    expect(last.type).toBe('command');
    expect(last.command?.phrase).toBe('enter');
  });

  // ── Mixed text and commands ──

  it('should parse "hello period how are you question mark"', () => {
    const result = parser.parse('hello period how are you question mark');
    // Should have: text("hello"), command(period), text("how are you"), command(question mark)
    const commandSegments = result.segments.filter((s) => s.type === 'command');
    expect(commandSegments.length).toBe(2);
    expect(commandSegments[0].command?.phrase).toBe('period');
    expect(commandSegments[1].command?.phrase).toBe('question mark');
  });

  it('should parse "hello world period new paragraph how are you"', () => {
    const result = parser.parse('hello world period new paragraph how are you');
    const commands = result.segments.filter((s) => s.type === 'command');
    expect(commands.length).toBeGreaterThanOrEqual(2);
  });

  // ── Contextual rejection ──

  it('should reject "enter" in natural speech: "please enter your password"', () => {
    const result = parser.parse('please enter your password');
    // "enter" here is preceded by "please" (grammar word) and followed by "your" (text continuation)
    // Should be treated as text
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].type).toBe('text');
    expect(result.segments[0].value).toContain('enter');
  });

  // ── Punctuation (always accepted) ──

  it('should detect punctuation commands in mixed text', () => {
    const result = parser.parse('I like apples comma bananas comma and oranges period');
    const punctuation = result.segments.filter(
      (s) => s.type === 'command' && s.command?.category === 'punctuation'
    );
    expect(punctuation.length).toBeGreaterThanOrEqual(2);
  });

  // ── Multiple consecutive commands ──

  it('should handle consecutive commands: "enter enter"', () => {
    const result = parser.parse('enter enter');
    const commands = result.segments.filter((s) => s.type === 'command');
    expect(commands.length).toBe(2);
  });

  it('should handle consecutive: "period new paragraph"', () => {
    const result = parser.parse('period new paragraph');
    const commands = result.segments.filter((s) => s.type === 'command');
    expect(commands.length).toBe(2);
  });

  // ── Literal escape ──

  it('should type "enter" when "literal enter" is said', () => {
    const result = parser.parse('literal enter');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].type).toBe('text');
    expect(result.segments[0].value).toBe('enter');
  });

  it('should type command phrase with literal escape in context', () => {
    const result = parser.parse('hello literal period goodbye');
    const texts = result.segments.filter((s) => s.type === 'text');
    const allText = texts.map((s) => s.value).join(' ');
    expect(allText).toContain('period');
  });

  // ── Prefix Mode ──

  describe('Prefix mode', () => {
    let prefixParser: CommandParser;

    beforeEach(() => {
      prefixParser = new CommandParser(registry, {
        detectionMode: 'prefix',
        prefixWord: 'command',
        literalEscape: 'literal',
      });
    });

    it('should only detect commands after prefix word', () => {
      const result = prefixParser.parse('hello command enter world');
      const commands = result.segments.filter((s) => s.type === 'command');
      expect(commands).toHaveLength(1);
      expect(commands[0].command?.phrase).toBe('enter');
    });

    it('should NOT detect command without prefix', () => {
      const result = prefixParser.parse('hello enter world');
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('text');
      expect(result.segments[0].value).toBe('hello enter world');
    });

    it('should handle prefix with multi-word command', () => {
      const result = prefixParser.parse('text command select all more text');
      const commands = result.segments.filter((s) => s.type === 'command');
      expect(commands).toHaveLength(1);
      expect(commands[0].command?.phrase).toBe('select all');
    });

    it('should handle multiple prefixed commands', () => {
      const result = prefixParser.parse('hello command enter command enter world');
      const commands = result.segments.filter((s) => s.type === 'command');
      expect(commands).toHaveLength(2);
    });

    it('should handle literal escape in prefix mode', () => {
      const result = prefixParser.parse('literal enter');
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('text');
      expect(result.segments[0].value).toBe('enter');
    });

    it('should not consume prefix word when not followed by command', () => {
      const result = prefixParser.parse('hello command world');
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('text');
      expect(result.segments[0].value).toBe('hello command world');
    });
  });

  // ── Edge cases ──

  it('should handle single word that is not a command', () => {
    const result = parser.parse('hello');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].type).toBe('text');
    expect(result.segments[0].value).toBe('hello');
  });

  it('should preserve rawText', () => {
    const input = 'hello world period';
    const result = parser.parse(input);
    expect(result.rawText).toBe(input);
  });

  it('should handle all-command input', () => {
    const result = parser.parse('enter tab backspace');
    const commands = result.segments.filter((s) => s.type === 'command');
    expect(commands.length).toBe(3);
  });

  // ── Command categories ──

  it('should detect keyboard commands', () => {
    const result = parser.parse('tab');
    expect(result.segments[0].type).toBe('command');
    expect(result.segments[0].command?.category).toBe('keyboard');
  });

  it('should detect navigation commands', () => {
    const result = parser.parse('arrow up');
    expect(result.segments[0].type).toBe('command');
    expect(result.segments[0].command?.category).toBe('navigation');
  });

  it('should detect editing commands', () => {
    const result = parser.parse('copy');
    expect(result.segments[0].type).toBe('command');
    expect(result.segments[0].command?.category).toBe('editing');
  });

  it('should detect formatting commands', () => {
    const result = parser.parse('new paragraph');
    expect(result.segments[0].type).toBe('command');
    expect(result.segments[0].command?.category).toBe('formatting');
  });

  // ── Comprehensive real-world tests ──

  it('should handle: "hello world period new paragraph how are you question mark"', () => {
    const result = parser.parse('hello world period new paragraph how are you question mark');
    const texts = result.segments.filter((s) => s.type === 'text');
    const commands = result.segments.filter((s) => s.type === 'command');

    // Should have text + command segments
    expect(texts.length).toBeGreaterThanOrEqual(2);
    expect(commands.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle: "I need to delete this backspace backspace backspace"', () => {
    const result = parser.parse('I need to delete this backspace backspace backspace');
    const commands = result.segments.filter((s) => s.type === 'command');
    // At minimum, the trailing backspaces should be detected
    expect(commands.length).toBeGreaterThanOrEqual(2);
  });

  // ── Modifier commands ──

  it('should detect "capitalize" as a modifier command', () => {
    const result = parser.parse('capitalize');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].type).toBe('command');
    expect(result.segments[0].command?.action.type).toBe('modifier');
  });

  it('should detect "all caps" as a modifier command', () => {
    const result = parser.parse('all caps');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].type).toBe('command');
  });

  // ── Special characters ──

  it('should detect "at sign"', () => {
    const result = parser.parse('at sign');
    expect(result.segments[0].type).toBe('command');
    expect(result.segments[0].command?.action).toEqual({ type: 'text', text: '@' });
  });

  it('should detect "hashtag"', () => {
    const result = parser.parse('hashtag');
    expect(result.segments[0].type).toBe('command');
    expect(result.segments[0].command?.action).toEqual({ type: 'text', text: '#' });
  });

  it('should detect "dollar sign"', () => {
    const result = parser.parse('dollar sign');
    expect(result.segments[0].type).toBe('command');
  });

  it('should detect "open paren"', () => {
    const result = parser.parse('open paren');
    expect(result.segments[0].type).toBe('command');
    expect(result.segments[0].command?.action).toEqual({ type: 'text', text: '(' });
  });

  it('should detect "close paren"', () => {
    const result = parser.parse('close paren');
    expect(result.segments[0].type).toBe('command');
    expect(result.segments[0].command?.action).toEqual({ type: 'text', text: ')' });
  });

  // ── updateOptions ──

  it('should allow updating options at runtime', () => {
    parser.updateOptions({ detectionMode: 'prefix', prefixWord: 'cmd' });
    const result = parser.parse('hello cmd enter world');
    const commands = result.segments.filter((s) => s.type === 'command');
    expect(commands).toHaveLength(1);
  });
});
