import OpenAI from 'openai';
import { env } from '@/lib/env';
import { exponentialBackoff } from '@/lib/utils/backoff';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY!,
});

// Constants
const MAX_RETRIES = 3;
const MAX_TOKENS = 8191; // OpenAI's text-embedding-3-small token limit
const BATCH_SIZE = 100; // Process messages in batches of 100

// Clean and preprocess text for embedding
export function preprocessText(text: string): string {
  return (
    text
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '$1') // Code
      .replace(/~~(.*?)~~/g, '$1') // Strikethrough
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1') // Links
      // Remove special characters but keep sentence structure
      .replace(/[^\w\s.,!?-]/g, ' ')
      // Replace multiple spaces/newlines with single space
      .replace(/\s+/g, ' ')
      // Trim and limit length (rough approximation of tokens)
      .trim()
      .slice(0, MAX_TOKENS * 4)
  ); // Rough character limit (4 chars per token average)
}

// Generate embeddings for a single text
export async function generateEmbedding(text: string): Promise<number[]> {
  const processedText = preprocessText(text);

  return await exponentialBackoff(
    async () => {
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: processedText,
        });
        return response.data[0].embedding;
      } catch (error) {
        console.error('Error generating embedding:', error);
        throw error; // Let the backoff function handle retries
      }
    },
    {
      maxRetries: MAX_RETRIES,
      baseDelay: 1000,
      maxDelay: 10000,
      onRetry: (error: Error, attempt: number) => {
        console.warn(`Retry attempt ${attempt} for text: "${text.slice(0, 50)}..."`, error);
      },
    }
  );
}

// Generate embeddings for multiple texts in batches
export async function generateEmbeddingsBatch(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  const embeddings: number[][] = [];
  const batches = Math.ceil(texts.length / BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const batchTexts = texts.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const processedTexts = batchTexts.map(preprocessText);

    try {
      const response = await exponentialBackoff(
        async () => {
          try {
            const result = await openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: processedTexts,
            });
            return result;
          } catch (error) {
            console.error('Error generating embeddings batch:', error);
            throw error;
          }
        },
        {
          maxRetries: MAX_RETRIES,
          baseDelay: 1000,
          maxDelay: 10000,
          onRetry: (error: Error, attempt: number) => {
            console.warn(`Retry attempt ${attempt} for batch ${i + 1}/${batches}`, error);
          },
        }
      );

      embeddings.push(...response.data.map((d: OpenAI.Embeddings.Embedding) => d.embedding));
      onProgress?.(Math.min((i + 1) * BATCH_SIZE, texts.length), texts.length);
    } catch (error) {
      console.error(`Failed to generate embeddings for batch ${i + 1}/${batches}:`, error);
      throw error;
    }
  }

  return embeddings;
}
