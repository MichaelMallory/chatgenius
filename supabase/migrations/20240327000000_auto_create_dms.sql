-- Drop existing function and recreate it with DM channel creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  username_val text;
  existing_user record;
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

  -- Create DM channels with all existing users
  for existing_user in 
    select id from public.profiles 
    where id != new.id
  loop
    -- Create DM channel
    insert into public.channels (
      name,
      is_direct_message,
      participants,
      created_by
    ) values (
      'dm-' || new.id || '-' || existing_user.id,
      true,
      array[new.id, existing_user.id],
      new.id
    );

    -- Get the ID of the newly created channel
    with new_channel as (
      select id from public.channels
      where name = 'dm-' || new.id || '-' || existing_user.id
      limit 1
    )
    -- Add both users to the channel
    insert into public.user_channels (user_id, channel_id, role)
    select user_id, channel_id, 'member' as role
    from (
      select unnest(array[new.id, existing_user.id]) as user_id,
             (select id from new_channel) as channel_id
    ) users;
  end loop;

  return new;
end;
$$;

-- Function to create missing DM channels between users
create or replace function public.create_missing_dm_channels()
returns void
language plpgsql
security definer
as $$
declare
  user1 record;
  user2 record;
begin
  -- Loop through all possible user pairs
  for user1 in select id from public.profiles loop
    for user2 in select id from public.profiles where id > user1.id loop
      -- Check if DM channel already exists
      if not exists (
        select 1 from public.channels
        where is_direct_message = true
        and participants @> array[user1.id, user2.id]
        and participants <@ array[user1.id, user2.id]
      ) then
        -- Create DM channel
        insert into public.channels (
          name,
          is_direct_message,
          participants,
          created_by
        ) values (
          'dm-' || user1.id || '-' || user2.id,
          true,
          array[user1.id, user2.id],
          user1.id
        );

        -- Get the ID of the newly created channel
        with new_channel as (
          select id from public.channels
          where name = 'dm-' || user1.id || '-' || user2.id
          limit 1
        )
        -- Add both users to the channel
        insert into public.user_channels (user_id, channel_id, role)
        select user_id, channel_id, 'member' as role
        from (
          select unnest(array[user1.id, user2.id]) as user_id,
                 (select id from new_channel) as channel_id
        ) users;
      end if;
    end loop;
  end loop;
end;
$$;

-- Run the function to create missing DM channels for existing users
select public.create_missing_dm_channels(); 