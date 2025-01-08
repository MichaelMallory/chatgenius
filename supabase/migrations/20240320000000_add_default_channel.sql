-- Create default general channel if it doesn't exist
insert into public.channels (id, name, description, is_private)
values (
  '00000000-0000-0000-0000-000000000000',
  'general',
  'General discussion channel',
  false
)
on conflict (name) do nothing;

-- Function to automatically add users to general channel
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Create profile
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Add to general channel
  insert into public.user_channels (user_id, channel_id, role)
  values (
    new.id,
    '00000000-0000-0000-0000-000000000000',
    'member'
  );

  return new;
end;
$$;

-- Add existing users to general channel
insert into public.user_channels (user_id, channel_id, role)
select 
  profiles.id as user_id,
  '00000000-0000-0000-0000-000000000000' as channel_id,
  'member' as role
from public.profiles
where not exists (
  select 1 from public.user_channels
  where user_channels.user_id = profiles.id
  and user_channels.channel_id = '00000000-0000-0000-0000-000000000000'
); 