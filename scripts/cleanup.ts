const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables');
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupDatabase() {
  console.log('Starting database cleanup...');

  try {
    // Delete data in reverse order of dependencies
    console.log('Deleting vector embeddings...');
    await supabase
      .from('vector_embeddings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Deleting archived vector embeddings...');
    await supabase
      .from('archived_vector_embeddings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Deleting reactions...');
    await supabase.from('reactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Deleting files...');
    await supabase.from('files').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Deleting messages...');
    await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Deleting user presence...');
    await supabase
      .from('user_presence')
      .delete()
      .neq('user_id', '00000000-0000-0000-0000-000000000000');

    console.log('Deleting user channels...');
    await supabase
      .from('user_channels')
      .delete()
      .neq('channel_id', '00000000-0000-0000-0000-000000000000');

    console.log('Deleting channels (except general)...');
    await supabase.from('channels').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Deleting profiles...');
    await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Database cleanup completed successfully!');
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupDatabase().catch(console.error);
