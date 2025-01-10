-- Enable the moddatetime extension
CREATE EXTENSION IF NOT EXISTS moddatetime;

-- Add files column to messages table if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'files'
  ) THEN
    ALTER TABLE messages ADD COLUMN files jsonb[];
  END IF;
END $$;

-- Create the files table if it doesn't exist
CREATE TABLE IF NOT EXISTS files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  size bigint NOT NULL,
  type text NOT NULL,
  url text NOT NULL,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add RLS policies for files
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view files in their channels" ON files;
DROP POLICY IF EXISTS "Users can upload files to their channels" ON files;
DROP POLICY IF EXISTS "Users can delete their own files" ON files;

-- Allow users to view files in channels they are members of
CREATE POLICY "Users can view files in their channels" ON files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN user_channels uc ON m.channel_id = uc.channel_id
      WHERE m.id = files.message_id
      AND uc.user_id = auth.uid()
    )
  );

-- Allow users to upload files to channels they are members of
CREATE POLICY "Users can upload files to their channels" ON files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN user_channels uc ON m.channel_id = uc.channel_id
      WHERE m.id = files.message_id
      AND uc.user_id = auth.uid()
    )
  );

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files" ON files
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = files.message_id
      AND m.user_id = auth.uid()
    )
  );

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can upload message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own message attachments" ON storage.objects;

-- Add storage policies for message attachments
CREATE POLICY "Users can upload message attachments" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view message attachments" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'message-attachments'
  );

CREATE POLICY "Users can delete their own message attachments" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'message-attachments'
    AND auth.uid() = owner
  );

-- Drop existing trigger if it exists and recreate it
DROP TRIGGER IF EXISTS set_updated_at ON files;

-- Add trigger to update updated_at timestamp
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime (updated_at);

-- Enable realtime for files table if not already enabled
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'files'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE files;
  END IF;
END $$; 