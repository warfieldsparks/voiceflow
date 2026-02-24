import OpenAI from 'openai';
import { TranscriptionProvider, TranscriptionResult } from '../../../shared/types';
import { createLogger } from '../../utils/logger';

const log = createLogger('whisper-cloud');

export class WhisperCloudProvider implements TranscriptionProvider {
  private client: OpenAI | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  updateApiKey(apiKey: string): void {
    if (apiKey !== this.apiKey) {
      this.apiKey = apiKey;
      this.client = apiKey ? new OpenAI({ apiKey }) : null;
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && !!this.client;
  }

  async transcribe(audioBuffer: ArrayBuffer, format = 'webm'): Promise<TranscriptionResult> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized — API key missing');
    }

    const buffer = Buffer.from(audioBuffer);
    const file = new File([buffer], `audio.${format}`, {
      type: format === 'webm' ? 'audio/webm' : `audio/${format}`,
    });

    log.info(`Sending ${buffer.length} bytes to Whisper API...`);

    const response = await this.client.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      response_format: 'verbose_json',
    });

    return {
      text: response.text,
      language: (response as any).language,
      duration: (response as any).duration,
    };
  }
}
