-- Function to create DM channels between users
CREATE OR REPLACE FUNCTION public.create_dm_channel(user1_id uuid, user2_id uuid)
RETURNS uuid AS $$
DECLARE
  channel_id uuid;
BEGIN
  -- Check if DM channel already exists
  SELECT c.id INTO channel_id
  FROM public.channels c
  WHERE c.is_direct_message = true
  AND (
    (c.participants @> ARRAY[user1_id, user2_id]::uuid[] AND array_length(c.participants, 1) = 2)
  );

  -- If no channel exists, create one
  IF channel_id IS NULL THEN
    INSERT INTO public.channels (
      name,
      is_direct_message,
      participants,
      created_by
    ) VALUES (
      'dm-' || LEAST(user1_id::text, user2_id::text) || '-' || GREATEST(user1_id::text, user2_id::text),
      true,
      ARRAY[user1_id, user2_id],
      user1_id
    )
    RETURNING id INTO channel_id;

    -- Add both users to the channel
    INSERT INTO public.user_channels (user_id, channel_id, role)
    SELECT user_id, channel_id, 'member'
    FROM unnest(ARRAY[user1_id, user2_id]) AS user_id;
  END IF;

  RETURN channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ensure a user has DM channels with all other users
CREATE OR REPLACE FUNCTION public.ensure_user_dm_channels(target_user_id uuid)
RETURNS void AS $$
DECLARE
  other_user RECORD;
BEGIN
  -- Create DM channels with all existing users
  FOR other_user IN 
    SELECT id FROM public.profiles 
    WHERE id != target_user_id
  LOOP
    PERFORM public.create_dm_channel(target_user_id, other_user.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function for new users
CREATE OR REPLACE FUNCTION public.on_user_created()
RETURNS trigger AS $$
BEGIN
  -- Create DM channels with all existing users
  PERFORM public.ensure_user_dm_channels(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_user_created_create_dms ON public.profiles;

-- Create trigger for new users
CREATE TRIGGER on_user_created_create_dms
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.on_user_created();

-- Ensure DM channels exist for all current user pairs
DO $$
DECLARE
  user1 RECORD;
  user2 RECORD;
BEGIN
  FOR user1 IN SELECT id FROM public.profiles LOOP
    FOR user2 IN SELECT id FROM public.profiles WHERE id > user1.id LOOP
      PERFORM public.create_dm_channel(user1.id, user2.id);
    END LOOP;
  END LOOP;
END;
$$; 