-- Drop existing reaction policies if any
drop policy if exists "Channel members can view reactions" on reactions;
drop policy if exists "Channel members can add reactions" on reactions;
drop policy if exists "Users can remove own reactions" on reactions;

-- Create new policies
create policy "Channel members can view reactions"
  on reactions for select
  using (exists (
    select 1 from messages m
    join user_channels uc on uc.channel_id = m.channel_id
    where m.id = reactions.message_id
    and uc.user_id = auth.uid()
  ));

create policy "Channel members can add reactions"
  on reactions for insert
  with check (exists (
    select 1 from messages m
    join user_channels uc on uc.channel_id = m.channel_id
    where m.id = reactions.message_id
    and uc.user_id = auth.uid()
    and auth.uid() = reactions.user_id
  ));

create policy "Users can remove own reactions"
  on reactions for delete
  using (auth.uid() = user_id); 