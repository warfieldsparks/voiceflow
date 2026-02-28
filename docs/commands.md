# Command System

## Detection Modes

### Contextual (default)
- Natural speech: "hello world period new paragraph" → "hello world.\n\n"
- Heuristic scoring distinguishes commands from regular text
- "enter" alone → Enter key (high score), "please enter the room" → text (low score)
- Adjacent commands reinforce each other (cluster boost)

### Prefix
- Explicit trigger: "command enter" → Enter key, "enter" → text "enter"
- Configurable prefix word (default: "command")
- Literal escape: "literal period" → text "period" (not ".")

## Scoring Heuristics (Contextual Mode)
- Position weight: commands at start/end of utterance score higher
- Isolation: standalone words score higher than embedded ones
- Grammar context: preceding articles/prepositions lower the score
- Category weight: keyboard commands score higher in ambiguous contexts
- Cluster boost: adjacent commands reinforce each other

## Built-in Commands (~60)
- **Keyboard**: enter, tab, backspace, delete, escape, space
- **Navigation**: up, down, left, right, home, end, page up, page down
- **Editing**: undo, redo, cut, copy, paste, select all
- **Punctuation** (~34): period, comma, question mark, exclamation point, colon, semicolon, open/close paren, open/close bracket, open/close brace, open/close quote, single quote, dash, hyphen, ellipsis, ampersand, at sign, hash, dollar sign, percent, plus, equals, underscore, pipe, tilde, caret, forward slash, backslash, asterisk
- **Formatting**: new line, new paragraph, capitalize, all caps, no caps

## Keyboard Injection

### Text Injection (TextInjector.ts)
**Instant mode** (speed=0, default):
1. Save current clipboard contents
2. Write text to clipboard
3. Wait 30ms
4. Press Ctrl+V
5. Wait 100ms
6. Restore original clipboard

**Character mode** (speed>0): nut-js `keyboard.type()` with delay between chars (50/100/200 chars/sec)

### Key Pressing (ActionExecutor.ts)
- Single key: `keyboard.pressKey()` → `keyboard.releaseKey()`
- Combo: Press all keys in order → release in reverse order
- Uses `@nut-tree-fork/nut-js` for cross-platform keyboard simulation
