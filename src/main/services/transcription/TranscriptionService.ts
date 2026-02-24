import { TranscriptionProvider, TranscriptionResult, TranscriptionMode } from '../../../shared/types';
import { WhisperCloudProvider } from './WhisperCloudProvider';
import { WhisperLocalProvider } from './WhisperLocalProvider';
import { getSetting } from '../settings/SettingsStore';
import { createLogger } from '../../utils/logger';

const log = createLogger('transcription');

let cloudProvider: WhisperCloudProvider | null = null;
let localProvider: WhisperLocalProvider | null = null;

function getProvider(mode?: TranscriptionMode): TranscriptionProvider {
  const settings = getSetting('transcription');
  const activeMode = mode ?? settings.mode;

  if (activeMode === 'cloud') {
    if (!cloudProvider) {
      cloudProvider = new WhisperCloudProvider(settings.apiKey);
    } else {
      cloudProvider.updateApiKey(settings.apiKey);
    }
    return cloudProvider;
  } else {
    if (!localProvider) {
      localProvider = new WhisperLocalProvider(settings.localModel);
    }
    return localProvider;
  }
}

export async function transcribe(
  audioBuffer: ArrayBuffer,
  format = 'webm'
): Promise<TranscriptionResult> {
  const provider = getProvider();
  const available = await provider.isAvailable();

  if (!available) {
    const mode = getSetting('transcription').mode;
    throw new Error(
      mode === 'cloud'
        ? 'OpenAI API key is not configured. Set it in Settings > Whisper.'
        : 'Local whisper model is not downloaded. Download it in Settings > Whisper.'
    );
  }

  log.info('Starting transcription...');
  const start = Date.now();
  const result = await provider.transcribe(audioBuffer, format);
  log.info(`Transcription complete in ${Date.now() - start}ms: "${result.text}"`);
  return result;
}

export async function isTranscriptionReady(): Promise<boolean> {
  try {
    const provider = getProvider();
    return await provider.isAvailable();
  } catch {
    return false;
  }
}
