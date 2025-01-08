-- Drop ALL existing policies first
drop policy if exists "Anyone can view public channels" on channels;
drop policy if exists "Public channels are viewable by everyone" on channels;
drop policy if exists "Allow channel creation" on channels;
drop policy if exists "Channel creators can update channels" on channels;
drop policy if exists "Channel creators can delete channels" on channels;
drop policy if exists "Channel members can create channels" on channels;
drop policy if exists "Users can create channels" on channels;

drop policy if exists "Channel members can view membership" on user_channels;
drop policy if exists "Users can join public channels" on user_channels;
drop policy if exists "Anyone can view channel membership" on user_channels;
drop policy if exists "Users can join channels" on user_channels;

-- First, disable RLS temporarily to ensure we can create the channel
alter table channels disable row level security;
alter table user_channels disable row level security;

-- Recreate the general channel
insert into channels (id, name, description, is_private, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'general',
  'General discussion channel',
  false,
  now(),
  now()
)
on conflict (id) do update
set name = 'general',
    description = 'General discussion channel',
    is_private = false;

-- Re-enable RLS
alter table channels enable row level security;
alter table user_channels enable row level security;

-- Create new policies
create policy "Anyone can view public channels"
  on channels for select
  using (
    not is_private or -- public channels are visible to everyone
    id = '00000000-0000-0000-0000-000000000000' or -- general channel is visible to everyone
    exists ( -- private channels visible to members
      select 1 from user_channels
      where user_id = auth.uid() and channel_id = channels.id
    )
  );

create policy "Users can create channels"
  on channels for insert
  with check (
    auth.uid() is not null -- any authenticated user can create channels
  );

create policy "Anyone can view channel membership"
  on user_channels for select
  using (true);

create policy "Users can join channels"
  on user_channels for insert
  with check (
    auth.uid() = user_id and ( -- user can only join as themselves
      channel_id = '00000000-0000-0000-0000-000000000000' or -- anyone can join general
      not exists ( -- can't join private channels unless...
        select 1 from channels
        where id = channel_id
        and is_private = true
      )
    )
  );

-- Drop and recreate the trigger
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Function to auto-join users to general channel
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  username_val text;
begin
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
    '00000000-0000-0000-0000-000000000000',
    'member'
  );

  return new;
end;
$$;

-- Create the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Add all existing users to general channel
insert into user_channels (user_id, channel_id, role)
select 
  profiles.id as user_id,
  '00000000-0000-0000-0000-000000000000' as channel_id,
  'member' as role
from profiles
where not exists (
  select 1 from user_channels
  where user_channels.user_id = profiles.id
  and user_channels.channel_id = '00000000-0000-0000-0000-000000000000'
); 