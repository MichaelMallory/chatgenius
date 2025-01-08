-- Drop existing trigger and function
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Recreate the function with better error handling
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  username_val text;
  general_channel_id uuid;
begin
  -- Get or create general channel
  insert into public.channels (id, name, description, is_private)
  values (
    '00000000-0000-0000-0000-000000000000',
    'general',
    'General discussion channel',
    false
  )
  on conflict (name) do update
  set id = '00000000-0000-0000-0000-000000000000'
  returning id into general_channel_id;

  -- Set username from metadata or use email
  username_val := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );

  -- Create profile
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    username_val,
    coalesce(new.raw_user_meta_data->>'full_name', username_val),
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Add to general channel
  insert into public.user_channels (user_id, channel_id, role)
  values (
    new.id,
    general_channel_id,
    'member'
  );

  return new;
exception
  when others then
    raise log 'Error in handle_new_user: %', SQLERRM;
    return new;
end;
$$;

-- Recreate the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Add any existing users to general channel
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