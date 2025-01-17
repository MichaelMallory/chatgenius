-- Drop ALL existing policies
DROP POLICY IF EXISTS "channels_base_access" ON channels;
DROP POLICY IF EXISTS "user_channels_base_select" ON user_channels;
DROP POLICY IF EXISTS "user_channels_public_select" ON user_channels;
DROP POLICY IF EXISTS "user_channels_insert" ON user_channels;
DROP POLICY IF EXISTS "user_channels_delete" ON user_channels;
DROP POLICY IF EXISTS "messages_public_select" ON messages;
DROP POLICY IF EXISTS "messages_private_select" ON messages;
DROP POLICY IF EXISTS "message_select" ON messages;
DROP POLICY IF EXISTS "message_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;
DROP POLICY IF EXISTS "Channel membership is viewable by channel members" ON user_channels;
DROP POLICY IF EXISTS "Users can join public channels" ON user_channels;
DROP POLICY IF EXISTS "Users can leave channels" ON user_channels;
DROP POLICY IF EXISTS "Users can view own memberships" ON user_channels;
DROP POLICY IF EXISTS "Users can view public channel memberships" ON user_channels;
DROP POLICY IF EXISTS "Users can leave any channel" ON user_channels;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_channels;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_channels;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON user_channels;
DROP POLICY IF EXISTS "Enable insert for public channels and general" ON user_channels;
DROP POLICY IF EXISTS "Users can join DM channels if they are participants" ON user_channels;
DROP POLICY IF EXISTS "Public channels are viewable by everyone" ON channels;
DROP POLICY IF EXISTS "Enable read access for all users" ON channels;
DROP POLICY IF EXISTS "DM channels are viewable by participants" ON channels;
DROP POLICY IF EXISTS "Channel access policy" ON channels;
DROP POLICY IF EXISTS "Channel members can view messages" ON messages;
DROP POLICY IF EXISTS "Channel members can insert messages" ON messages;
DROP POLICY IF EXISTS "Enable read access for all users" ON messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON messages;
DROP POLICY IF EXISTS "Users can view their channel memberships" ON user_channels;
DROP POLICY IF EXISTS "Message authors can update their messages" ON messages;
DROP POLICY IF EXISTS "Message authors can delete their messages" ON messages;

-- Temporarily disable RLS
ALTER TABLE channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Restore original working policies from initial schema

-- Simple channel access - no recursion
CREATE POLICY "Public channels are viewable by everyone" ON channels
  FOR SELECT USING (NOT is_private OR EXISTS (
    SELECT 1 FROM user_channels WHERE channel_id = id AND user_id = auth.uid()
  ));

-- Simple message access - depends on channels only
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

-- Simple user_channels policies - no recursion
CREATE POLICY "Enable read access for all users" ON user_channels
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON user_channels
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    user_id = auth.uid()
  );

CREATE POLICY "Enable delete for users based on user_id" ON user_channels
  FOR DELETE USING (auth.uid() = user_id);

-- Re-enable RLS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY; 