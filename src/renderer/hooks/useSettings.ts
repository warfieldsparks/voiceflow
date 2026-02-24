import { useState, useEffect, useCallback } from 'react';
import type { VoiceFlowSettings } from '../../shared/types';

declare global {
  interface Window {
    voiceflow: any;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<VoiceFlowSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await window.voiceflow.getSettings();
      setSettings(s);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = useCallback(
    async <K extends keyof VoiceFlowSettings>(key: K, value: VoiceFlowSettings[K]) => {
      try {
        await window.voiceflow.setSetting(key, value);
        setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
      } catch (err) {
        console.error(`Failed to update setting ${key}:`, err);
      }
    },
    []
  );

  const resetAll = useCallback(async () => {
    try {
      const s = await window.voiceflow.resetSettings();
      setSettings(s);
    } catch (err) {
      console.error('Failed to reset settings:', err);
    }
  }, []);

  return { settings, loading, updateSetting, resetAll, reload: loadSettings };
}
