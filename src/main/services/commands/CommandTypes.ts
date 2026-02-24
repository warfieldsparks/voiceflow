import { CommandAction, CommandDefinition, ParsedSegment } from '../../../shared/types';

export interface CommandMatch {
  definition: CommandDefinition;
  startIndex: number; // word index in token array
  endIndex: number;   // word index (exclusive)
  score: number;      // confidence score 0-1
}

export interface TokenInfo {
  word: string;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  prevWord?: string;
  nextWord?: string;
}

export interface ParserOptions {
  detectionMode: 'contextual' | 'prefix';
  prefixWord: string;
  literalEscape: string;
}

export interface ParseResult {
  segments: ParsedSegment[];
  rawText: string;
}

export { CommandAction, CommandDefinition, ParsedSegment };
