declare module 'nodejs-whisper' {
  interface WhisperOptions {
    modelName?: string;
    autoDownloadModelName?: string;
    whisperOptions?: {
      outputInText?: boolean;
      language?: string;
    };
  }

  interface WhisperResult {
    speech: string;
  }

  export function nodewhisper(filePath: string, options: WhisperOptions): Promise<WhisperResult[]>;
}
