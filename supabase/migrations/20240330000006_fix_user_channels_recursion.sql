-- Drop ALL existing policies
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

-- Simple channel access policy
CREATE POLICY "channel_access" ON channels
    FOR ALL USING (
        NOT is_private OR  -- Public channels accessible to all
        id = '00000000-0000-0000-0000-000000000000' OR  -- General channel accessible to all
        (is_direct_message = true AND auth.uid() = ANY(participants)) OR  -- DM access
        auth.uid() = created_by  -- Creator access
    );

-- Simple user_channels policies
CREATE POLICY "user_channels_select" ON user_channels
    FOR SELECT USING (
        channel_id = '00000000-0000-0000-0000-000000000000' OR  -- Anyone can view general channel memberships
        user_id = auth.uid() OR  -- Users can see their own memberships
        EXISTS (  -- Can see memberships of public channels
            SELECT 1 FROM channels 
            WHERE id = channel_id AND NOT is_private
        )
    );

CREATE POLICY "user_channels_insert" ON user_channels
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND (  -- Can only insert own membership
            channel_id = '00000000-0000-0000-0000-000000000000' OR  -- Can join general
            EXISTS (  -- Can join public channels or DMs they're part of
                SELECT 1 FROM channels 
                WHERE id = channel_id AND (
                    NOT is_private OR 
                    (is_direct_message = true AND auth.uid() = ANY(participants))
                )
            )
        )
    );

CREATE POLICY "user_channels_delete" ON user_channels
    FOR DELETE USING (user_id = auth.uid());

-- Message policies
CREATE POLICY "message_select" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM channels c
            WHERE c.id = channel_id AND (
                NOT c.is_private OR  -- Public channel messages
                c.id = '00000000-0000-0000-0000-000000000000' OR  -- General channel messages
                (c.is_direct_message = true AND auth.uid() = ANY(c.participants)) OR  -- DM messages
                auth.uid() = c.created_by OR  -- Channel creator's messages
                EXISTS (  -- Member access to private channel messages
                    SELECT 1 FROM user_channels uc
                    WHERE uc.channel_id = c.id AND uc.user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "message_insert" ON messages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND  -- Can only insert own messages
        EXISTS (
            SELECT 1 FROM channels c
            WHERE c.id = channel_id AND (
                NOT c.is_private OR  -- Can post in public channels
                c.id = '00000000-0000-0000-0000-000000000000' OR  -- Can post in general
                (c.is_direct_message = true AND auth.uid() = ANY(c.participants)) OR  -- Can post in own DMs
                EXISTS (  -- Can post if member of private channel
                    SELECT 1 FROM user_channels uc
                    WHERE uc.channel_id = c.id AND uc.user_id = auth.uid()
                )
            )
        )
    );

-- Ensure RLS is enabled
ALTER TABLE channels FORCE ROW LEVEL SECURITY;
ALTER TABLE user_channels FORCE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY; 