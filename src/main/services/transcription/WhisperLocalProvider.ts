import { TranscriptionProvider, TranscriptionResult } from '../../../shared/types';
import { convertToWav } from '../../utils/audio-converter';
import { createLogger } from '../../utils/logger';
import { existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

const log = createLogger('whisper-local');

export class WhisperLocalProvider implements TranscriptionProvider {
  private modelName: string;

  constructor(modelName: string) {
    this.modelName = modelName;
  }

  private getModelDir(): string {
    return join(app.getPath('userData'), 'models');
  }

  private getModelPath(): string {
    return join(this.getModelDir(), `ggml-${this.modelName}.bin`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      return existsSync(this.getModelPath());
    } catch {
      return false;
    }
  }

  async transcribe(audioBuffer: ArrayBuffer, format = 'webm'): Promise<TranscriptionResult> {
    // Convert to WAV (whisper.cpp requires WAV 16kHz mono)
    log.info(`Converting ${format} to WAV...`);
    const wavBuffer = await convertToWav(audioBuffer, format);

    log.info(`Running local whisper with model: ${this.modelName}`);

    // Dynamic import for nodejs-whisper since it may not be installed
    try {
      const { nodewhisper } = await import('nodejs-whisper') as any;

      // Write WAV to temp file for nodejs-whisper
      const { writeFile, unlink } = await import('fs/promises');
      const { tmpdir } = await import('os');
      const { randomUUID } = await import('crypto');

      const tempPath = join(tmpdir(), `voiceflow-${randomUUID().slice(0, 8)}.wav`);
      await writeFile(tempPath, wavBuffer);

      try {
        const result = await nodewhisper(tempPath, {
          modelName: this.modelName,
          autoDownloadModelName: this.modelName,
          whisperOptions: {
            outputInText: true,
            language: 'auto',
          },
        });

        const text = Array.isArray(result) ? result.map((r: any) => r.speech).join(' ') : String(result);

        return {
          text: text.trim(),
        };
      } finally {
        await unlink(tempPath).catch(() => {});
      }
    } catch (err) {
      log.error('Local whisper failed', err);
      throw new Error(`Local transcription failed: ${(err as Error).message}`);
    }
  }
}
