-- Drop the existing table
DROP TABLE IF EXISTS vector_embeddings;

-- Recreate with correct dimensions
CREATE TABLE vector_embeddings (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references messages(id) on delete cascade unique not null,
  embedding vector(1536),
  status text default 'pending' not null,
  error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
); 