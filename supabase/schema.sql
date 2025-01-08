-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  status text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Channels table
create table public.channels (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  is_private boolean default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(name)
);

-- User_Channels table (for channel membership)
create table public.user_channels (
  user_id uuid references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  role text default 'member'::text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, channel_id)
);

-- Messages table
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  content text not null,
  user_id uuid references public.profiles(id) on delete set null,
  channel_id uuid references public.channels(id) on delete cascade,
  parent_id uuid references public.messages(id) on delete cascade, -- For thread replies
  edited_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Files table
create table public.files (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  size integer not null,
  type text not null,
  url text not null,
  user_id uuid references public.profiles(id) on delete set null,
  message_id uuid references public.messages(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Reactions table
create table public.reactions (
  id uuid default uuid_generate_v4() primary key,
  emoji text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, message_id, emoji)
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.user_channels enable row level security;
alter table public.messages enable row level security;
alter table public.files enable row level security;
alter table public.reactions enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Channels policies
create policy "Public channels are viewable by everyone"
  on public.channels for select
  using (not is_private or exists (
    select 1 from public.user_channels
    where user_id = auth.uid() and channel_id = channels.id
  ));

create policy "Channel members can create channels"
  on public.channels for insert
  with check (auth.uid() = created_by);

-- User_Channels policies
create policy "Channel members can view membership"
  on public.user_channels for select
  using (exists (
    select 1 from public.user_channels uc
    where uc.channel_id = user_channels.channel_id
    and uc.user_id = auth.uid()
  ));

create policy "Users can join public channels"
  on public.user_channels for insert
  with check (
    not exists (
      select 1 from public.channels
      where id = channel_id and is_private
    )
  );

-- Messages policies
create policy "Channel members can view messages"
  on public.messages for select
  using (exists (
    select 1 from public.user_channels
    where user_id = auth.uid() and channel_id = messages.channel_id
  ));

create policy "Channel members can insert messages"
  on public.messages for insert
  with check (exists (
    select 1 from public.user_channels
    where user_id = auth.uid() and channel_id = messages.channel_id
  ));

create policy "Message authors can update their messages"
  on public.messages for update
  using (auth.uid() = user_id);

create policy "Message authors can delete their messages"
  on public.messages for delete
  using (auth.uid() = user_id);

-- Create default general channel
insert into public.channels (id, name, description, is_private)
values (
  '00000000-0000-0000-0000-000000000000',
  'general',
  'General discussion channel',
  false
)
on conflict (name) do nothing;

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  username_val text;
begin
  -- Set username from metadata or use email
  username_val := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );

  -- Create profile with fallbacks for optional fields
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

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable realtime
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.channels;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.user_channels; 