import { CommandDefinition, ParsedSegment } from '../../../shared/types';
import { CommandRegistry } from './CommandRegistry';
import { scoreCommand, applyClusterBoost } from './SmartDetection';
import { CommandMatch, ParserOptions, ParseResult } from './CommandTypes';

const DEFAULT_OPTIONS: ParserOptions = {
  detectionMode: 'contextual',
  prefixWord: 'command',
  literalEscape: 'literal',
};

export class CommandParser {
  private registry: CommandRegistry;
  private options: ParserOptions;

  constructor(registry?: CommandRegistry, options?: Partial<ParserOptions>) {
    this.registry = registry ?? new CommandRegistry();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  updateOptions(options: Partial<ParserOptions>): void {
    this.options = { ...this.options, ...options };
  }

  getRegistry(): CommandRegistry {
    return this.registry;
  }

  /**
   * Parse transcribed text into a sequence of text and command segments.
   */
  parse(text: string): ParseResult {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      return { segments: [], rawText: text };
    }

    if (this.options.detectionMode === 'prefix') {
      return this.parsePrefix(words, text);
    }
    return this.parseContextual(words, text);
  }

  // ── Prefix mode ──
  private parsePrefix(words: string[], rawText: string): ParseResult {
    const segments: ParsedSegment[] = [];
    let textBuffer: string[] = [];
    const prefix = this.options.prefixWord.toLowerCase();
    const escape = this.options.literalEscape.toLowerCase();

    let i = 0;
    while (i < words.length) {
      const word = words[i].toLowerCase();

      // Check for "literal <command>" → type the command phrase as text
      if (word === escape && i + 1 < words.length) {
        const match = this.registry.longestMatch(words, i + 1);
        if (match) {
          const phraseWords = words.slice(i + 1, i + 1 + match.length);
          textBuffer.push(phraseWords.join(' '));
          i += 1 + match.length;
          continue;
        }
      }

      // Check for "prefix <command>"
      if (word === prefix && i + 1 < words.length) {
        const match = this.registry.longestMatch(words, i + 1);
        if (match) {
          // Flush text buffer
          if (textBuffer.length > 0) {
            segments.push({ type: 'text', value: textBuffer.join(' ') });
            textBuffer = [];
          }
          segments.push({
            type: 'command',
            value: match.command.phrase,
            command: match.command,
          });
          i += 1 + match.length; // skip prefix + command words
          continue;
        }
      }

      // Regular word
      textBuffer.push(words[i]);
      i++;
    }

    if (textBuffer.length > 0) {
      segments.push({ type: 'text', value: textBuffer.join(' ') });
    }

    return { segments, rawText };
  }

  // ── Contextual mode ──
  private parseContextual(words: string[], rawText: string): ParseResult {
    const escape = this.options.literalEscape.toLowerCase();

    // Step 1: Find all possible command matches
    const allMatches: CommandMatch[] = [];
    let i = 0;
    while (i < words.length) {
      // Check for literal escape
      if (words[i].toLowerCase() === escape && i + 1 < words.length) {
        const match = this.registry.longestMatch(words, i + 1);
        if (match) {
          // Skip this range — will be treated as text in step 3
          i += 1 + match.length;
          continue;
        }
      }

      const match = this.registry.longestMatch(words, i);
      if (match) {
        const endIndex = i + match.length;
        const score = scoreCommand(match.command, words, i, endIndex);
        allMatches.push({
          definition: match.command,
          startIndex: i,
          endIndex,
          score,
        });
        i = endIndex;
      } else {
        i++;
      }
    }

    // Step 2: Apply cluster boosting
    const boostedMatches = applyClusterBoost(allMatches);

    // Step 3: Build segments, accepting matches above threshold
    const segments: ParsedSegment[] = [];
    let textBuffer: string[] = [];
    let wordIndex = 0;
    let matchIndex = 0;

    // Build a set of literal-escaped ranges
    const literalRanges: Array<{ start: number; end: number }> = [];
    for (let j = 0; j < words.length; j++) {
      if (words[j].toLowerCase() === escape && j + 1 < words.length) {
        const match = this.registry.longestMatch(words, j + 1);
        if (match) {
          literalRanges.push({ start: j, end: j + 1 + match.length });
        }
      }
    }

    while (wordIndex < words.length) {
      // Check if we're in a literal range
      const literalRange = literalRanges.find(
        (r) => wordIndex >= r.start && wordIndex < r.end
      );
      if (literalRange) {
        // Skip the escape word, output the command phrase as text
        if (wordIndex === literalRange.start) {
          wordIndex++; // skip "literal"
          while (wordIndex < literalRange.end) {
            textBuffer.push(words[wordIndex]);
            wordIndex++;
          }
          continue;
        }
      }

      // Check if current position matches a command
      const currentMatch = boostedMatches[matchIndex];
      if (currentMatch && wordIndex === currentMatch.startIndex) {
        if (currentMatch.score >= 0.5) {
          // Accept as command
          if (textBuffer.length > 0) {
            segments.push({ type: 'text', value: textBuffer.join(' ') });
            textBuffer = [];
          }
          segments.push({
            type: 'command',
            value: currentMatch.definition.phrase,
            command: currentMatch.definition,
          });
          wordIndex = currentMatch.endIndex;
        } else {
          // Reject — treat as text
          textBuffer.push(words[wordIndex]);
          wordIndex++;
        }
        matchIndex++;
      } else {
        textBuffer.push(words[wordIndex]);
        wordIndex++;
      }
    }

    if (textBuffer.length > 0) {
      segments.push({ type: 'text', value: textBuffer.join(' ') });
    }

    return { segments, rawText };
  }
}
