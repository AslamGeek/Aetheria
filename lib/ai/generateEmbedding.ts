import { getGeminiClient } from './geminiClient.ts';

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    return [];
  }

  const ai = getGeminiClient();
  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: text.trim(),
    });

    const respAny = response as any;
    const values = respAny.embedding?.values || respAny.embeddings?.[0]?.values;
    if (values && Array.isArray(values)) {
      return values;
    }
    return [];
  } catch (err) {
    console.error('Failed to generate embedding:', err);
    return [];
  }
}

/**
 * Computes cosine similarity between two vector embeddings.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
