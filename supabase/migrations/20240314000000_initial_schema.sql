-- Create tables
CREATE TABLE IF NOT EXISTS profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  status text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS channels (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  is_private boolean default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  user_id uuid references profiles(id) on delete cascade not null,
  channel_id uuid references channels(id) on delete cascade not null,
  parent_id uuid references messages(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS vector_embeddings (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references messages(id) on delete cascade unique not null,
  embedding vector(1536),
  status text default 'pending' not null,
  error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS user_channels (
  user_id uuid references profiles(id) on delete cascade,
  channel_id uuid references channels(id) on delete cascade,
  role text default 'member' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS reactions (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references messages(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (message_id, user_id, emoji)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Public channels are viewable by everyone" ON channels;
DROP POLICY IF EXISTS "Channel members can view messages" ON messages;
DROP POLICY IF EXISTS "Channel members can insert messages" ON messages;
DROP POLICY IF EXISTS "Message authors can update their messages" ON messages;
DROP POLICY IF EXISTS "Message authors can delete their messages" ON messages;

-- Create policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public channels are viewable by everyone" ON channels
  FOR SELECT USING (NOT is_private OR EXISTS (
    SELECT 1 FROM user_channels WHERE channel_id = id AND user_id = auth.uid()
  ));

CREATE POLICY "Channel members can view messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channels c
      LEFT JOIN user_channels uc ON c.id = uc.channel_id
      WHERE c.id = channel_id
      AND (NOT c.is_private OR uc.user_id = auth.uid())
    )
  );

CREATE POLICY "Channel members can insert messages" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM channels c
      LEFT JOIN user_channels uc ON c.id = uc.channel_id
      WHERE c.id = channel_id
      AND (NOT c.is_private OR uc.user_id = auth.uid())
    )
  );

CREATE POLICY "Message authors can update their messages" ON messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Message authors can delete their messages" ON messages
  FOR DELETE USING (auth.uid() = user_id);

-- Create functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.raw_user_meta_data->>'username');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'channels'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE channels;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'reactions'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE reactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'user_channels'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE user_channels;
  END IF;
END $$; 