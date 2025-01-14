const { faker } = require('@faker-js/faker');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Seed data configuration
const NUM_USERS = 4;
const NUM_CHANNELS = 4;
const MESSAGES_PER_CHANNEL = 100;
const REACTIONS_PER_MESSAGE = 1;
const THREAD_PROBABILITY = 0.2;
const FILE_PROBABILITY = 0.1;

interface User {
  id: string;
  email: string;
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
  generateMessage: (username: string) => string;
}

const channelTopics: ChannelTopic[] = [
  {
    name: 'travel-planning',
    description: 'Discussing travel destinations and trip planning',
    generateMessage: (username) => {
      const destinations = [
        'Bali',
        'Japan',
        'Iceland',
        'New Zealand',
        'Costa Rica',
        'Italy',
        'Greece',
        'Thailand',
      ];
      const activities = [
        'hiking',
        'food tours',
        'cultural experiences',
        'adventure sports',
        'relaxation',
        'photography',
      ];
      const topics = [
        `Has anyone been to ${faker.helpers.arrayElement(
          destinations
        )}? Looking for recommendations!`,
        `I found great deals for ${faker.helpers.arrayElement(
          destinations
        )} during ${faker.helpers.arrayElement(['summer', 'winter', 'spring', 'fall'])}!`,
        `The best part about ${faker.helpers.arrayElement(
          destinations
        )} was definitely the ${faker.helpers.arrayElement(activities)}.`,
        `Planning a trip to ${faker.helpers.arrayElement(
          destinations
        )}. Any tips on ${faker.helpers.arrayElement(activities)}?`,
        `Just booked tickets to ${faker.helpers.arrayElement(
          destinations
        )}! So excited about the ${faker.helpers.arrayElement(activities)}!`,
      ];
      return faker.helpers.arrayElement(topics);
    },
  },
  {
    name: 'sports-chat',
    description: 'Sports discussion and game analysis',
    generateMessage: (username) => {
      const sports = ['basketball', 'football', 'soccer', 'tennis', 'baseball'];
      const teams = ['Lakers', 'Warriors', 'Chiefs', 'Eagles', 'Manchester United', 'Liverpool'];
      const topics = [
        `What a game last night! ${faker.helpers.arrayElement(teams)} really showed up!`,
        `Anyone watching the ${faker.helpers.arrayElement(sports)} finals?`,
        `${faker.helpers.arrayElement(teams)} strategy this season has been interesting...`,
        `Predictions for the ${faker.helpers.arrayElement(sports)} championship?`,
        `The new player on ${faker.helpers.arrayElement(teams)} is really making a difference!`,
      ];
      return faker.helpers.arrayElement(topics);
    },
  },
  {
    name: 'food-and-cooking',
    description: 'Recipe sharing and cooking discussions',
    generateMessage: (username) => {
      const cuisines = ['Italian', 'Japanese', 'Mexican', 'Indian', 'Thai', 'Mediterranean'];
      const dishes = ['pasta', 'curry', 'tacos', 'sushi', 'salad', 'soup'];
      const topics = [
        `Just tried making ${faker.helpers.arrayElement(cuisines)} ${faker.helpers.arrayElement(
          dishes
        )}! Here's how it turned out...`,
        `Looking for a good recipe for ${faker.helpers.arrayElement(
          cuisines
        )} ${faker.helpers.arrayElement(dishes)}`,
        `Found this amazing ${faker.helpers.arrayElement(cuisines)} restaurant!`,
        `Any tips for perfecting ${faker.helpers.arrayElement(dishes)}?`,
        `Weekly meal prep featuring ${faker.helpers.arrayElement(cuisines)} dishes!`,
      ];
      return faker.helpers.arrayElement(topics);
    },
  },
  {
    name: 'book-club',
    description: 'Book recommendations and discussions',
    generateMessage: (username) => {
      const genres = ['mystery', 'sci-fi', 'romance', 'non-fiction', 'fantasy'];
      const activities = ['reading', 'book club meeting', 'author talk', 'library visit'];
      const topics = [
        `Currently reading a great ${faker.helpers.arrayElement(genres)} novel!`,
        `Any recommendations for ${faker.helpers.arrayElement(genres)} books?`,
        `Thoughts on the latest ${faker.helpers.arrayElement(genres)} bestseller?`,
        `Planning our next ${faker.helpers.arrayElement(activities)}`,
        `Just finished an amazing ${faker.helpers.arrayElement(genres)} book!`,
      ];
      return faker.helpers.arrayElement(topics);
    },
  },
];

// Generate message based on user personality and channel topic
const generateMessage = (username: string, channelTopic: ChannelTopic) => {
  const personality = userPersonalities[username];
  const baseMessage = channelTopic.generateMessage(username);

  // 30% chance to add a personality-driven phrase
  if (faker.datatype.boolean({ probability: 0.3 })) {
    return `${baseMessage} ${faker.helpers.arrayElement(personality.phrases)}`;
  }

  return baseMessage;
};

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

