import React, { useState } from 'react';
import Button from '../common/Button';
import type { CommandDefinition, CommandAction } from '../../../shared/types';

interface CommandEditorProps {
  commands: CommandDefinition[];
  detectionMode: 'contextual' | 'prefix';
  prefixWord: string;
  literalEscape: string;
  onChange: (commands: CommandDefinition[]) => void;
  onModeChange: (mode: 'contextual' | 'prefix') => void;
  onPrefixChange: (word: string) => void;
  onEscapeChange: (word: string) => void;
}

export default function CommandEditor({
  commands,
  detectionMode,
  prefixWord,
  literalEscape,
  onChange,
  onModeChange,
  onPrefixChange,
  onEscapeChange,
}: CommandEditorProps) {
  const [newPhrase, setNewPhrase] = useState('');
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<'text' | 'key'>('text');

  const addCommand = () => {
    if (!newPhrase.trim()) return;

    const action: CommandAction =
      newType === 'text'
        ? { type: 'text', text: newText }
        : { type: 'key', key: newText };

    const cmd: CommandDefinition = {
      phrase: newPhrase.trim().toLowerCase(),
      action,
      category: 'custom',
      description: `Custom: ${newPhrase}`,
    };

    onChange([...commands, cmd]);
    setNewPhrase('');
    setNewText('');
  };

  const removeCommand = (index: number) => {
    onChange(commands.filter((_, i) => i !== index));
  };

  return (
    <div className="settings-section">
      <h3>Command Detection</h3>

      <div className="form-group">
        <label>Detection Mode</label>
        <select
          value={detectionMode}
          onChange={(e) => onModeChange(e.target.value as 'contextual' | 'prefix')}
        >
          <option value="contextual">Contextual (smart detection)</option>
          <option value="prefix">Prefix word (explicit)</option>
        </select>
      </div>

      {detectionMode === 'prefix' && (
        <div className="form-group">
          <label>Prefix Word</label>
          <input
            type="text"
            value={prefixWord}
            onChange={(e) => onPrefixChange(e.target.value)}
            placeholder="command"
          />
          <span className="form-hint">
            Say "{prefixWord} enter" to press Enter. Say "enter" without prefix = typed text.
          </span>
        </div>
      )}

      <div className="form-group">
        <label>Literal Escape Word</label>
        <input
          type="text"
          value={literalEscape}
          onChange={(e) => onEscapeChange(e.target.value)}
          placeholder="literal"
        />
        <span className="form-hint">
          Say "{literalEscape} enter" to type the word "enter" instead of pressing the key.
        </span>
      </div>

      <h3>Custom Commands</h3>

      {commands.length > 0 && (
        <div className="command-list">
          {commands.map((cmd, i) => (
            <div key={i} className="command-item">
              <span className="command-phrase">"{cmd.phrase}"</span>
              <span className="command-arrow">→</span>
              <span className="command-action">
                {cmd.action.type === 'text' ? `Type: ${cmd.action.text}` : `Key: ${cmd.action.key}`}
              </span>
              <button className="command-remove" onClick={() => removeCommand(i)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="command-add">
        <input
          type="text"
          placeholder="Trigger phrase"
          value={newPhrase}
          onChange={(e) => setNewPhrase(e.target.value)}
        />
        <select value={newType} onChange={(e) => setNewType(e.target.value as 'text' | 'key')}>
          <option value="text">Type text</option>
          <option value="key">Press key</option>
        </select>
        <input
          type="text"
          placeholder={newType === 'text' ? 'Text to type' : 'Key name'}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        <Button size="sm" onClick={addCommand} disabled={!newPhrase.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
