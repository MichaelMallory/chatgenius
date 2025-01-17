-- Ensure all existing users have access to the general channel
WITH general_channel AS (
  SELECT id FROM public.channels WHERE name = 'general' LIMIT 1
)
INSERT INTO public.user_channels (user_id, channel_id, role)
SELECT 
  p.id as user_id,
  (SELECT id FROM general_channel) as channel_id,
  'member' as role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_channels uc
  WHERE uc.user_id = p.id 
  AND uc.channel_id = (SELECT id FROM general_channel)
);

-- Add a trigger to ensure new users are automatically added to the general channel
CREATE OR REPLACE FUNCTION public.ensure_general_channel_access()
RETURNS trigger AS $$
DECLARE
  general_channel_id uuid;
BEGIN
  SELECT id INTO general_channel_id FROM public.channels WHERE name = 'general' LIMIT 1;
  
  INSERT INTO public.user_channels (user_id, channel_id, role)
  VALUES (NEW.id, general_channel_id, 'member')
  ON CONFLICT (user_id, channel_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_user_created_join_general ON public.profiles;

-- Create trigger for auto-joining general channel
CREATE TRIGGER on_user_created_join_general
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_general_channel_access(); 