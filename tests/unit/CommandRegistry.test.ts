import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRegistry } from '../../src/main/services/commands/CommandRegistry';
import { CommandDefinition } from '../../src/shared/types';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry([]);
  });

  // ── Registration ──

  it('should register and look up a single-word command', () => {
    registry.register({
      phrase: 'enter',
      action: { type: 'key', key: 'Return' },
      category: 'keyboard',
      description: 'Press Enter',
    });

    const result = registry.lookup('enter');
    expect(result).toBeDefined();
    expect(result!.phrase).toBe('enter');
  });

  it('should register and look up a multi-word command', () => {
    registry.register({
      phrase: 'select all',
      action: { type: 'combo', keys: ['Control', 'a'] },
      category: 'editing',
      description: 'Select all',
    });

    const result = registry.lookup('select all');
    expect(result).toBeDefined();
    expect(result!.phrase).toBe('select all');
  });

  it('should return undefined for unregistered phrase', () => {
    expect(registry.lookup('nonexistent')).toBeUndefined();
  });

  it('should be case-insensitive', () => {
    registry.register({
      phrase: 'Enter',
      action: { type: 'key', key: 'Return' },
      category: 'keyboard',
      description: 'Press Enter',
    });

    expect(registry.lookup('enter')).toBeDefined();
    expect(registry.lookup('ENTER')).toBeDefined();
    expect(registry.lookup('Enter')).toBeDefined();
  });

  // ── Unregister ──

  it('should unregister a command', () => {
    registry.register({
      phrase: 'tab',
      action: { type: 'key', key: 'Tab' },
      category: 'keyboard',
      description: 'Tab',
    });

    expect(registry.unregister('tab')).toBe(true);
    expect(registry.lookup('tab')).toBeUndefined();
  });

  it('should return false when unregistering nonexistent command', () => {
    expect(registry.unregister('nothing')).toBe(false);
  });

  // ── Longest Match ──

  it('should find single-word match', () => {
    registry.register({
      phrase: 'enter',
      action: { type: 'key', key: 'Return' },
      category: 'keyboard',
      description: 'Enter',
    });

    const result = registry.longestMatch(['enter', 'some', 'text'], 0);
    expect(result).toBeDefined();
    expect(result!.command.phrase).toBe('enter');
    expect(result!.length).toBe(1);
  });

  it('should prefer longest match over shorter', () => {
    registry.register({
      phrase: 'page',
      action: { type: 'text', text: 'page' },
      category: 'custom',
      description: 'Type page',
    });
    registry.register({
      phrase: 'page up',
      action: { type: 'key', key: 'PageUp' },
      category: 'navigation',
      description: 'Page Up',
    });

    const result = registry.longestMatch(['page', 'up', 'more'], 0);
    expect(result).toBeDefined();
    expect(result!.command.phrase).toBe('page up');
    expect(result!.length).toBe(2);
  });

  it('should fall back to shorter match when longer does not exist', () => {
    registry.register({
      phrase: 'page',
      action: { type: 'text', text: 'page' },
      category: 'custom',
      description: 'Type page',
    });

    const result = registry.longestMatch(['page', 'something'], 0);
    expect(result).toBeDefined();
    expect(result!.command.phrase).toBe('page');
    expect(result!.length).toBe(1);
  });

  it('should return null when no match starting at index', () => {
    registry.register({
      phrase: 'enter',
      action: { type: 'key', key: 'Return' },
      category: 'keyboard',
      description: 'Enter',
    });

    const result = registry.longestMatch(['hello', 'world'], 0);
    expect(result).toBeNull();
  });

  it('should match starting at non-zero index', () => {
    registry.register({
      phrase: 'period',
      action: { type: 'text', text: '.' },
      category: 'punctuation',
      description: 'Period',
    });

    const result = registry.longestMatch(['hello', 'world', 'period'], 2);
    expect(result).toBeDefined();
    expect(result!.command.phrase).toBe('period');
  });

  // ── isPrefix ──

  it('should detect word as prefix of command', () => {
    registry.register({
      phrase: 'select all',
      action: { type: 'combo', keys: ['Control', 'a'] },
      category: 'editing',
      description: 'Select all',
    });

    expect(registry.isPrefix('select')).toBe(true);
    expect(registry.isPrefix('all')).toBe(false);
    expect(registry.isPrefix('random')).toBe(false);
  });

  // ── getAll / getByCategory ──

  it('should return all registered commands', () => {
    registry.register({
      phrase: 'enter',
      action: { type: 'key', key: 'Return' },
      category: 'keyboard',
      description: 'Enter',
    });
    registry.register({
      phrase: 'period',
      action: { type: 'text', text: '.' },
      category: 'punctuation',
      description: 'Period',
    });

    expect(registry.getAll()).toHaveLength(2);
  });

  it('should filter by category', () => {
    registry.register({
      phrase: 'enter',
      action: { type: 'key', key: 'Return' },
      category: 'keyboard',
      description: 'Enter',
    });
    registry.register({
      phrase: 'period',
      action: { type: 'text', text: '.' },
      category: 'punctuation',
      description: 'Period',
    });
    registry.register({
      phrase: 'comma',
      action: { type: 'text', text: ',' },
      category: 'punctuation',
      description: 'Comma',
    });

    expect(registry.getByCategory('punctuation')).toHaveLength(2);
    expect(registry.getByCategory('keyboard')).toHaveLength(1);
    expect(registry.getByCategory('other')).toHaveLength(0);
  });

  // ── Default commands ──

  it('should load default commands when no argument passed', () => {
    const defaultRegistry = new CommandRegistry();
    expect(defaultRegistry.getAll().length).toBeGreaterThan(50);
    expect(defaultRegistry.lookup('enter')).toBeDefined();
    expect(defaultRegistry.lookup('period')).toBeDefined();
    expect(defaultRegistry.lookup('select all')).toBeDefined();
    expect(defaultRegistry.lookup('new paragraph')).toBeDefined();
  });

  // ── Three-word command ──

  it('should handle three-word commands', () => {
    registry.register({
      phrase: 'open close paren',
      action: { type: 'text', text: '()' },
      category: 'custom',
      description: 'Open and close paren',
    });

    const result = registry.longestMatch(['open', 'close', 'paren', 'hello'], 0);
    expect(result).toBeDefined();
    expect(result!.length).toBe(3);
  });
});
