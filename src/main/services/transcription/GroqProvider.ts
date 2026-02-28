import { TranscriptionProvider, TranscriptionResult } from '../../../shared/types';
import { createLogger } from '../../utils/logger';
import http from 'http';
import https from 'https';
import { randomUUID } from 'crypto';

const log = createLogger('groq');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export class GroqProvider implements TranscriptionProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async transcribe(audioBuffer: ArrayBuffer, format = 'wav'): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('Groq API key is not configured. Set it in Settings > Whisper.');
    }

    const start = Date.now();
    const buf = Buffer.from(audioBuffer);
    log.info(`Sending ${buf.length} bytes to Groq Whisper API...`);

    const text = await this.postAudio(buf, format);
    const elapsed = Date.now() - start;
    log.info(`Groq transcription done in ${elapsed}ms: "${text}"`);

    return { text: text.trim(), duration: elapsed / 1000 };
  }

  private postAudio(audioBuffer: Buffer, format: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const boundary = '----VoiceFlowGroq' + randomUUID().slice(0, 8);
      const mimeType = format === 'wav' ? 'audio/wav' : `audio/${format}`;
      const filename = `audio.${format}`;

      // Build multipart form body
      const parts: Buffer[] = [];

      // File part
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`
      ));
      parts.push(audioBuffer);
      parts.push(Buffer.from('\r\n'));

      // Model
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="model"\r\n\r\n` +
        `whisper-large-v3-turbo\r\n`
      ));

      // Language
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="language"\r\n\r\n` +
        `en\r\n`
      ));

      // Temperature
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="temperature"\r\n\r\n` +
        `0\r\n`
      ));

      // Response format
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
        `json\r\n`
      ));

      // End boundary
      parts.push(Buffer.from(`--${boundary}--\r\n`));

      const body = Buffer.concat(parts);

      const url = new URL(GROQ_API_URL);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            log.error(`Groq API error ${res.statusCode}: ${data}`);
            let errorMsg = `Groq API error (HTTP ${res.statusCode})`;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error?.message) errorMsg = parsed.error.message;
            } catch {}
            reject(new Error(errorMsg));
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve(json.text || '');
          } catch {
            resolve(data.trim());
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Groq API request failed: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Groq API request timed out'));
      });
      req.write(body);
      req.end();
    });
  }
}
