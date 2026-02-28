import { TranscriptionProvider, TranscriptionResult, TranscriptionMode } from '../../../shared/types';
import { WhisperLocalProvider } from './WhisperLocalProvider';
import { GroqProvider } from './GroqProvider';
import { getSetting } from '../settings/SettingsStore';
import { createLogger } from '../../utils/logger';

const log = createLogger('transcription');

function createProvider(): TranscriptionProvider {
  const settings = getSetting('transcription');

  if (settings.mode === 'groq') {
    log.info(`Creating Groq provider (key: ${settings.groqApiKey ? 'set' : 'not set'})`);
    return new GroqProvider(settings.groqApiKey);
  } else {
    log.info(`Creating local provider (model: ${settings.localModel})`);
    return new WhisperLocalProvider(settings.localModel);
  }
}

export async function transcribe(
  audioBuffer: ArrayBuffer,
  format = 'webm'
): Promise<TranscriptionResult> {
  // Always create fresh provider to pick up latest settings
  const provider = createProvider();
  const settings = getSetting('transcription');

  const available = await provider.isAvailable();
  if (!available) {
    const messages: Record<string, string> = {
      groq: 'Groq API key is not configured. Set it in Settings > Whisper.',
      local: 'Whisper engine not found. Try reinstalling VoiceFlow.',
    };
    throw new Error(messages[settings.mode] || 'Transcription not available.');
  }

  log.info(`Starting transcription (mode: ${settings.mode}, format: ${format}, size: ${audioBuffer.byteLength} bytes)`);
  const start = Date.now();

  try {
    const result = await provider.transcribe(audioBuffer, format);
    log.info(`Transcription complete in ${Date.now() - start}ms: "${result.text}"`);
    return result;
  } catch (err) {
    const elapsed = Date.now() - start;
    log.error(`Transcription failed after ${elapsed}ms:`, err);
    throw err;
  }
}

export async function isTranscriptionReady(): Promise<boolean> {
  try {
    const provider = createProvider();
    return await provider.isAvailable();
  } catch {
    return false;
  }
}
