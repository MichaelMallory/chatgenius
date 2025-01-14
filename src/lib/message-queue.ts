import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { getOrCreateIndex } from '@/lib/pinecone';
import { generateEmbedding } from '@/lib/embeddings';
import type { Database } from '@/lib/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface QueuedMessage {
  id: string;
  content: string;
  channel_id: string;
  user_id: string;
  created_at: string;
  parent_id: string | null;
  retries?: number;
}

class MessageQueue {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private pineconeIndex: Awaited<ReturnType<typeof getOrCreateIndex>> | null = null;

  // Singleton instance
  private static instance: MessageQueue;
  public static getInstance(): MessageQueue {
    if (!MessageQueue.instance) {
      MessageQueue.instance = new MessageQueue();
    }
    return MessageQueue.instance;
  }

  private constructor() {
    // Initialize Pinecone index
    this.initializePinecone();
    // Set up real-time subscription
    this.subscribeToMessages();
  }

  private async initializePinecone() {
    try {
      this.pineconeIndex = await getOrCreateIndex();
    } catch (error) {
      console.error('Failed to initialize Pinecone index:', error);
    }
  }

  private subscribeToMessages() {
    const channel = supabase
      .channel('new_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const message = payload.new as QueuedMessage;
          if (message.content && message.content.trim() !== '') {
            await this.enqueueMessage(message);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Error in message subscription');
          // Attempt to resubscribe after a delay
          setTimeout(() => {
            channel.subscribe();
          }, RETRY_DELAY);
        }
      });
  }

  private async enqueueMessage(message: QueuedMessage) {
    // Check if message already has an embedding
    const { data: existing } = await supabase
      .from('vector_embeddings')
      .select('id')
      .eq('message_id', message.id)
      .maybeSingle();

    if (existing) {
      console.log(`Message ${message.id} already has an embedding`);
      return;
    }

    // Add message to queue
    this.queue.push({ ...message, retries: 0 });
    console.log(`Enqueued message ${message.id} for embedding generation`);

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0 || !this.pineconeIndex) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const message = this.queue[0];

      try {
        // Generate embedding
        const embedding = await generateEmbedding(message.content);

        // Prepare metadata without undefined values
        const metadata = {
          messageId: message.id,
          channelId: message.channel_id,
          userId: message.user_id,
          content: message.content,
          createdAt: message.created_at,
          ...(message.parent_id ? { parentId: message.parent_id } : {}),
        };

        // Store in Pinecone
        await this.pineconeIndex.upsert([
          {
            id: message.id,
            values: embedding,
            metadata,
          },
        ]);

        // Store in Supabase
        const { error: upsertError } = await supabase.from('vector_embeddings').upsert({
          message_id: message.id,
          embedding,
          metadata,
          status: 'completed',
        });

        if (upsertError) {
          throw upsertError;
        }

        // Remove successfully processed message
        this.queue.shift();
        console.log(`Successfully processed message ${message.id}`);
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);

        // Handle retry logic
        const retries = message.retries || 0;

        if (retries < MAX_RETRIES) {
          // Move to end of queue for retry
          const failedMessage = this.queue.shift()!;
          failedMessage.retries = retries + 1;
          this.queue.push(failedMessage);
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retries)));
        } else {
          // Mark as failed in database
          await supabase.from('vector_embeddings').upsert({
            message_id: message.id,
            status: 'failed',
            error: String(error),
          });
          // Remove failed message from queue
          this.queue.shift();
          console.error(`Failed to process message ${message.id} after ${MAX_RETRIES} retries`);
        }
      }
    }

    this.processing = false;
  }
}

// Export singleton instance
export const messageQueue = MessageQueue.getInstance();
