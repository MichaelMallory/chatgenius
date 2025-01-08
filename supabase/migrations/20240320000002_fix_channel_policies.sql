-- Drop existing channel policies
drop policy if exists "Channel members can create channels" on channels;
drop policy if exists "Public channels are viewable by everyone" on channels;

-- Create new policies
create policy "Public channels are viewable by everyone"
  on channels for select
  using (not is_private or exists (
    select 1 from user_channels
    where user_id = auth.uid() and channel_id = channels.id
  ));

-- Allow creation of general channel and user-created channels
create policy "Allow channel creation"
  on channels for insert
  with check (
    -- Either it's the general channel
    (name = 'general' and id = '00000000-0000-0000-0000-000000000000') or
    -- Or it's a user-created channel
    (auth.uid() = created_by)
  );

-- Allow updates to channels by creators
create policy "Channel creators can update channels"
  on channels for update
  using (auth.uid() = created_by);

-- Allow deletion of channels by creators
create policy "Channel creators can delete channels"
  on channels for delete
  using (auth.uid() = created_by);

-- Ensure the general channel exists
insert into channels (id, name, description, is_private)
values (
  '00000000-0000-0000-0000-000000000000',
  'general',
  'General discussion channel',
  false
)
on conflict (id) do update
set name = 'general',
    description = 'General discussion channel',
    is_private = false; 