# Commands

VoiceFlow supports both built-in spoken commands and user-defined custom commands.

## Detection Modes

### Contextual

This is the default mode.

The parser tries to decide whether a phrase should be treated as:

- literal text
- a keyboard/navigation/editing command
- punctuation
- a formatting modifier

Examples:

- `hello world period` -> `hello world.`
- `select all` -> `Ctrl+A`
- `please enter the room` -> text, not the Enter key

### Prefix

This mode only fires commands when they are explicitly prefixed.

Default prefix:

```text
command
```

Examples:

- `command enter` -> Enter key
- `enter` -> literal word `enter`

## Literal Escape

The literal escape word is separate from detection mode.

Default escape word:

```text
literal
```

Examples:

- `literal period` -> types `period`
- `literal enter` -> types `enter`

## Built-In Command Inventory

VoiceFlow currently ships 61 built-in commands:

| Category | Count | Examples |
| --- | ---: | --- |
| keyboard | 6 | `enter`, `tab`, `backspace` |
| navigation | 8 | `arrow up`, `home`, `page down` |
| editing | 6 | `copy`, `paste`, `undo`, `redo` |
| punctuation | 36 | `period`, `question mark`, `open paren`, `ampersand` |
| formatting | 5 | `new line`, `new paragraph`, `capitalize` |

## Representative Built-In Commands

### Keyboard

- `enter`
- `tab`
- `backspace`
- `delete`
- `escape`
- `space bar`

### Navigation

- `arrow up`
- `arrow down`
- `arrow left`
- `arrow right`
- `home`
- `end`
- `page up`
- `page down`

### Editing

- `select all`
- `copy`
- `paste`
- `cut`
- `undo`
- `redo`

### Punctuation

- `period`
- `comma`
- `question mark`
- `exclamation point`
- `open paren`
- `close paren`
- `open quote`
- `single quote`
- `dash`
- `ellipsis`
- `at sign`
- `underscore`
- `plus sign`
- `less than`
- `greater than`

### Formatting

- `new line`
- `new paragraph`
- `capitalize`
- `all caps`
- `no caps`

## How Custom Commands Work

The settings UI currently supports two custom command shapes:

- type text
- press a single key

The underlying type system supports more action types, but the current settings editor intentionally exposes a smaller, simpler subset.

## Good Custom Command Design

Prefer phrases that are:

- unlikely to appear in normal speech
- short and unambiguous
- consistent with the action they trigger

Good:

- `signature block`
- `insert legal disclaimer`
- `send escape`

Risky:

- `okay`
- `right`
- `please`

## Injection Details

### Text

When typing speed is `0`, VoiceFlow pastes text through the clipboard:

1. save clipboard
2. write text
3. send `Ctrl+V`
4. restore clipboard

When typing speed is greater than `0`, it types character-by-character through `nut-js`.

### Keys And Combos

Key actions are executed by `ActionExecutor` using `@nut-tree-fork/nut-js`.

Combo behavior:

- keys are pressed in order
- keys are released in reverse order

## Where To Change Commands In Code

Built-in commands:

- `src/shared/command-definitions.ts`

Parsing behavior:

- `src/main/services/commands/CommandParser.ts`
- `src/main/services/commands/SmartDetection.ts`
- `src/main/services/commands/CommandRegistry.ts`
