import { TranscriptionResult } from '../../../shared/types';
import { GroqProvider } from './GroqProvider';
import { getSetting } from '../settings/SettingsStore';
import { createLogger } from '../../utils/logger';

const log = createLogger('transcription');

export async function transcribe(
  audioBuffer: ArrayBuffer,
  format = 'wav',
  signal?: AbortSignal
): Promise<TranscriptionResult> {
  const settings = getSetting('transcription');
  const provider = new GroqProvider(settings.groqApiKey);

  const available = await provider.isAvailable();
  if (!available) {
    throw new Error('Groq API key is not configured. Set it in Settings > Whisper.');
  }

  log.info(`Starting transcription (format: ${format}, size: ${audioBuffer.byteLength} bytes)`);
  const start = Date.now();

  try {
    const result = await provider.transcribe(audioBuffer, format, signal);
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
    const settings = getSetting('transcription');
    return !!settings.groqApiKey;
  } catch {
    return false;
  }
}
