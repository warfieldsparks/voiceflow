import { describe, it, expect } from 'vitest';
import { scoreCommand, applyClusterBoost } from '../../src/main/services/commands/SmartDetection';
import { CommandDefinition } from '../../src/shared/types';
import { CommandMatch } from '../../src/main/services/commands/CommandTypes';

const enterCmd: CommandDefinition = {
  phrase: 'enter',
  action: { type: 'key', key: 'Return' },
  category: 'keyboard',
  description: 'Press Enter',
};

const periodCmd: CommandDefinition = {
  phrase: 'period',
  action: { type: 'text', text: '.' },
  category: 'punctuation',
  description: 'Type period',
};

const selectAllCmd: CommandDefinition = {
  phrase: 'select all',
  action: { type: 'combo', keys: ['Control', 'a'] },
  category: 'editing',
  description: 'Select all',
};

const newParagraphCmd: CommandDefinition = {
  phrase: 'new paragraph',
  action: { type: 'sequence', actions: [{ type: 'key', key: 'Return' }, { type: 'key', key: 'Return' }] },
  category: 'formatting',
  description: 'Double Enter',
};

describe('SmartDetection - scoreCommand', () => {
  // ── Isolation (standalone utterance) ──

  it('should score standalone command very high (isolation)', () => {
    const score = scoreCommand(enterCmd, ['enter'], 0, 1);
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it('should score standalone multi-word command very high', () => {
    const score = scoreCommand(selectAllCmd, ['select', 'all'], 0, 2);
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  // ── Position: start of utterance ──

  it('should score command at start of utterance higher', () => {
    const startScore = scoreCommand(enterCmd, ['enter', 'your', 'name'], 0, 1);
    const middleScore = scoreCommand(enterCmd, ['please', 'enter', 'now'], 1, 2);
    expect(startScore).toBeGreaterThan(middleScore);
  });

  it('should score command at end of utterance higher', () => {
    const endScore = scoreCommand(enterCmd, ['hello', 'world', 'enter'], 2, 3);
    const middleScore = scoreCommand(enterCmd, ['hello', 'enter', 'world'], 1, 2);
    expect(endScore).toBeGreaterThan(middleScore);
  });

  // ── Grammar context ──

  it('should score lower when preceded by article', () => {
    // "the enter" → "enter" is likely part of speech
    const withArticle = scoreCommand(enterCmd, ['the', 'enter'], 1, 2);
    const standalone = scoreCommand(enterCmd, ['enter'], 0, 1);
    expect(withArticle).toBeLessThan(standalone);
  });

  it('should score lower when preceded by pronoun', () => {
    // "please enter your password" → "enter" is verb
    const withPronoun = scoreCommand(enterCmd, ['please', 'enter', 'your', 'password'], 1, 2);
    expect(withPronoun).toBeLessThan(0.5);
  });

  it('should score lower when preceded by "your"', () => {
    const score = scoreCommand(enterCmd, ['your', 'enter'], 1, 2);
    expect(score).toBeLessThan(0.5);
  });

  // ── Continuation context ──

  it('should score lower when followed by text-like word', () => {
    // "enter the building" → "enter" is verb
    const score = scoreCommand(enterCmd, ['enter', 'the', 'building'], 0, 1);
    const noFollowing = scoreCommand(enterCmd, ['hello', 'enter'], 1, 2);
    expect(score).toBeLessThan(noFollowing);
  });

  // ── Multi-word bonus ──

  it('should score multi-word commands higher than single-word', () => {
    const multiScore = scoreCommand(selectAllCmd, ['hello', 'select', 'all', 'text'], 1, 3);
    const singleScore = scoreCommand(enterCmd, ['hello', 'enter', 'text'], 1, 2);
    expect(multiScore).toBeGreaterThan(singleScore);
  });

  // ── Punctuation bias ──

  it('should boost punctuation commands', () => {
    const punctScore = scoreCommand(periodCmd, ['hello', 'period', 'world'], 1, 2);
    const keyScore = scoreCommand(enterCmd, ['hello', 'enter', 'world'], 1, 2);
    expect(punctScore).toBeGreaterThan(keyScore);
  });

  // ── Formatting bias ──

  it('should boost formatting commands', () => {
    const formatScore = scoreCommand(newParagraphCmd, ['hello', 'new', 'paragraph', 'world'], 1, 3);
    expect(formatScore).toBeGreaterThanOrEqual(0.5);
  });

  // ── Real-world scenarios ──

  it('should accept "enter" at end of "hello world enter"', () => {
    const score = scoreCommand(enterCmd, ['hello', 'world', 'enter'], 2, 3);
    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  it('should reject "enter" in "please enter your password"', () => {
    const score = scoreCommand(enterCmd, ['please', 'enter', 'your', 'password'], 1, 2);
    expect(score).toBeLessThan(0.5);
  });

  it('should accept "period" in "hello world period"', () => {
    const score = scoreCommand(periodCmd, ['hello', 'world', 'period'], 2, 3);
    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  // ── Clamping ──

  it('should clamp score to [0, 1]', () => {
    const score = scoreCommand(periodCmd, ['period'], 0, 1);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('SmartDetection - applyClusterBoost', () => {
  it('should boost adjacent commands', () => {
    const matches: CommandMatch[] = [
      { definition: periodCmd, startIndex: 2, endIndex: 3, score: 0.5 },
      { definition: newParagraphCmd, startIndex: 3, endIndex: 5, score: 0.5 },
    ];

    const boosted = applyClusterBoost(matches);
    expect(boosted[0].score).toBeGreaterThan(0.5);
    expect(boosted[1].score).toBeGreaterThan(0.5);
  });

  it('should not boost non-adjacent commands', () => {
    const matches: CommandMatch[] = [
      { definition: periodCmd, startIndex: 1, endIndex: 2, score: 0.5 },
      { definition: enterCmd, startIndex: 4, endIndex: 5, score: 0.5 },
    ];

    const boosted = applyClusterBoost(matches);
    expect(boosted[0].score).toBe(0.5);
    expect(boosted[1].score).toBe(0.5);
  });

  it('should handle single match', () => {
    const matches: CommandMatch[] = [
      { definition: enterCmd, startIndex: 0, endIndex: 1, score: 0.6 },
    ];

    const boosted = applyClusterBoost(matches);
    expect(boosted[0].score).toBe(0.6);
  });

  it('should handle empty array', () => {
    const boosted = applyClusterBoost([]);
    expect(boosted).toEqual([]);
  });
});
