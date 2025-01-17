-- Backfill channel memberships for existing users
INSERT INTO public.user_channels (user_id, channel_id, role)
SELECT p.id as user_id, c.id as channel_id, 'member' as role
FROM public.profiles p
CROSS JOIN public.channels c
WHERE NOT c.is_private OR c.id = '00000000-0000-0000-0000-000000000000'
ON CONFLICT (user_id, channel_id) DO NOTHING; 