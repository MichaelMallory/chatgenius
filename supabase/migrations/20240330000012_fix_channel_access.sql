-- Fix handle_new_user function to use correct general channel ID
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  username_val text;
BEGIN
  -- Set username from metadata or use email
  username_val := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );

  -- Create profile with fallbacks for optional fields
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    username_val,
    coalesce(new.raw_user_meta_data->>'full_name', username_val),
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Add to all public channels and general channel
  INSERT INTO public.user_channels (user_id, channel_id, role)
  SELECT 
    new.id,
    c.id,
    'member'
  FROM public.channels c
  WHERE NOT c.is_private OR c.id = '00000000-0000-0000-0000-000000000001'
  ON CONFLICT (user_id, channel_id) DO NOTHING;

  return new;
END;
$$;

-- Create function to add users to new channels
CREATE OR REPLACE FUNCTION public.handle_new_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For non-private, non-DM channels, add all existing users
  IF NOT NEW.is_private AND NOT NEW.is_direct_message THEN
    INSERT INTO public.user_channels (user_id, channel_id, role)
    SELECT 
      p.id,
      NEW.id,
      'member'
    FROM public.profiles p
    ON CONFLICT (user_id, channel_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new channels
DROP TRIGGER IF EXISTS on_channel_created ON public.channels;
CREATE TRIGGER on_channel_created
  AFTER INSERT ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_channel();

-- Backfill existing channel memberships
INSERT INTO public.user_channels (user_id, channel_id, role)
SELECT 
  p.id as user_id,
  c.id as channel_id,
  'member' as role
FROM public.profiles p
CROSS JOIN public.channels c
WHERE NOT c.is_private 
   OR c.id = '00000000-0000-0000-0000-000000000001'
   OR (c.is_direct_message AND p.id = ANY(c.participants))
ON CONFLICT (user_id, channel_id) DO NOTHING;

-- Update RLS policies to ensure access
DROP POLICY IF EXISTS "user_channels_insert" ON user_channels;
CREATE POLICY "user_channels_insert" ON user_channels
FOR INSERT WITH CHECK (
    user_id = auth.uid() AND (  -- Can only insert own membership
        channel_id = '00000000-0000-0000-0000-000000000001' OR  -- Can join general
        EXISTS (
            SELECT 1 FROM channels
            WHERE channels.id = channel_id
            AND (
                NOT channels.is_private OR  -- Can join public channels
                (channels.is_direct_message AND auth.uid() = ANY(channels.participants))  -- Can join own DMs
            )
        )
    )
);

-- Update channel access policy
DROP POLICY IF EXISTS "channels_base_access" ON channels;
CREATE POLICY "channels_base_access" ON channels FOR SELECT
USING (
    NOT is_private OR  -- Public channels visible to all
    id = '00000000-0000-0000-0000-000000000001' OR  -- General channel visible to all
    auth.uid() = created_by OR  -- Creator can see their channels
    (is_direct_message = true AND auth.uid() = ANY(participants))  -- DM participants can see their channels
); 