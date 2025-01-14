import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '../src/lib/env';

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY! // Using service role key for admin operations
);

const pinecone = new Pinecone({
  apiKey: env.PINECONE_API_KEY!,
});

async function syncEmbeddings() {
  console.log('🔄 Syncing embeddings from Pinecone to Supabase...');

  // Get Pinecone index
  const index = pinecone.index(env.PINECONE_INDEX!);

  // Query all vectors from Pinecone
  const queryResponse = await index.query({
    vector: new Array(1536).fill(0), // Dummy vector to fetch all
    topK: 10000, // Fetch all vectors
    includeValues: true, // Important: include the actual embedding values
  });

  if (!queryResponse.matches?.length) {
    console.log('No embeddings found in Pinecone');
    return;
  }

  console.log(`Found ${queryResponse.matches.length} embeddings in Pinecone`);

  // Insert embeddings into Supabase
  const { error } = await supabase.from('vector_embeddings').insert(
    queryResponse.matches.map((match) => ({
      message_id: match.id,
      embedding: match.values,
      status: 'completed',
    }))
  );

  if (error) {
    console.error('Error inserting embeddings into Supabase:', error);
    return;
  }

  console.log('✅ Successfully synced embeddings to Supabase!');
}

syncEmbeddings().catch(console.error);
