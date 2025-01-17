import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { env } from '../src/lib/env';

// Define types for our database records
interface Profile {
  username: string;
  avatar_url?: string;
}

interface Channel {
  name: string;
  description?: string;
}

interface Message {
  id: string;
  content: string;
  channel_id: string;
  user_id: string;
  created_at: string;
  profiles: Profile;
  channels: Channel;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY!,
});

const pinecone = new Pinecone({
  apiKey: env.PINECONE_API_KEY!,
});

async function generateEmbeddings() {
  console.log('🔄 Generating embeddings...');

  // Get messages without embeddings
  const { data: messages, error: messagesError } = (await supabase
    .from('messages')
    .select(
      `
      id,
      content,
      channel_id,
      user_id,
      created_at,
      profiles (username),
      channels (name),
      vector_embeddings!left (message_id)
    `
    )
    .is('vector_embeddings.message_id', null)) as { data: Message[] | null; error: any };

  if (messagesError) {
    console.error('Error fetching messages:', messagesError);
    return;
  }

  if (!messages?.length) {
    console.log('✅ No new messages to process');
    return;
  }

  console.log(`📝 Processing ${messages.length} messages...`);

  // Get Pinecone index
  const index = pinecone.index(env.PINECONE_INDEX!);

  // Process messages in batches
  const batchSize = 10;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);

    // Generate embeddings
    const embeddings = await Promise.all(
      batch.map(async (message) => {
        try {
          const response = await openai.embeddings.create({
            input: message.content,
            model: 'text-embedding-3-small',
          });

          return {
            id: message.id,
            values: response.data[0].embedding,
            metadata: {
              content: message.content,
              channelId: message.channel_id,
              userId: message.user_id,
              username: message.profiles.username,
              channelName: message.channels?.name || 'unknown',
              createdAt: message.created_at,
            },
          };
        } catch (error) {
          console.error(`Error generating embedding for message ${message.id}:`, error);
          return null;
        }
      })
    );

    // Filter out failed embeddings and ensure type safety
    const validEmbeddings = embeddings.filter((e): e is NonNullable<typeof e> => e !== null);

    if (validEmbeddings.length) {
      // Upsert to Pinecone
      await index.upsert(validEmbeddings);

      // Update vector_embeddings table
      await supabase.from('vector_embeddings').insert(
        validEmbeddings.map((e) => ({
          message_id: e.id,
          embedding: e.values,
          status: 'completed',
        }))
      );
    }

    console.log(`✓ Processed ${i + batch.length}/${messages.length} messages`);
  }

  console.log('✅ Embedding generation complete!');
}

generateEmbeddings().catch(console.error);
