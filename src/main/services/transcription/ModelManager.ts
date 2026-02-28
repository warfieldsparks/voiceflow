import { createLogger } from '../../utils/logger';
import { WhisperModel } from '../../../shared/types';

const log = createLogger('model-manager');

// Transformers.js auto-downloads models on first use.
// This manager just tracks what's available and their sizes.
const MODELS: Omit<WhisperModel, 'downloaded' | 'path'>[] = [
  { name: 'tiny', size: '~40 MB' },
  { name: 'tiny.en', size: '~40 MB' },
  { name: 'base', size: '~75 MB' },
  { name: 'base.en', size: '~75 MB' },
  { name: 'small', size: '~250 MB' },
  { name: 'small.en', size: '~250 MB' },
];

export function listModels(): WhisperModel[] {
  return MODELS.map((m) => ({
    ...m,
    // Transformers.js caches models automatically in ~/.cache/huggingface
    // We mark all as "available" since they auto-download on first use
    downloaded: true,
  }));
}

export async function downloadModel(
  name: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  log.info(`Pre-loading model: ${name}`);

  try {
    const { pipeline } = await import('@xenova/transformers');

    // Trigger model download by creating the pipeline
    onProgress?.(10);
    const modelId = `Xenova/whisper-${name}`;
    await pipeline('automatic-speech-recognition', modelId, {
      quantized: true,
      progress_callback: (progress: any) => {
        if (progress.progress) {
          onProgress?.(Math.round(progress.progress));
        }
      },
    });

    onProgress?.(100);
    log.info(`Model ${name} ready`);
    return modelId;
  } catch (err) {
    log.error('Model download failed', err);
    throw new Error(`Failed to download model: ${(err as Error).message}`);
  }
}
