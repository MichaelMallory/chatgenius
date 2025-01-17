import { faker } from '@faker-js/faker';
import { createClient } from '@supabase/supabase-js';
import { parseConversations } from './parse-conversations';
import dotenv from 'dotenv';

dotenv.config();

// Verify environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
}

// Verify service role key format
if (!supabaseServiceKey.startsWith('eyJ') || supabaseServiceKey.length < 100) {
  throw new Error('Invalid SUPABASE_SERVICE_ROLE_KEY format. Please check your .env file.');
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Add a helper function to wait
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Seed data configuration
const NUM_USERS = 4;
const NUM_CHANNELS = 4;
const REACTIONS_PER_MESSAGE = 1;
const THREAD_PROBABILITY = 0.2;
const FILE_PROBABILITY = 0.1;

interface User {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface Channel {
  id: string;
  name: string;
  description: string;
  is_private: boolean;
  created_by: string;
}

interface Message {
  id: string;
  content: string;
  user_id: string;
  channel_id: string;
  parent_id: string | null;
  created_at: Date;
  files:
    | {
        id: string;
        name: string;
        size: number;
        type: string;
        url: string;
      }[]
    | null;
}

// User personalities and their typical responses
interface UserPersonality {
  style: string;
  phrases: string[];
  reactions: string[];
}

const userPersonalities: Record<string, UserPersonality> = {
  alice: {
    style: 'Enthusiastic and supportive team lead',
    phrases: [
      "That's a fantastic point! 🌟",
      'I love how everyone is contributing to this discussion!',
      "Let's explore this idea further.",
      'Great progress, team!',
      'I can help coordinate this if needed.',
    ],
    reactions: ['🌟', '👏', '💪', '🙌', '✨'],
  },
  bob: {
    style: 'Detail-oriented and analytical',
    phrases: [
      'Let me break this down...',
      'Have we considered all the variables?',
      'Based on my analysis...',
      'The data suggests that...',
      'We should document this for future reference.',
    ],
    reactions: ['🤔', '📊', '✅', '💡', '📝'],
  },
  charlie: {
    style: 'Creative and out-of-the-box thinker',
    phrases: [
      "Here's a wild idea...",
      'What if we tried something completely different?',
      'This reminds me of an interesting concept...',
      'We could approach this from another angle.',
      'I was brainstorming and thought...',
    ],
    reactions: ['🎨', '🌈', '🚀', '💫', '🎯'],
  },
  diana: {
    style: 'Practical and solution-focused',
    phrases: [
      "Let's focus on what we can implement now.",
      'I have a practical solution for this.',
      'We could start with a small pilot...',
      "Here's what has worked in my experience.",
      "That sounds doable, let's plan the steps.",
    ],
    reactions: ['👍', '⚡', '🎯', '💼', '🔨'],
  },
};

// Channel topics and their content generators
interface ChannelTopic {
  name: string;
  description: string;
}

const channelTopics: ChannelTopic[] = [
  {
    name: 'travel-planning',
    description: 'Discussing travel destinations and trip planning',
  },
  {
    name: 'sports-chat',
    description: 'Sports discussion and game analysis',
  },
  {
    name: 'food-and-cooking',
    description: 'Recipe sharing and cooking discussions',
  },
  {
    name: 'book-club',
    description: 'Book recommendations and discussions',
  },
];

// Generate realistic file attachments
const generateFile = () => {
  const fileTypes = [
    { ext: 'png', type: 'image/png' },
    { ext: 'jpg', type: 'image/jpeg' },
    { ext: 'pdf', type: 'application/pdf' },
    { ext: 'doc', type: 'application/msword' },
    { ext: 'txt', type: 'text/plain' },
  ];
  const fileType = faker.helpers.arrayElement(fileTypes);
  const fileName = `${faker.system.fileName()}.${fileType.ext}`;

  return {
    id: faker.string.uuid(),
    name: fileName,
    size: faker.number.int({ min: 1024, max: 5 * 1024 * 1024 }), // 1KB to 5MB
    type: fileType.type,
    url: fileType.type.startsWith('image/')
      ? `https://picsum.photos/seed/${faker.number.int({ min: 1, max: 1000 })}/200/200`
      : `https://example.com/files/${faker.string.uuid()}`,
  };
};

// Add general channel configuration
const GENERAL_CHANNEL: Channel = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'general',
  description:
    'Welcome to the general channel! This is a space for everyone to communicate and collaborate.',
  is_private: false,
  created_by: '', // Will be set to the first user's ID during seeding
};

async function createGeneralChannel(firstUserId: string) {
  console.log('Creating general channel...');
  const { error: channelError } = await supabase.from('channels').upsert(
    {
      ...GENERAL_CHANNEL,
      created_by: firstUserId,
    },
    {
      onConflict: 'id',
      ignoreDuplicates: false,
    }
  );

  if (channelError) {
    console.error('Error creating general channel:', channelError);
    throw channelError;
  }

  return GENERAL_CHANNEL.id;
}

// Add a function to verify database access
async function verifyDatabaseAccess() {
  console.log('Verifying database access...');

  // Try to read from the profiles table
  const { data, error } = await supabase.from('profiles').select('count').limit(1);

  if (error) {
    console.error('Error verifying database access:', error);
    throw new Error(`Database access verification failed: ${error.message}`);
  }

  console.log('Database access verified successfully');
}

async function seedDatabase() {
  console.log('Starting database seeding...');

  // Verify database access first
  await verifyDatabaseAccess();

  // First, check what exists in the database
  console.log('Checking existing data...');
  const { data: existingChannels, error: channelsError } = await supabase
    .from('channels')
    .select('name, id');

  if (channelsError) {
    console.error('Error checking channels:', channelsError);
    throw channelsError;
  }

  console.log('Existing channels:', existingChannels);

  // Delete existing data first
  console.log('Cleaning up existing data...');
  try {
    // First delete all messages and reactions
    console.log('Deleting reactions...');
    const { error: reactionsError } = await supabase
      .from('reactions')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000');
    if (reactionsError) throw reactionsError;

    console.log('Deleting messages...');
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000');
    if (messagesError) throw messagesError;

    console.log('Deleting user channels...');
    const { error: userChannelsError } = await supabase
      .from('user_channels')
      .delete()
      .gte('user_id', '00000000-0000-0000-0000-000000000000');
    if (userChannelsError) throw userChannelsError;

    console.log('Deleting channels...');
    const { error: channelsError } = await supabase
      .from('channels')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000');
    if (channelsError) throw channelsError;

    // Get existing users first
    const {
      data: { users: existingUsers },
      error: listError,
    } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    // Now delete profiles
    console.log('Deleting profiles...');
    const testEmails = [
      'alice@example.com',
      'bob@example.com',
      'charlie@example.com',
      'diana@example.com',
    ];

    for (const email of testEmails) {
      const userToDelete = existingUsers.find((u) => u.email === email);
      if (userToDelete) {
        console.log(`Deleting profile for ${email}...`);
        const { error: deleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userToDelete.id);

        if (deleteError) {
          console.warn(`Warning: Could not delete profile for ${email}:`, deleteError);
        } else {
          console.log(`✓ Deleted profile for ${email}`);
        }
      }
    }

    // Finally delete auth users
    console.log('Deleting auth users...');
    for (const email of testEmails) {
      const userToDelete = existingUsers.find((u) => u.email === email);
      if (userToDelete) {
        console.log(`Deleting auth user ${email}...`);
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userToDelete.id);
        if (deleteError) {
          console.warn(`Warning: Could not delete auth user ${email}:`, deleteError);
        } else {
          console.log(`✓ Deleted auth user ${email}`);
        }
      }
    }

    // Force delete any remaining profiles
    console.log('Force deleting any remaining profiles...');
    const { error: profilesError } = await supabase
      .from('profiles')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000');
    if (profilesError) throw profilesError;

    // Verify cleanup
    console.log('Verifying cleanup...');
    const { data: remainingProfiles, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, username');

    if (profileCheckError) throw profileCheckError;

    if (remainingProfiles && remainingProfiles.length > 0) {
      console.log('Warning: These profiles still exist:', remainingProfiles);
      throw new Error('Cleanup failed: Some profiles still exist');
    }

    const { data: remainingChannels, error: verifyError } = await supabase
      .from('channels')
      .select('name, id');

    if (verifyError) throw verifyError;

    if (remainingChannels && remainingChannels.length > 0) {
      console.log('Warning: These channels could not be deleted:', remainingChannels);
      throw new Error('Cleanup failed: Some channels still exist');
    }

    console.log('Cleanup completed and verified');

    // Add a delay after cleanup to ensure everything is properly cleaned up
    console.log('Waiting for cleanup to settle...');
    await wait(2000);
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }

  // Create users first
  console.log('Creating users...');
  const users: User[] = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const email = `${Object.keys(userPersonalities)[i]}@example.com`;
    console.log(`Creating user ${email}...`);
    try {
      // Try creating the user with more detailed error handling
      const { data: authData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true,
        user_metadata: {
          username: email.split('@')[0],
        },
      });

      if (createError) {
        console.error(`Detailed error creating user ${email}:`, {
          message: createError.message,
          status: createError.status,
          name: createError.name,
          stack: createError.stack,
        });
        throw createError;
      }

      if (!authData?.user) {
        console.error(`No user data returned for ${email}`);
        throw new Error('User creation failed - no user data returned');
      }

      const userId = authData.user.id;
      console.log(`Successfully created auth user ${email} with ID ${userId}`);

      const username = email.split('@')[0];
      console.log(`Creating/updating profile for ${username}...`);

      // Use upsert instead of insert for the profile
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: userId,
          username,
          avatar_url: null,
        },
        {
          onConflict: 'id',
        }
      );

      if (profileError) {
        console.error(`Error creating profile for ${username}:`, profileError);
        throw profileError;
      }

      console.log(`Successfully created/updated profile for ${username}`);

      users.push({
        id: userId,
        username,
        avatar_url: null,
      });
    } catch (error) {
      console.error(`Failed to create user ${email}:`, error);
      throw error;
    }
  }

  // Create general channel first
  const generalChannelId = await createGeneralChannel(users[0].id);

  // Add all users to general channel
  for (const user of users) {
    const { error: membershipError } = await supabase.from('user_channels').insert({
      user_id: user.id,
      channel_id: generalChannelId,
    });

    if (membershipError) throw membershipError;
  }

  // Create other channels
  console.log('Creating channels...');
  const channels: Channel[] = [];

  // Create all topic channels
  for (let i = 0; i < channelTopics.length; i++) {
    const channel: Channel = {
      id: faker.string.uuid(),
      name: channelTopics[i].name.toLowerCase().replace(/\s+/g, '-'),
      description: channelTopics[i].description,
      is_private: Math.random() < 0.3, // 30% chance of being private
      created_by: users[Math.floor(Math.random() * users.length)].id,
    };
    channels.push(channel);
  }

  // Insert the channels into the database
  console.log('Inserting channels into database...');
  const { error: insertChannelsError } = await supabase.from('channels').insert(channels);

  if (insertChannelsError) {
    console.error('Error inserting channels:', insertChannelsError);
    throw insertChannelsError;
  }

  // Add users to channels
  console.log('Adding users to channels...');
  for (const channel of channels) {
    // Add a random subset of users to each channel
    const channelUsers = faker.helpers.arrayElements(
      users,
      faker.number.int({ min: 2, max: users.length })
    );

    for (const user of channelUsers) {
      const { error: membershipError } = await supabase.from('user_channels').insert({
        user_id: user.id,
        channel_id: channel.id,
      });

      if (membershipError) {
        console.error(
          `Error adding user ${user.username} to channel ${channel.name}:`,
          membershipError
        );
        throw membershipError;
      }
    }
  }

  // Load and insert the real conversations
  console.log('Loading conversation data...');
  const conversations = parseConversations('conversations');

  // Insert messages for each channel
  console.log('Creating messages...');
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Start from 1 week ago

  for (const channel of channels) {
    const channelMessages = conversations[channel.name] || [];

    // Calculate time increment to spread messages over the week
    const totalMessages = channelMessages.length;
    const timeIncrementMs = (7 * 24 * 60 * 60 * 1000) / (totalMessages + 1); // Spread over 1 week

    console.log(`Creating ${totalMessages} messages for channel ${channel.name}...`);

    // Process messages in order from the conversation file
    for (let i = 0; i < channelMessages.length; i++) {
      const message = channelMessages[i];
      const user = users.find((u) => u.username === message.username);
      if (!user) continue;

      // Calculate message timestamp
      // Add some random minutes (0-30) to make it more realistic
      const randomMinutes = faker.number.int({ min: 0, max: 30 }) * 60 * 1000;
      const messageTime = new Date(oneWeekAgo.getTime() + i * timeIncrementMs + randomMinutes);

      const messageData = {
        id: faker.string.uuid(),
        content: message.content,
        user_id: user.id,
        channel_id: channel.id,
        parent_id: null,
        created_at: messageTime,
        files: null,
      };

      const { error: messageError } = await supabase.from('messages').insert([messageData]);
      if (messageError) {
        console.error(`Error creating message in ${channel.name}:`, messageError);
        throw messageError;
      }

      // Add random reactions from other users (excluding the message author)
      if (faker.datatype.boolean({ probability: 0.3 })) {
        const potentialReactors = users.filter((u) => u.id !== user.id);
        const numReactions = faker.number.int({ min: 1, max: 2 });
        const reactors = faker.helpers.arrayElements(potentialReactors, numReactions);

        const reactions = reactors.map((reactor) => ({
          id: faker.string.uuid(),
          message_id: messageData.id,
          user_id: reactor.id,
          emoji: faker.helpers.arrayElement(userPersonalities[reactor.username].reactions),
          // Set reaction time to a few minutes after the message
          created_at: new Date(
            messageTime.getTime() + faker.number.int({ min: 1, max: 10 }) * 60 * 1000
          ),
        }));

        const { error: reactionError } = await supabase.from('reactions').insert(reactions);
        if (reactionError) {
          console.error(`Error creating reactions in ${channel.name}:`, reactionError);
          throw reactionError;
        }
      }

      // Log progress every 10 messages
      if ((i + 1) % 10 === 0) {
        console.log(`Created ${i + 1}/${totalMessages} messages in ${channel.name}`);
      }
    }

    console.log(`✓ Completed creating messages for ${channel.name}`);
  }

  console.log('Database seeding completed!');
}

// Export the function properly
export { seedDatabase };
