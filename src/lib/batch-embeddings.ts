import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { getOrCreateIndex } from '@/lib/pinecone';
import { generateEmbeddingsBatch } from '@/lib/embeddings';
import type { Database } from '@/lib/database.types';

// Initialize Supabase client
const supabase = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Constants
const BATCH_SIZE = 100;

interface ProcessingStats {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
}

// Process messages in batches
export async function processMessages(
  startFromId?: string,
  onProgress?: (stats: ProcessingStats) => void
): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // Get Pinecone index
    const index = await getOrCreateIndex();

    // Count total messages
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .gt('id', startFromId || '0')
      .not('content', 'eq', '');

    if (!count) {
      console.log('No messages to process');
      return stats;
    }

    stats.total = count;

    // Process in batches
    let lastId = startFromId || '0';
    let hasMore = true;

    while (hasMore) {
      // Fetch next batch of messages
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, content, channel_id, user_id, created_at, parent_id')
        .gt('id', lastId)
        .not('content', 'eq', '')
        .order('id')
        .limit(BATCH_SIZE);

      if (error) {
        console.error('Error fetching messages:', error);
        break;
      }

      if (!messages || messages.length === 0) {
        hasMore = false;
        break;
      }

      // Update lastId for next iteration
      lastId = messages[messages.length - 1].id;

      // Check which messages already have embeddings
      const { data: existingEmbeddings } = await supabase
        .from('vector_embeddings')
        .select('message_id')
        .in(
          'message_id',
          messages.map((m) => m.id)
        );

      const existingIds = new Set(existingEmbeddings?.map((e) => e.message_id));
      const messagesToProcess = messages.filter((m) => !existingIds.has(m.id));

      if (messagesToProcess.length === 0) {
        stats.skipped += messages.length;
        onProgress?.(stats);
        continue;
      }

      try {
        // Generate embeddings
        const embeddings = await generateEmbeddingsBatch(
          messagesToProcess.map((m) => m.content),
          (completed, total) => {
            console.log(`Batch progress: ${completed}/${total}`);
          }
        );

        // Prepare vectors for Pinecone
        const vectors = messagesToProcess.map((message, i) => ({
          id: message.id,
          values: embeddings[i],
          metadata: {
            messageId: message.id,
            channelId: message.channel_id,
            userId: message.user_id,
            content: message.content,
            createdAt: message.created_at,
            parentId: message.parent_id,
          },
        }));

        // Store in Pinecone
        await index.upsert(vectors);

        // Store in Supabase
        const { error: upsertError } = await supabase.from('vector_embeddings').upsert(
          vectors.map((v) => ({
            message_id: v.id,
            embedding: v.values,
            metadata: v.metadata,
            status: 'completed',
          }))
        );

        if (upsertError) {
          console.error('Error storing embeddings in Supabase:', upsertError);
          stats.failed += messagesToProcess.length;
        } else {
          stats.completed += messagesToProcess.length;
          stats.skipped += messages.length - messagesToProcess.length;
        }
      } catch (error) {
        console.error('Error processing batch:', error);
        stats.failed += messagesToProcess.length;
        stats.skipped += messages.length - messagesToProcess.length;
      }

      onProgress?.(stats);
    }

    return stats;
  } catch (error) {
    console.error('Error in batch processing:', error);
    throw error;
  }
}

// Resume processing from last processed message
export async function resumeProcessing(
  onProgress?: (stats: ProcessingStats) => void
): Promise<ProcessingStats> {
  // Get the last processed message ID
  const { data: lastEmbedding } = await supabase
    .from('vector_embeddings')
    .select('message_id')
    .order('message_id', { ascending: false })
    .limit(1);

  const startFromId = lastEmbedding?.[0]?.message_id;

  return processMessages(startFromId, onProgress);
}
