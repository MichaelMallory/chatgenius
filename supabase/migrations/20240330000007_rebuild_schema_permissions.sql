-- First, disable RLS temporarily to clean up
ALTER TABLE channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
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
DROP POLICY IF EXISTS "channel_access" ON channels;
DROP POLICY IF EXISTS "user_channels_select" ON user_channels;
DROP POLICY IF EXISTS "user_channels_insert" ON user_channels;
DROP POLICY IF EXISTS "user_channels_delete" ON user_channels;
DROP POLICY IF EXISTS "message_select" ON messages;
DROP POLICY IF EXISTS "message_insert" ON messages;

-- Re-enable RLS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 1. Channel Policies (Base Level)
-- These policies don't depend on any other tables
CREATE POLICY "channels_base_access" ON channels FOR SELECT
USING (
    NOT is_private OR  -- Public channels visible to all
    id = '00000000-0000-0000-0000-000000000000' OR  -- General channel visible to all
    auth.uid() = created_by OR  -- Creator can see their channels
    (is_direct_message = true AND auth.uid() = ANY(participants))  -- DM participants can see their channels
);

-- 2. User Channels Policies (Depends only on channels)
-- Basic membership visibility
CREATE POLICY "user_channels_base_select" ON user_channels FOR SELECT
USING (
    user_id = auth.uid()  -- Users can see their own memberships
);

-- Public channel membership visibility
CREATE POLICY "user_channels_public_select" ON user_channels FOR SELECT
USING (
    channel_id = '00000000-0000-0000-0000-000000000000' OR  -- General channel memberships visible to all
    EXISTS (
        SELECT 1 FROM channels
        WHERE channels.id = channel_id
        AND NOT channels.is_private  -- Public channel memberships visible to all
    )
);

-- Join channels
CREATE POLICY "user_channels_insert" ON user_channels FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND (  -- Can only insert own membership
        channel_id = '00000000-0000-0000-0000-000000000000' OR  -- Can join general
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

-- Leave channels
CREATE POLICY "user_channels_delete" ON user_channels FOR DELETE
USING (user_id = auth.uid());  -- Can only leave own memberships

-- 3. Message Policies (Depends on channels for public/DM access)
-- Read messages in public channels and DMs
CREATE POLICY "messages_public_select" ON messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM channels
        WHERE channels.id = channel_id
        AND (
            NOT channels.is_private OR  -- Public channel messages
            channels.id = '00000000-0000-0000-0000-000000000000' OR  -- General channel messages
            (channels.is_direct_message AND auth.uid() = ANY(channels.participants))  -- DM messages
        )
    )
);

-- Read messages in private channels where user is a member
CREATE POLICY "messages_private_select" ON messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM user_channels
        WHERE user_channels.channel_id = channel_id
        AND user_channels.user_id = auth.uid()
    )
);

-- Insert messages
CREATE POLICY "messages_insert" ON messages FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND (  -- Can only insert own messages
        EXISTS (
            SELECT 1 FROM channels
            WHERE channels.id = channel_id
            AND (
                NOT channels.is_private OR  -- Can post in public channels
                channels.id = '00000000-0000-0000-0000-000000000000' OR  -- Can post in general
                (channels.is_direct_message AND auth.uid() = ANY(channels.participants))  -- Can post in own DMs
            )
        )
        OR
        EXISTS (
            SELECT 1 FROM user_channels  -- Can post in channels where member
            WHERE user_channels.channel_id = channel_id
            AND user_channels.user_id = auth.uid()
        )
    )
);

-- Update own messages
CREATE POLICY "messages_update" ON messages FOR UPDATE
USING (auth.uid() = user_id);

-- Delete own messages
CREATE POLICY "messages_delete" ON messages FOR DELETE
USING (auth.uid() = user_id); 