-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their channel memberships" ON user_channels;
DROP POLICY IF EXISTS "Users can view public channel memberships" ON user_channels;
DROP POLICY IF EXISTS "Users can join public channels" ON user_channels;
DROP POLICY IF EXISTS "Users can leave channels" ON user_channels;

-- Allow created_by to be null for the general channel
ALTER TABLE public.channels ALTER COLUMN created_by DROP NOT NULL;

-- Create policies for user_channels table
CREATE POLICY "Users can view their channel memberships" ON user_channels
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view public channel memberships" ON user_channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channels
      WHERE id = channel_id AND NOT is_private
    )
  );

CREATE POLICY "Users can join public channels" ON user_channels
  FOR INSERT WITH CHECK (
    -- Allow users to only insert their own user_id
    user_id = auth.uid() AND
    -- Only allow joining public channels
    EXISTS (
      SELECT 1 FROM channels
      WHERE id = channel_id AND NOT is_private
    )
  );

CREATE POLICY "Users can leave channels" ON user_channels
  FOR DELETE USING (user_id = auth.uid());

-- Ensure general channel exists
INSERT INTO public.channels (id, name, description, is_private, is_direct_message, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'general',
  'General discussion channel',
  false,
  false,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  name = 'general',
  description = 'General discussion channel',
  is_private = false,
  is_direct_message = false;

-- Add function to auto-join users to public channels
CREATE OR REPLACE FUNCTION public.auto_join_public_channels()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_channels (user_id, channel_id)
  SELECT NEW.id, c.id
  FROM public.channels c
  WHERE NOT c.is_private
  ON CONFLICT (user_id, channel_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-joining public channels
DROP TRIGGER IF EXISTS on_user_created_join_public_channels ON public.profiles;
CREATE TRIGGER on_user_created_join_public_channels
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_join_public_channels(); 