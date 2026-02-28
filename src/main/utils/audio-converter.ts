import { createLogger } from './logger';
import { execFile } from 'child_process';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';

const log = createLogger('audio-converter');

/**
 * Convert audio buffer to 16kHz mono 16-bit PCM WAV.
 * Tries ffmpeg first (best quality), falls back to pure JS decoding.
 */
export async function convertToWav(audioBuffer: ArrayBuffer, inputFormat = 'webm'): Promise<Buffer> {
  // Try ffmpeg first (if installed)
  try {
    const result = await convertWithFfmpeg(audioBuffer, inputFormat);
    log.info(`Converted to WAV with ffmpeg: ${result.length} bytes`);
    return result;
  } catch (err) {
    log.info('ffmpeg not available, using built-in WAV conversion');
  }

  // Fallback: decode with Electron's built-in audio decoder
  try {
    const result = await convertWithBuiltinDecoder(audioBuffer);
    log.info(`Converted to WAV with built-in decoder: ${result.length} bytes`);
    return result;
  } catch (err) {
    log.error('Built-in decoder failed:', err);
  }

  // Last resort: if audio is already WAV, return as-is
  const buf = Buffer.from(audioBuffer);
  if (buf.length > 4 && buf.toString('ascii', 0, 4) === 'RIFF') {
    log.info('Audio is already WAV format');
    return buf;
  }

  throw new Error(
    'Cannot convert audio to WAV. Please install ffmpeg for best results. ' +
    'Download from https://ffmpeg.org/download.html and add to PATH.'
  );
}

async function convertWithFfmpeg(audioBuffer: ArrayBuffer, inputFormat: string): Promise<Buffer> {
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
            reject(new Error(`ffmpeg failed: ${error.message}`));
          } else {
            resolve();
          }
        }
      );
    });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Use Electron's OfflineAudioContext to decode any format Chromium supports
 * (WebM/Opus, OGG/Vorbis, MP3, AAC, WAV, FLAC) to PCM.
 *
 * Since we're in the main process and don't have Web Audio API,
 * we write a small script and run it in a hidden BrowserWindow.
 */
async function convertWithBuiltinDecoder(audioBuffer: ArrayBuffer): Promise<Buffer> {
  const { BrowserWindow } = await import('electron');

  // Create a hidden window to use Web Audio API
  const win = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    await win.loadURL('about:blank');

    // Send audio data and decode it using OfflineAudioContext
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    const result = await win.webContents.executeJavaScript(`
      (async () => {
        const base64 = "${base64Audio}";
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        // Decode audio using Web Audio API
        const audioCtx = new OfflineAudioContext(1, 1, 16000);
        const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);

        // Resample to 16kHz mono
        const sampleRate = 16000;
        const offlineCtx = new OfflineAudioContext(1,
          Math.ceil(audioBuffer.duration * sampleRate), sampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start();
        const rendered = await offlineCtx.startRendering();

        // Get PCM data
        const pcm = rendered.getChannelData(0);

        // Convert float32 PCM to int16 and create WAV
        const numSamples = pcm.length;
        const wavSize = 44 + numSamples * 2;
        const wav = new ArrayBuffer(wavSize);
        const view = new DataView(wav);

        // WAV header
        const writeStr = (offset, str) => {
          for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
          }
        };
        writeStr(0, 'RIFF');
        view.setUint32(4, wavSize - 8, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true); // chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        writeStr(36, 'data');
        view.setUint32(40, numSamples * 2, true);

        // PCM data (float32 -> int16)
        for (let i = 0; i < numSamples; i++) {
          const s = Math.max(-1, Math.min(1, pcm[i]));
          view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        // Return as base64
        const bytes2 = new Uint8Array(wav);
        let binaryStr = '';
        for (let i = 0; i < bytes2.length; i++) {
          binaryStr += String.fromCharCode(bytes2[i]);
        }
        return btoa(binaryStr);
      })()
    `);

    return Buffer.from(result, 'base64');
  } finally {
    win.destroy();
  }
}
