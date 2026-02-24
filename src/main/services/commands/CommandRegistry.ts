import { CommandDefinition } from '../../../shared/types';
import { DEFAULT_COMMANDS } from '../../../shared/command-definitions';

interface TrieNode {
  children: Map<string, TrieNode>;
  command?: CommandDefinition;
}

/**
 * Trie-based command phrase registry for longest-match-first lookup.
 * Phrases are stored as sequences of lowercase words.
 */
export class CommandRegistry {
  private root: TrieNode;
  private allCommands: CommandDefinition[];

  constructor(commands?: CommandDefinition[]) {
    this.root = { children: new Map() };
    this.allCommands = [];
    const cmds = commands ?? DEFAULT_COMMANDS;
    for (const cmd of cmds) {
      this.register(cmd);
    }
  }

  register(command: CommandDefinition): void {
    const words = command.phrase.toLowerCase().split(/\s+/);
    let node = this.root;

    for (const word of words) {
      if (!node.children.has(word)) {
        node.children.set(word, { children: new Map() });
      }
      node = node.children.get(word)!;
    }

    node.command = command;
    this.allCommands.push(command);
  }

  unregister(phrase: string): boolean {
    const words = phrase.toLowerCase().split(/\s+/);
    let node = this.root;

    for (const word of words) {
      if (!node.children.has(word)) return false;
      node = node.children.get(word)!;
    }

    if (node.command) {
      node.command = undefined;
      this.allCommands = this.allCommands.filter(
        (c) => c.phrase.toLowerCase() !== phrase.toLowerCase()
      );
      return true;
    }
    return false;
  }

  /**
   * Find the longest matching command starting at `words[startIndex]`.
   * Returns the CommandDefinition and the number of words consumed, or null.
   */
  longestMatch(words: string[], startIndex: number): { command: CommandDefinition; length: number } | null {
    let node = this.root;
    let bestMatch: { command: CommandDefinition; length: number } | null = null;

    for (let i = startIndex; i < words.length; i++) {
      const word = words[i].toLowerCase();
      if (!node.children.has(word)) break;

      node = node.children.get(word)!;
      if (node.command) {
        bestMatch = { command: node.command, length: i - startIndex + 1 };
      }
    }

    return bestMatch;
  }

  /** Look up a command by exact phrase */
  lookup(phrase: string): CommandDefinition | undefined {
    const words = phrase.toLowerCase().split(/\s+/);
    let node = this.root;

    for (const word of words) {
      if (!node.children.has(word)) return undefined;
      node = node.children.get(word)!;
    }

    return node.command;
  }

  /** Get all registered commands */
  getAll(): CommandDefinition[] {
    return [...this.allCommands];
  }

  /** Get commands by category */
  getByCategory(category: string): CommandDefinition[] {
    return this.allCommands.filter((c) => c.category === category);
  }

  /** Check if a word could be the start of any command phrase */
  isPrefix(word: string): boolean {
    return this.root.children.has(word.toLowerCase());
  }
}
