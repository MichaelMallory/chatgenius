-- Drop ALL existing policies
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
DROP POLICY IF EXISTS "Channel membership is viewable by channel members" ON user_channels;
DROP POLICY IF EXISTS "Channel members can view messages" ON messages;
DROP POLICY IF EXISTS "Channel members can insert messages" ON messages;

-- Drop any existing triggers
DROP TRIGGER IF EXISTS on_user_created_join_public_channels ON public.profiles;
DROP FUNCTION IF EXISTS public.auto_join_public_channels();

-- Create the original, simple policies
CREATE POLICY "Enable read access for all users" ON channels
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON messages
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON messages
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON user_channels
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON user_channels
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for users based on user_id" ON user_channels
    FOR DELETE USING (auth.uid() = user_id);

-- Ensure general channel exists with basic setup
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