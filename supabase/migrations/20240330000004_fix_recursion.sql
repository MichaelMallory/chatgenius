-- First drop all existing policies
DROP POLICY IF EXISTS "Public channels are viewable by everyone" ON channels;
DROP POLICY IF EXISTS "Anyone can view messages in public channels" ON messages;
DROP POLICY IF EXISTS "Members can view messages in private channels" ON messages;
DROP POLICY IF EXISTS "Members can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can view their channel memberships" ON user_channels;
DROP POLICY IF EXISTS "Users can view public channel memberships" ON user_channels;
DROP POLICY IF EXISTS "Users can join public channels" ON user_channels;
DROP POLICY IF EXISTS "Users can leave channels" ON user_channels;
DROP POLICY IF EXISTS "Enable read access for all users" ON channels;
DROP POLICY IF EXISTS "Enable read access for all users" ON messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON messages;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_channels;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_channels;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON user_channels;
DROP POLICY IF EXISTS "Enable insert for public channels and general" ON user_channels;
DROP POLICY IF EXISTS "Allow reading messages in public channels and general" ON messages;
DROP POLICY IF EXISTS "Allow inserting messages in public channels and general" ON messages;

-- Drop any existing triggers
DROP TRIGGER IF EXISTS on_user_created_join_public_channels ON public.profiles;
DROP FUNCTION IF EXISTS public.auto_join_public_channels();

-- Restore simple, non-recursive policies
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

CREATE POLICY "Channel membership is viewable by channel members" ON user_channels
    FOR SELECT USING (
        user_id = auth.uid() OR
        channel_id = '00000000-0000-0000-0000-000000000000' OR
        EXISTS (
            SELECT 1 FROM user_channels
            WHERE channel_id = user_channels.channel_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join public channels" ON user_channels
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        (
            channel_id = '00000000-0000-0000-0000-000000000000' OR
            EXISTS (
                SELECT 1 FROM channels
                WHERE id = channel_id AND NOT is_private
            )
        )
    );

CREATE POLICY "Users can leave channels" ON user_channels
    FOR DELETE USING (user_id = auth.uid());

-- Ensure general channel exists
INSERT INTO public.channels (id, name, description, is_private, is_direct_message)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'general',
    'General discussion channel',
    false,
    false
)
ON CONFLICT (id) DO UPDATE SET
    name = 'general',
    description = 'General discussion channel',
    is_private = false,
    is_direct_message = false; 