import { createLogger } from '../../utils/logger';
import { WhisperModel } from '../../../shared/types';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import https from 'https';
import { createWriteStream } from 'fs';

const log = createLogger('model-manager');

const MODELS: Omit<WhisperModel, 'downloaded' | 'path'>[] = [
  { name: 'tiny', size: '75 MB' },
  { name: 'base', size: '142 MB' },
  { name: 'small', size: '466 MB' },
  { name: 'medium', size: '1.5 GB' },
  { name: 'large', size: '2.9 GB' },
];

const BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

function getModelDir(): string {
  const dir = join(app.getPath('userData'), 'models');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getModelPath(name: string): string {
  return join(getModelDir(), `ggml-${name}.bin`);
}

export function listModels(): WhisperModel[] {
  return MODELS.map((m) => {
    const path = getModelPath(m.name);
    return {
      ...m,
      downloaded: existsSync(path),
      path: existsSync(path) ? path : undefined,
    };
  });
}

export function downloadModel(
  name: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const modelPath = getModelPath(name);
    if (existsSync(modelPath)) {
      log.info(`Model ${name} already downloaded`);
      resolve(modelPath);
      return;
    }

    const url = `${BASE_URL}/ggml-${name}.bin`;
    log.info(`Downloading model ${name} from ${url}`);

    const file = createWriteStream(modelPath);

    const request = https.get(url, (response) => {
      // Handle redirect
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect with no location'));
          return;
        }
        https.get(redirectUrl, (redirectResponse) => {
          handleResponse(redirectResponse);
        });
        return;
      }
      handleResponse(response);
    });

    function handleResponse(response: any) {
      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;

      response.pipe(file);

      response.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0 && onProgress) {
          onProgress(Math.round((downloadedBytes / totalBytes) * 100));
        }
      });

      file.on('finish', () => {
        file.close();
        log.info(`Model ${name} downloaded to ${modelPath}`);
        resolve(modelPath);
      });
    }

    request.on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}
