import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '@/lib/env';

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: env.PINECONE_API_KEY!,
});

// Get or create index
export async function getOrCreateIndex() {
  const indexName = env.PINECONE_INDEX!;
  const dimension = 1536; // OpenAI's text-embedding-3-small dimension

  try {
    // Try to get the index
    const index = pinecone.index(indexName);
    const description = await pinecone.describeIndex(indexName);

    // Verify index configuration
    if (description.dimension !== dimension) {
      throw new Error(
        `Index dimension mismatch. Expected ${dimension}, got ${description.dimension}`
      );
    }

    return index;
  } catch (error) {
    if ((error as Error).message.includes('index not found')) {
      // Create the index if it doesn't exist
      await pinecone.createIndex({
        name: indexName,
        dimension,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-west-2',
          },
        },
      });

      // Wait for index initialization (usually takes 1-2 minutes)
      let isReady = false;
      while (!isReady) {
        const description = await pinecone.describeIndex(indexName);
        isReady = description.status.ready;
        if (!isReady) {
          await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
        }
      }

      return pinecone.index(indexName);
    }
    throw error;
  }
}

// Get metadata type for our vectors
export type MessageMetadata = {
  messageId: string;
  channelId: string;
  userId: string;
  content: string;
  createdAt: string;
  parentId?: string;
};

// Helper function to upsert vectors
export async function upsertVectors(
  index: ReturnType<typeof pinecone.index>,
  vectors: Array<{
    id: string;
    values: number[];
    metadata: MessageMetadata;
  }>
) {
  try {
    await index.upsert(vectors);
    return true;
  } catch (error) {
    console.error('Error upserting vectors:', error);
    return false;
  }
}

// Helper function to delete vectors
export async function deleteVectors(index: ReturnType<typeof pinecone.index>, ids: string[]) {
  try {
    await index.deleteMany(ids);
    return true;
  } catch (error) {
    console.error('Error deleting vectors:', error);
    return false;
  }
}

// Helper function to query vectors
export async function queryVectors(
  index: ReturnType<typeof pinecone.index>,
  queryVector: number[],
  topK: number = 5,
  filter?: { channelId?: string }
) {
  try {
    const results = await index.query({
      vector: queryVector,
      topK,
      filter,
      includeMetadata: true,
    });
    return results.matches;
  } catch (error) {
    console.error('Error querying vectors:', error);
    return [];
  }
}
