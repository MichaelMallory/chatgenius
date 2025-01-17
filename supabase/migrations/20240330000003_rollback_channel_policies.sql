-- Drop ALL existing policies first
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

-- Drop the auto-join trigger and function
DROP TRIGGER IF EXISTS on_user_created_join_public_channels ON public.profiles;
DROP FUNCTION IF EXISTS public.auto_join_public_channels();

-- Create new policies
CREATE POLICY "Enable read access for all users" ON channels
    FOR SELECT USING (true);

-- Message policies
CREATE POLICY "Allow reading messages in public channels and general" ON messages
    FOR SELECT USING (
        channel_id = '00000000-0000-0000-0000-000000000000' OR
        EXISTS (
            SELECT 1 FROM channels
            WHERE id = channel_id AND NOT is_private
        )
    );

CREATE POLICY "Allow inserting messages in public channels and general" ON messages
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND
        (
            channel_id = '00000000-0000-0000-0000-000000000000' OR
            EXISTS (
                SELECT 1 FROM channels
                WHERE id = channel_id AND NOT is_private
            )
        )
    );

-- User channel policies
CREATE POLICY "Enable read access for all users" ON user_channels
    FOR SELECT USING (true);

-- Allow users to join any public channel or the general channel
CREATE POLICY "Enable insert for public channels and general" ON user_channels
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND
        (
            user_id = auth.uid() AND
            (
                channel_id = '00000000-0000-0000-0000-000000000000' OR
                EXISTS (
                    SELECT 1 FROM channels
                    WHERE id = channel_id AND NOT is_private
                )
            )
        )
    );

CREATE POLICY "Enable delete for users based on user_id" ON user_channels
    FOR DELETE USING (auth.uid() = user_id); 