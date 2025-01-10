-- Clean up existing schema
-- First drop all policies
drop policy if exists "Public channels are viewable by everyone" on public.channels;
drop policy if exists "Channel members can create channels" on public.channels;
drop policy if exists "Anyone can view public channels" on public.channels;
drop policy if exists "channel_select_policy" on public.channels;
drop policy if exists "Channel membership is viewable by channel members" on public.user_channels;
drop policy if exists "Users can join public channels" on public.user_channels;
drop policy if exists "Channel members can view messages" on public.messages;
drop policy if exists "Channel members can create messages" on public.messages;
drop policy if exists "Message authors can update their messages" on public.messages;
drop policy if exists "Message authors can delete their messages" on public.messages;
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- Drop triggers
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_channel_created on public.channels;
drop trigger if exists refresh_channel_access_on_channel_change on public.channels;
drop trigger if exists refresh_channel_access_on_membership_change on public.user_channels;

-- Drop functions
drop function if exists public.handle_new_user();
drop function if exists public.maintain_channel_access();
drop function if exists public.refresh_channel_access();

-- Drop materialized view
drop materialized view if exists public.channel_access_view;

-- Drop existing tables (in correct order)
drop table if exists public.reactions;
drop table if exists public.files;
drop table if exists public.messages;
drop table if exists public.user_channels;
drop table if exists public.channels;
drop table if exists public.profiles;

-- Recreate tables with clean schema
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    username text unique not null,
    full_name text,
    avatar_url text,
    status text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.channels (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    description text,
    is_private boolean default false,
    is_direct_message boolean default false,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(name)
);

create table public.user_channels (
    user_id uuid references public.profiles(id) on delete cascade,
    channel_id uuid references public.channels(id) on delete cascade,
    role text default 'member'::text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (user_id, channel_id)
);

create table public.messages (
    id uuid default uuid_generate_v4() primary key,
    content text not null,
    user_id uuid references public.profiles(id) on delete set null,
    channel_id uuid references public.channels(id) on delete cascade,
    parent_id uuid references public.messages(id) on delete cascade,
    edited_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.reactions (
    id uuid default uuid_generate_v4() primary key,
    message_id uuid references public.messages(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete cascade,
    emoji text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(message_id, user_id, emoji)
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.user_channels enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;

-- Create simple, non-recursive policies
-- Profiles policies
create policy "Profiles are viewable by everyone"
    on public.profiles for select
    using (true);

create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id);

-- Channels policies
create policy "Channels are viewable by members and if public"
    on public.channels for select
    using (
        not is_private or
        id = '00000000-0000-0000-0000-000000000000' or
        exists (
            select 1 from public.user_channels
            where channel_id = channels.id
            and user_id = auth.uid()
        )
    );

create policy "Users can create channels"
    on public.channels for insert
    with check (auth.uid() = created_by);

-- User_channels policies
create policy "Channel membership is viewable by channel members"
    on public.user_channels for select
    using (
        user_id = auth.uid() or
        channel_id = '00000000-0000-0000-0000-000000000000' or
        exists (
            select 1 from public.user_channels
            where channel_id = user_channels.channel_id
            and user_id = auth.uid()
        )
    );

create policy "Users can join public channels"
    on public.user_channels for insert
    with check (
        user_id = auth.uid() and
        (
            channel_id = '00000000-0000-0000-0000-000000000000' or
            exists (
                select 1 from public.channels
                where id = channel_id and not is_private
            )
        )
    );

-- Messages policies
create policy "Messages are viewable by channel members"
    on public.messages for select
    using (
        exists (
            select 1 from public.user_channels
            where channel_id = messages.channel_id
            and user_id = auth.uid()
        )
    );

create policy "Channel members can create messages"
    on public.messages for insert
    with check (
        exists (
            select 1 from public.user_channels
            where channel_id = messages.channel_id
            and user_id = auth.uid()
        )
    );

create policy "Message authors can update their messages"
    on public.messages for update
    using (auth.uid() = user_id);

create policy "Message authors can delete their messages"
    on public.messages for delete
    using (auth.uid() = user_id);

-- Reactions policies
create policy "Reactions are viewable by channel members"
    on public.reactions for select
    using (
        exists (
            select 1 from public.messages m
            join public.user_channels uc on m.channel_id = uc.channel_id
            where m.id = message_id
            and uc.user_id = auth.uid()
        )
    );

create policy "Channel members can create reactions"
    on public.reactions for insert
    with check (
        exists (
            select 1 from public.messages m
            join public.user_channels uc on m.channel_id = uc.channel_id
            where m.id = message_id
            and uc.user_id = auth.uid()
        )
    );

create policy "Users can delete their own reactions"
    on public.reactions for delete
    using (auth.uid() = user_id);

-- Create function to handle new user registration
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
    -- Create profile
    insert into public.profiles (id, username, full_name, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
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

-- Create trigger for new user signup
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- Create general channel
insert into public.channels (id, name, description, is_private, is_direct_message)
values (
    '00000000-0000-0000-0000-000000000000',
    'general',
    'General discussion channel',
    false,
    false
)
on conflict (id) do update
set 
    name = 'general',
    description = 'General discussion channel',
    is_private = false,
    is_direct_message = false; 