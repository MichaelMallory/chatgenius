import { Pinecone } from '@pinecone-database/pinecone';
import { env } from './env';
import { generateEmbedding } from './embeddings';

// Constants
const SIMILARITY_THRESHOLD = 0.2; // Lowered from 0.25 to catch more relevant matches

export interface SearchResult {
  messageId: string;
  score: number;
  content: string;
  username: string;
  channelName: string;
  createdAt: string;
  type: 'message';
}

export interface SearchOptions {
  query: string;
  channelId?: string;
  limit?: number;
}

export async function semanticSearch({
  query,
  channelId,
  limit = 10,
}: SearchOptions): Promise<SearchResult[]> {
  try {
    console.log('Generating embedding for query:', query);
    const queryEmbedding = await generateEmbedding(query);

    // Initialize Pinecone client
    const pinecone = new Pinecone({
      apiKey: env.PINECONE_API_KEY!,
    });

    // Get the index
    const index = pinecone.index(env.PINECONE_INDEX!);

    // Query Pinecone
    console.log('Querying Pinecone with filter:', channelId ? { channelId } : 'no filter');
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true,
      filter: channelId ? { channelId } : undefined,
    });

    console.log('Pinecone returned matches:', queryResponse.matches.length);

    // Log all matches for debugging
    queryResponse.matches.forEach((match, i) => {
      console.log(`Match ${i + 1}:`);
      console.log('Score:', match.score);
      console.log('Metadata:', JSON.stringify(match.metadata, null, 2));
    });

    // Transform and return results
    const results = queryResponse.matches
      .filter((match) => {
        const passes = match.score && match.score >= SIMILARITY_THRESHOLD;
        if (!passes) {
          console.log(
            `Filtering out match with score ${match.score} (below threshold ${SIMILARITY_THRESHOLD})`
          );
        }
        return passes;
      })
      .map((match) => {
        const metadata = match.metadata || {};
        return {
          messageId: match.id,
          score: match.score || 0,
          content: (metadata.content as string) || '',
          username: (metadata.username as string) || 'Unknown User',
          channelName: (metadata.channelName as string) || 'Unknown Channel',
          createdAt: (metadata.created_at ||
            metadata.createdAt ||
            new Date().toISOString()) as string,
          type: 'message' as const,
        };
      });

    console.log('Returning results after filtering:', results.length);
    if (results.length > 0) {
      console.log('Top result:', JSON.stringify(results[0], null, 2));
    }
    return results;
  } catch (error) {
    console.error('Error in semantic search:', error);
    throw error; // Let the caller handle the error
  }
}
