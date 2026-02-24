import { createLogger } from './logger';
import { execFile } from 'child_process';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const log = createLogger('audio-converter');

/**
 * Convert a WebM/OGG audio buffer to WAV format using ffmpeg.
 * Falls back to returning the original buffer if ffmpeg isn't available.
 */
export async function convertToWav(audioBuffer: ArrayBuffer, inputFormat = 'webm'): Promise<Buffer> {
  const id = randomUUID().slice(0, 8);
  const inputPath = join(tmpdir(), `voiceflow-${id}.${inputFormat}`);
  const outputPath = join(tmpdir(), `voiceflow-${id}.wav`);

  try {
    await writeFile(inputPath, Buffer.from(audioBuffer));

    await new Promise<void>((resolve, reject) => {
      execFile(
        'ffmpeg',
        ['-i', inputPath, '-ar', '16000', '-ac', '1', '-sample_fmt', 's16', '-y', outputPath],
        { timeout: 30000 },
        (error, _stdout, stderr) => {
          if (error) {
            log.error('ffmpeg conversion failed', stderr);
            reject(new Error(`ffmpeg failed: ${error.message}`));
          } else {
            resolve();
          }
        }
      );
    });

    const wavBuffer = await readFile(outputPath);
    return wavBuffer;
  } catch (err) {
    log.warn('WAV conversion failed, returning original buffer', err);
    return Buffer.from(audioBuffer);
  } finally {
    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