async function seedDatabase() {
  console.log('Starting database seeding...');

  // Delete existing data first
  console.log('Cleaning up existing data...');
  await supabase.from('reactions').delete().neq('id', '');
  await supabase.from('messages').delete().neq('id', '');
  await supabase.from('user_channels').delete().neq('user_id', '');

  // Delete all channels except the default general channel
  await supabase
    .from('channels')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .neq('name', 'general');

  // Delete existing users
  await supabase.auth.admin
    .listUsers()
    .then(
      async ({ data: { users: existingUsers } }: { data: { users: Array<{ id: string }> } }) => {
        for (const user of existingUsers) {
          await supabase.auth.admin.deleteUser(user.id);
        }
      }
    );
  console.log('Cleanup completed');

  // Create users in auth.users table first
  const users: User[] = [];
  const usernames = ['alice', 'bob', 'charlie', 'diana'];

  for (let i = 0; i < NUM_USERS; i++) {
    const username = usernames[i];
    const email = `${username}@example.com`;
    const password = 'password123'; // Simple password for testing
    const avatar_url = `https://picsum.photos/seed/${username}/200/200`; // Consistent avatar per user

    const {
      data: { user },
      error: signUpError,
    } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        avatar_url,
      },
    });

    if (signUpError) {
      console.error('Error creating user:', signUpError);
      continue;
    }

    if (user) {
      users.push({
        id: user.id,
        email: user.email!,
        username,
        avatar_url,
      });
      console.log(`Created user: ${username}`);
    }
  }

  // Create channels
  const channels: Channel[] = [];

  for (let i = 0; i < NUM_CHANNELS; i++) {
    const topic = channelTopics[i];
    const channelData = {
      id: faker.string.uuid(),
      name: topic.name,
      description: topic.description,
      is_private: false,
      created_by: users[0].id,
    };

    const { data: createdChannel, error } = await supabase
      .from('channels')
      .insert(channelData)
      .select()
      .single();

    if (error) {
      console.error('Error creating channel:', error);
      continue;
    }

    if (createdChannel) {
      channels.push(createdChannel);
      console.log(`Created channel: ${topic.name}`);

      // Add all users to each channel
      for (const user of users) {
        const { error: membershipError } = await supabase.from('user_channels').insert({
          user_id: user.id,
          channel_id: createdChannel.id,
          role: 'member',
        });

        if (membershipError) {
          console.error(
            `Error adding user ${user.username} to channel ${createdChannel.name}:`,
            membershipError
          );
        }
      }
    }
  }

  // Create messages and threads
  for (const channel of channels) {
    const channelTopic = channelTopics.find((t) => t.name === channel.name)!;

    // Create parent messages
    for (let i = 0; i < MESSAGES_PER_CHANNEL; i++) {
      const user = faker.helpers.arrayElement(users);
      const message = {
        id: faker.string.uuid(),
        content: generateMessage(user.username, channelTopic),
        user_id: user.id,
        channel_id: channel.id,
        parent_id: null,
        created_at: faker.date.recent({ days: 30 }),
        files: faker.datatype.boolean({ probability: FILE_PROBABILITY }) ? [generateFile()] : null,
      };

      const { error } = await supabase.from('messages').insert(message);

      if (error) {
        console.error('Error creating message:', error);
        continue;
      }
      console.log(`Created message in channel ${channel.name} with ID ${channel.id}`);

      // Add reactions with personality-based emojis
      const numReactions = faker.number.int({ min: 0, max: REACTIONS_PER_MESSAGE });

      for (let j = 0; j < numReactions; j++) {
        const reactor = faker.helpers.arrayElement(users);
        const { error } = await supabase.from('reactions').insert({
          message_id: message.id,
          user_id: reactor.id,
          emoji: faker.helpers.arrayElement(userPersonalities[reactor.username].reactions),
        });

        if (error) {
          console.error('Error creating reaction:', error);
        }
      }

      // Create thread replies with personality-driven responses
      if (faker.datatype.boolean({ probability: THREAD_PROBABILITY })) {
        const numReplies = faker.number.int({ min: 1, max: 3 });

        for (let j = 0; j < numReplies; j++) {
          const replier = faker.helpers.arrayElement(users);
          const personality = userPersonalities[replier.username];

          const reply = {
            id: faker.string.uuid(),
            content: faker.helpers.arrayElement(personality.phrases),
            user_id: replier.id,
            channel_id: channel.id,
            parent_id: message.id,
            created_at: faker.date.between({
              from: message.created_at,
              to: new Date(),
            }),
            files: null,
          };

          const { error } = await supabase.from('messages').insert(reply);

          if (error) {
            console.error('Error creating reply:', error);
          } else {
            console.log('Created thread reply');
          }
        }
      }
    }
  }

  console.log('Database seeding completed!');
}

// Run the seeding
seedDatabase().catch(console.error);
