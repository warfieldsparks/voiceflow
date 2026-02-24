import { CommandDefinition } from '../../../shared/types';
import { CommandMatch, TokenInfo } from './CommandTypes';

// Words that typically precede text, not commands
const GRAMMAR_WORDS = new Set([
  'the', 'a', 'an', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'please', 'just', 'also', 'then', 'so', 'if', 'when',
  'not', "don't", "can't", "won't",
]);

// Words that often follow commands in a text context
const TEXT_CONTINUATION_WORDS = new Set([
  'the', 'a', 'an', 'your', 'my', 'our', 'their', 'his', 'her',
  'this', 'that', 'it', 'here', 'there',
  'into', 'onto', 'upon',
]);

/**
 * Score how likely a matched command phrase is actually a command
 * versus just being part of natural speech.
 *
 * Returns a score from 0.0 (definitely text) to 1.0 (definitely command).
 * Threshold of 0.5 is used for the final decision.
 */
export function scoreCommand(
  matchedCommand: CommandDefinition,
  words: string[],
  startIndex: number,
  endIndex: number
): number {
  const totalWords = words.length;
  const commandLength = endIndex - startIndex;

  let score = 0.5; // neutral starting point

  // ── 1. Isolation: standalone utterance is almost certainly a command ──
  if (totalWords === commandLength) {
    return 0.95;
  }

  // ── 2. Position weight: beginning or end of utterance ──
  if (startIndex === 0) {
    score += 0.1;
  }
  if (endIndex === totalWords) {
    score += 0.1;
  }

  // ── 3. Grammar context: preceded by articles/pronouns → likely text ──
  if (startIndex > 0) {
    const prevWord = words[startIndex - 1].toLowerCase();
    if (GRAMMAR_WORDS.has(prevWord)) {
      score -= 0.25;
    }
  }

  // ── 4. Continuation context: followed by text-like words → likely text ──
  if (endIndex < totalWords) {
    const nextWord = words[endIndex].toLowerCase();
    if (TEXT_CONTINUATION_WORDS.has(nextWord)) {
      score -= 0.15;
    }
  }

  // ── 5. Multi-word commands are more distinctive ──
  if (commandLength >= 2) {
    score += 0.1;
  }

  // ── 6. Category bias: punctuation commands are almost always intended ──
  if (matchedCommand.category === 'punctuation') {
    score += 0.15;
  }

  // ── 7. Category bias: formatting commands (new paragraph, capitalize) are usually intentional ──
  if (matchedCommand.category === 'formatting') {
    score += 0.1;
  }

  // ── 8. Adjacent commands reinforce each other ──
  // (caller handles cluster scoring, but single-word commands surrounded by text score lower)
  if (commandLength === 1 && startIndex > 0 && endIndex < totalWords) {
    const prevWord = words[startIndex - 1].toLowerCase();
    const nextWord = words[endIndex].toLowerCase();
    // If both neighbors are regular words (not commands), slight penalty
    if (!GRAMMAR_WORDS.has(prevWord) && !TEXT_CONTINUATION_WORDS.has(nextWord)) {
      score -= 0.05;
    }
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}

/**
 * Apply cluster scoring: adjacent command matches reinforce each other.
 * If two commands are back-to-back (no text between them), boost both scores.
 */
export function applyClusterBoost(matches: CommandMatch[]): CommandMatch[] {
  if (matches.length < 2) return matches;

  const boosted = matches.map((m) => ({ ...m }));

  for (let i = 0; i < boosted.length - 1; i++) {
    const current = boosted[i];
    const next = boosted[i + 1];

    if (current.endIndex === next.startIndex) {
      // Adjacent commands — boost both
      current.score = Math.min(1, current.score + 0.15);
      next.score = Math.min(1, next.score + 0.15);
    }
  }

  return boosted;
}
