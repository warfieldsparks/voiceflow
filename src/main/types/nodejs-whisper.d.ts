declare module '@xenova/transformers' {
  export function pipeline(
    task: string,
    model: string,
    options?: {
      quantized?: boolean;
      progress_callback?: (progress: any) => void;
    }
  ): Promise<any>;
}
