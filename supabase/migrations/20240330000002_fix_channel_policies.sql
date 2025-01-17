-- Drop existing policies
DROP POLICY IF EXISTS "Public channels are viewable by everyone" ON channels;
DROP POLICY IF EXISTS "Channel members can view messages" ON messages;
DROP POLICY IF EXISTS "Channel members can insert messages" ON messages;

-- Create more permissive policies for channels
CREATE POLICY "Public channels are viewable by everyone" ON channels
  FOR SELECT USING (true);

-- Create more permissive policies for messages
CREATE POLICY "Anyone can view messages in public channels" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_id
      AND NOT c.is_private
    )
  );

CREATE POLICY "Members can view messages in private channels" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channels c
      JOIN user_channels uc ON c.id = uc.channel_id
      WHERE c.id = channel_id
      AND c.is_private
      AND uc.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert messages" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM channels c
      LEFT JOIN user_channels uc ON c.id = uc.channel_id
      WHERE c.id = channel_id
      AND (NOT c.is_private OR uc.user_id = auth.uid())
    )
  ); 