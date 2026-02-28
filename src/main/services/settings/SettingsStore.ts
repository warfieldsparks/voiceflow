import Store from 'electron-store';
import { VoiceFlowSettings } from '../../../shared/types';
import { DEFAULT_SETTINGS } from '../../../shared/constants';
import { settingsSchema } from './SettingsSchema';
import { createLogger } from '../../utils/logger';

const log = createLogger('settings');

let store: Store<VoiceFlowSettings>;

export function initSettingsStore(): Store<VoiceFlowSettings> {
  if (!store) {
    store = new Store<VoiceFlowSettings>({
      name: 'voiceflow-settings',
      defaults: DEFAULT_SETTINGS as VoiceFlowSettings,
      schema: settingsSchema as any,
      clearInvalidConfig: true,
    });

    // Migrate v1 settings: remove stale GPU/cloud fields, apply new defaults
    migrateSettings(store);

    log.info('Settings store initialized');
  }
  return store;
}

function migrateSettings(s: Store<VoiceFlowSettings>): void {
  const raw = s.store as any;

  let migrated = false;

  // Remove stale fields from old schema
  if ('apiKey' in (raw.transcription || {})) {
    delete raw.transcription.apiKey;
    migrated = true;
  }
  if ('useGpu' in (raw.transcription || {})) {
    delete raw.transcription.useGpu;
    migrated = true;
  }

  // If mode was 'cloud' (removed), reset to default
  if (raw.transcription?.mode === 'cloud') {
    raw.transcription.mode = DEFAULT_SETTINGS.transcription.mode;
    migrated = true;
  }

  if (migrated) {
    s.set('transcription', raw.transcription);
    log.info('Migrated settings: removed stale GPU/cloud fields');
  }
}

export function getSettings(): VoiceFlowSettings {
  const s = initSettingsStore();
  return s.store;
}

export function getSetting<K extends keyof VoiceFlowSettings>(key: K): VoiceFlowSettings[K] {
  const s = initSettingsStore();
  return s.get(key);
}

export function setSetting<K extends keyof VoiceFlowSettings>(
  key: K,
  value: VoiceFlowSettings[K]
): void {
  const s = initSettingsStore();
  s.set(key, value);
  log.info(`Setting updated: ${key}`);
}

export function setSettings(partial: Partial<VoiceFlowSettings>): void {
  const s = initSettingsStore();
  for (const [key, value] of Object.entries(partial)) {
    s.set(key as keyof VoiceFlowSettings, value);
  }
  log.info('Multiple settings updated');
}

export function resetSettings(): void {
  const s = initSettingsStore();
  s.clear();
  log.info('Settings reset to defaults');
}
