import { TranscriptionProvider, TranscriptionResult } from '../../../shared/types';
import { createLogger } from '../../utils/logger';
import { ChildProcess, spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import http from 'http';
import https from 'https';
import { createWriteStream, existsSync, readdirSync } from 'fs';

const log = createLogger('whisper-local');

const MODEL_URLS: Record<string, string> = {
  tiny: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  'tiny.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
  base: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  'base.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  small: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  'small.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
};

// Singleton server process — shared across all WhisperLocalProvider instances
let serverProcess: ChildProcess | null = null;
let serverPort = 0;
let serverModelPath = '';
let serverReady = false;
let serverStarting = false;

const SERVER_PORT = 18080; // Use high port to avoid conflicts

export class WhisperLocalProvider implements TranscriptionProvider {
  private modelName: string;

  constructor(modelName: string) {
    this.modelName = modelName;
  }

  /** Where bundled whisper files are (read-only in packaged app) */
  private getBundledDir(): string {
    return join(process.resourcesPath, 'whisper');
  }

  /** Writable directory for user-downloaded models */
  private getUserDataDir(): string {
    return join(app.getPath('userData'), 'whisper');
  }

  private getServerBinary(): string {
    return join(this.getBundledDir(), 'whisper-server.exe');
  }

  private getCliBinary(): string {
    return join(this.getBundledDir(), 'whisper-cli.exe');
  }

  private getModelPath(): string {
    // Check bundled first, then user data
    const bundled = join(this.getBundledDir(), `ggml-${this.modelName}.bin`);
    if (existsSync(bundled)) return bundled;
    return join(this.getUserDataDir(), `ggml-${this.modelName}.bin`);
  }

  private resolveModelPath(): string {
    let modelPath = this.getModelPath();
    if (!existsSync(modelPath)) {
      log.warn(`Model ${this.modelName} not found at ${modelPath}`);
      const fallbackPath = join(this.getBundledDir(), 'ggml-small.en.bin');
      if (existsSync(fallbackPath)) {
        log.info(`Falling back to bundled tiny.en model`);
        modelPath = fallbackPath;
      } else {
        throw new Error(
          `Model "${this.modelName}" is not downloaded. ` +
          `Go to Settings > Whisper and select "tiny.en" which is included with the app.`
        );
      }
    }
    return modelPath;
  }

  async isAvailable(): Promise<boolean> {
    return existsSync(this.getServerBinary()) || existsSync(this.getCliBinary());
  }

  async transcribe(audioBuffer: ArrayBuffer, format = 'wav'): Promise<TranscriptionResult> {
    const modelPath = this.resolveModelPath();

    // Try whisper-server first (fast path — model stays in memory)
    if (existsSync(this.getServerBinary())) {
      return this.transcribeViaServer(audioBuffer, modelPath);
    }

    // Fall back to whisper-cli (slow path — loads model each time)
    return this.transcribeViaCli(audioBuffer, modelPath);
  }

  // ── Server Mode (Fast) ──

  private async ensureServerRunning(modelPath: string): Promise<void> {
    // If server is running with the same model, we're good
    if (serverProcess && !serverProcess.killed && serverReady && serverModelPath === modelPath) {
      // Verify it's actually responding
      try {
        await this.httpGet(`http://127.0.0.1:${SERVER_PORT}/health`);
        return;
      } catch {
        log.warn('Server health check failed, restarting...');
        await shutdownWhisperServer();
      }
    }

    // If model changed, restart server
    if (serverProcess && !serverProcess.killed && serverModelPath !== modelPath) {
      log.info(`Model changed from ${serverModelPath} to ${modelPath}, restarting server`);
      await shutdownWhisperServer();
    }

    // If already starting, wait for it
    if (serverStarting) {
      await this.waitForServer(15000);
      return;
    }

    serverStarting = true;
    serverReady = false;

    const binaryPath = this.getServerBinary();
    const bundledDir = this.getBundledDir();
    const cpuCount = require('os').cpus().length;
    const threads = Math.max(1, Math.floor(cpuCount / 2));

    const args = [
      '--model', modelPath,
      '--host', '127.0.0.1',
      '--port', String(SERVER_PORT),
      '--threads', String(threads),
      '--language', 'en',
      '--no-timestamps',
    ];

    log.info(`Starting whisper-server (${threads} threads) on port ${SERVER_PORT}`);
    log.info(`Binary: ${binaryPath}`);
    log.info(`Model: ${modelPath}`);

    const env = {
      ...process.env,
      PATH: bundledDir + ';' + (process.env.PATH || ''),
    };

    serverProcess = spawn(binaryPath, args, {
      cwd: bundledDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    serverPort = SERVER_PORT;
    serverModelPath = modelPath;

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) log.info(`[server] ${line}`);
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) log.info(`[server-err] ${line}`);
    });

    serverProcess.on('exit', (code) => {
      log.info(`whisper-server exited with code ${code}`);
      serverProcess = null;
      serverReady = false;
      serverStarting = false;
    });

    serverProcess.on('error', (err) => {
      log.error('whisper-server spawn error:', err.message);
      serverProcess = null;
      serverReady = false;
      serverStarting = false;
    });

    // Wait for server to be ready
    await this.waitForServer(20000);
    serverStarting = false;
    log.info('whisper-server is ready');
  }

  private async waitForServer(timeoutMs: number): Promise<void> {
    const start = Date.now();
    const interval = 200;

    while (Date.now() - start < timeoutMs) {
      try {
        await this.httpGet(`http://127.0.0.1:${SERVER_PORT}/health`);
        serverReady = true;
        return;
      } catch {
        // Server not ready yet
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`whisper-server failed to start within ${timeoutMs}ms`);
  }

  private async transcribeViaServer(audioBuffer: ArrayBuffer, modelPath: string): Promise<TranscriptionResult> {
    await this.ensureServerRunning(modelPath);

    const start = Date.now();

    // Write WAV to temp file for multipart upload
    const buf = Buffer.from(audioBuffer);
    const id = randomUUID().slice(0, 8);
    const wavPath = join(tmpdir(), `vf-${id}.wav`);
    await writeFile(wavPath, buf);

    try {
      const result = await this.postAudioToServer(wavPath);
      const elapsed = Date.now() - start;
      log.info(`Server transcription done in ${elapsed}ms: "${result}"`);
      return { text: result.trim(), duration: elapsed / 1000 };
    } finally {
      await unlink(wavPath).catch(() => {});
    }
  }

  private postAudioToServer(wavPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(wavPath);
      const boundary = '----VoiceFlowBoundary' + randomUUID().slice(0, 8);

      // Build multipart form body
      const parts: Buffer[] = [];

      // File part
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n` +
        `Content-Type: audio/wav\r\n\r\n`
      ));
      parts.push(fileBuffer);
      parts.push(Buffer.from('\r\n'));

      // response_format part
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
        `json\r\n`
      ));

      // temperature part
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="temperature"\r\n\r\n` +
        `0.0\r\n`
      ));

      // temperature_inc — allows whisper to retry with higher temp on low-confidence
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="temperature_inc"\r\n\r\n` +
        `0.2\r\n`
      ));

      // language — force English for better accuracy with .en models
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="language"\r\n\r\n` +
        `en\r\n`
      ));

      // End boundary
      parts.push(Buffer.from(`--${boundary}--\r\n`));

      const body = Buffer.concat(parts);

      const options = {
        hostname: '127.0.0.1',
        port: SERVER_PORT,
        path: '/inference',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: 30000,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Server returned HTTP ${res.statusCode}: ${data}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve(json.text || '');
          } catch {
            // Maybe plain text response
            resolve(data.trim());
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Server request timed out'));
      });
      req.write(body);
      req.end();
    });
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: 2000 }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
          } else {
            resolve(data);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  // ── CLI Mode (Fallback) ──

  private async transcribeViaCli(audioBuffer: ArrayBuffer, modelPath: string): Promise<TranscriptionResult> {
    const binaryPath = this.getCliBinary();

    if (!existsSync(binaryPath)) {
      throw new Error('Whisper engine not found. Try reinstalling VoiceFlow.');
    }

    const buf = Buffer.from(audioBuffer);
    const id = randomUUID().slice(0, 8);
    const wavPath = join(tmpdir(), `vf-${id}.wav`);
    const outPath = join(tmpdir(), `vf-${id}`);
    await writeFile(wavPath, buf);

    try {
      return await this.runWhisperCpp(binaryPath, wavPath, modelPath, outPath);
    } finally {
      await unlink(wavPath).catch(() => {});
      await unlink(outPath + '.txt').catch(() => {});
    }
  }

  private async runWhisperCpp(
    binaryPath: string,
    wavPath: string,
    modelPath: string,
    outPath: string
  ): Promise<TranscriptionResult> {
    const { execFile } = require('child_process');
    const { readFile } = require('fs/promises');
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const cpuCount = require('os').cpus().length;
      const threads = Math.max(1, Math.floor(cpuCount / 2));

      const args = [
        '-m', modelPath,
        '-f', wavPath,
        '-otxt',
        '-of', outPath,
        '--no-timestamps',
        '-t', String(threads),
      ];

      log.info(`Running whisper-cli (${threads} threads): ${binaryPath}`);

      const whisperDir = this.getBundledDir();
      const env = {
        ...process.env,
        PATH: whisperDir + ';' + (process.env.PATH || ''),
      };

      execFile(binaryPath, args, { timeout: 30000, cwd: whisperDir, env }, async (error: any, stdout: string, stderr: string) => {
        const elapsed = Date.now() - start;

        if (error) {
          log.error(`whisper-cli failed (${elapsed}ms):`, error.message);
          reject(new Error(`Transcription failed (${elapsed}ms): ${error.message}`));
          return;
        }

        try {
          const text = await readFile(outPath + '.txt', 'utf-8');
          const trimmed = text.trim();
          log.info(`CLI transcription done in ${elapsed}ms: "${trimmed}"`);
          resolve({ text: trimmed, duration: elapsed / 1000 });
        } catch {
          const text = stdout.trim();
          log.info(`CLI transcription done in ${elapsed}ms (stdout): "${text}"`);
          resolve({ text, duration: elapsed / 1000 });
        }
      });
    });
  }

  private listDir(dir: string): string[] {
    try {
      return readdirSync(dir);
    } catch {
      return ['(directory not found)'];
    }
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(dest);
      const get = (downloadUrl: string) => {
        const client = downloadUrl.startsWith('https') ? https : http;
        client.get(downloadUrl, {
          headers: { 'User-Agent': 'VoiceFlow/1.0' }
        }, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            const redirect = response.headers.location;
            if (redirect) { get(redirect); return; }
          }
          if (response.statusCode && response.statusCode >= 400) {
            file.close();
            reject(new Error(`Download failed: HTTP ${response.statusCode}`));
            return;
          }
          response.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => { file.close(); reject(err); });
      };
      get(url);
    });
  }
}

/** Shutdown the persistent whisper-server process */
export function shutdownWhisperServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!serverProcess || serverProcess.killed) {
      serverProcess = null;
      serverReady = false;
      serverStarting = false;
      resolve();
      return;
    }

    log.info('Shutting down whisper-server...');

    const timeout = setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        log.warn('whisper-server did not exit gracefully, killing...');
        serverProcess.kill('SIGKILL');
      }
      serverProcess = null;
      serverReady = false;
      serverStarting = false;
      resolve();
    }, 3000);

    serverProcess.once('exit', () => {
      clearTimeout(timeout);
      serverProcess = null;
      serverReady = false;
      serverStarting = false;
      log.info('whisper-server shut down');
      resolve();
    });

    serverProcess.kill('SIGTERM');
  });
}
