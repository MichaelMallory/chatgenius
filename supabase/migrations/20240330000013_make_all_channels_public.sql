-- Drop existing complex policies
DROP POLICY IF EXISTS "channels_base_access" ON channels;
DROP POLICY IF EXISTS "user_channels_insert" ON user_channels;
DROP POLICY IF EXISTS "user_channels_select" ON user_channels;

-- Make all existing channels public (except DMs)
UPDATE public.channels
SET is_private = false
WHERE NOT is_direct_message;

-- Simplified channel access policy
CREATE POLICY "channels_base_access" ON channels FOR SELECT
USING (
    NOT is_private OR  -- Public channels visible to all
    (is_direct_message = true AND auth.uid() = ANY(participants))  -- DM participants can see their channels
);

-- Simplified user_channels policies
CREATE POLICY "user_channels_select" ON user_channels
FOR SELECT USING (true);  -- All channel memberships are visible

CREATE POLICY "user_channels_insert" ON user_channels
FOR INSERT WITH CHECK (
    user_id = auth.uid() AND  -- Can only insert own membership
    EXISTS (
        SELECT 1 FROM channels
        WHERE channels.id = channel_id
        AND (
            NOT channels.is_private OR  -- Can join any public channel
            (channels.is_direct_message AND auth.uid() = ANY(channels.participants))  -- Can join own DMs
        )
    )
);

-- Backfill memberships for all users in all public channels
INSERT INTO public.user_channels (user_id, channel_id, role)
SELECT 
    p.id as user_id,
    c.id as channel_id,
    'member' as role
FROM public.profiles p
CROSS JOIN public.channels c
WHERE NOT c.is_private 
    OR (c.is_direct_message AND p.id = ANY(c.participants))
ON CONFLICT (user_id, channel_id) DO NOTHING;

-- Update handle_new_user function to auto-join all public channels
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

    -- Create profile
    INSERT INTO public.profiles (id, username, full_name, avatar_url)
    VALUES (
        new.id,
        username_val,
        coalesce(new.raw_user_meta_data->>'full_name', username_val),
        new.raw_user_meta_data->>'avatar_url'
    );

    -- Add to all public channels
    INSERT INTO public.user_channels (user_id, channel_id, role)
    SELECT 
        new.id,
        c.id,
        'member'
    FROM public.channels c
    WHERE NOT c.is_private
    ON CONFLICT (user_id, channel_id) DO NOTHING;

    RETURN new;
END;
$$; 