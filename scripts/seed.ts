import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log('🌱 Seeding database...');

  // Try to sign in first, if that fails, create a new user
  let userId: string;
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'testpassword123',
  });

  if (signInError) {
    // If sign in fails, try to create a new user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'testpassword123',
      options: {
        data: {
          username: 'testuser',
        },
      },
    });

    if (signUpError) {
      console.error('Error creating test user:', signUpError);
      return;
    }

    userId = signUpData.user!.id;
    console.log('✓ Created new test user with ID:', userId);
  } else {
    userId = signInData.user.id;
    console.log('✓ Signed in as existing test user with ID:', userId);
  }

  // Get the general channel ID
  const { data: generalChannel } = await supabase
    .from('channels')
    .select('id')
    .eq('name', 'general')
    .single();

  // Create additional test channels
  const { data: newChannels, error: channelsError } = await supabase
    .from('channels')
    .insert([
      {
        name: 'development',
        description: 'Technical discussions and coding help',
        created_by: userId,
      },
      { name: 'random', description: 'Random chat and fun stuff', created_by: userId },
    ])
    .select();

  if (channelsError) {
    console.error('Error creating channels:', channelsError);
    return;
  }

  // Combine general channel with new channels
  const channels = [generalChannel, ...(newChannels || [])];

  // Create test messages
  const { error: messagesError } = await supabase.from('messages').insert([
    {
      content: 'Welcome to ChatGenius! This is a test message in the general channel.',
      channel_id: generalChannel!.id,
      user_id: userId,
    },
    {
      content:
        "Here's a technical question: What's the best way to handle state management in a React application?",
      channel_id: newChannels![0].id,
      user_id: userId,
    },
    {
      content:
        'I prefer using React Query for state management. It handles caching and server state really well!',
      channel_id: newChannels![0].id,
      user_id: userId,
    },
  ]);

  if (messagesError) {
    console.error('Error creating messages:', messagesError);
    return;
  }

  // Add user to channels
  const { error: userChannelsError } = await supabase.from('user_channels').insert(
    channels.map((channel) => ({
      user_id: userId,
      channel_id: channel.id,
      role: 'admin',
    }))
  );

  if (userChannelsError) {
    console.error('Error adding user to channels:', userChannelsError);
    return;
  }

  console.log('✅ Seeding complete!');
  console.log('Test user credentials:');
  console.log('Email: test@example.com');
  console.log('Password: testpassword123');
}

seed().catch(console.error);
