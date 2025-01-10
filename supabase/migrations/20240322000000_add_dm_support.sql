-- Drop existing policies first
drop policy if exists "DM channels are viewable by participants" on public.channels;
drop policy if exists "Users can create DM channels" on public.channels;
drop policy if exists "Users can join DM channels if they are participants" on public.user_channels;

-- Add participants array to channels table
alter table public.channels 
add column if not exists participants uuid[] default array[]::uuid[];

-- Add index for faster participant lookups
create index if not exists channels_participants_idx 
on public.channels using gin (participants);

-- Add trigger to clean up orphaned channels when users are deleted
create or replace function public.clean_up_user_channels()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Remove the user from all channel participants arrays
  update public.channels
  set participants = array_remove(participants, old.id)
  where old.id = any(participants);

  -- Delete channels where the user was the only participant
  delete from public.channels
  where array_length(participants, 1) = 0;

  return old;
end;
$$;

-- Create trigger for user deletion cleanup
drop trigger if exists on_user_deleted on public.profiles;
create trigger on_user_deleted
  before delete on public.profiles
  for each row
  execute function public.clean_up_user_channels();

-- Update channel policies to allow DM access
create policy "DM channels are viewable by participants"
    on public.channels for select
    using (
        auth.uid() = any(participants) and is_direct_message = true
    );

create policy "Users can create DM channels"
    on public.channels for insert
    with check (
        is_direct_message = true and
        auth.uid() = any(participants) and
        auth.uid() = created_by
    );

-- Update user_channels policies to allow DM membership
create policy "Users can join DM channels if they are participants"
    on public.user_channels for insert
    with check (
        user_id = auth.uid() and
        exists (
            select 1 from public.channels
            where id = channel_id 
            and is_direct_message = true
            and auth.uid() = any(participants)
        )
    );

-- Function to format DM channel name
create or replace function public.format_dm_channel_name(channel_id uuid)
returns text
language plpgsql
security definer
as $$
declare
    participant_usernames text[];
begin
    select array_agg(p.username order by p.username)
    into participant_usernames
    from public.channels c
    join public.profiles p on p.id = any(c.participants)
    where c.id = channel_id;

    return array_to_string(participant_usernames, ', ');
end;
$$; 