-- Create user_presence table
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean not null default false,
  last_seen timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Add RLS policies
alter table public.user_presence enable row level security;

-- Allow anyone to read presence data
create policy "Anyone can read user presence"
  on public.user_presence
  for select
  to authenticated
  using (true);

-- Allow users to update their own presence
create policy "Users can update their own presence"
  on public.user_presence
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Allow users to insert their own presence
create policy "Users can insert their own presence"
  on public.user_presence
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Create function to update updated_at on presence changes
create or replace function public.handle_presence_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create trigger for updated_at
create trigger presence_updated_at
  before update
  on public.user_presence
  for each row
  execute function public.handle_presence_updated_at();

-- Enable realtime for presence table
alter publication supabase_realtime add table public.user_presence; 