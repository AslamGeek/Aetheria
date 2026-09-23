import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is not set. Requests will fail if key is required.');
    }
    client = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return client;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1200
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isTransient =
        err?.status === 503 ||
        err?.status === 429 ||
        err?.code === 503 ||
        err?.code === 429 ||
        String(err).includes('503') ||
        String(err).includes('high demand') ||
        String(err).includes('UNAVAILABLE') ||
        String(err).includes('RESOURCE_EXHAUSTED');

      if (!isTransient || attempt >= maxRetries) {
        throw err;
      }

      const backoff = delayMs * Math.pow(1.5, attempt) + Math.random() * 400;
      console.log(`Transient AI error (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(backoff)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw new Error('Operation failed after maximum retry attempts');
}
