-- Enable the pg_trgm extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add full-text search columns to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_text tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Add full-text search columns to files
ALTER TABLE files ADD COLUMN IF NOT EXISTS search_text tsvector
    GENERATED ALWAYS AS (to_tsvector('english', name)) STORED;

-- Create indexes for faster searching
CREATE INDEX IF NOT EXISTS messages_search_idx ON messages USING GIN (search_text);
CREATE INDEX IF NOT EXISTS files_search_idx ON files USING GIN (search_text);

-- Debug: Check if files table exists and has correct structure
DO $$
BEGIN
    RAISE NOTICE 'Checking files table structure...';
    IF EXISTS (
        SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'files'
    ) THEN
        RAISE NOTICE 'Files table exists';
    ELSE
        RAISE NOTICE 'Files table does not exist';
    END IF;
END $$;

-- Drop existing function before redefining
DROP FUNCTION IF EXISTS search_content(text, uuid);

-- Create a function to search messages and files
CREATE OR REPLACE FUNCTION search_content(
    search_query text,
    target_channel_id uuid DEFAULT NULL
)
RETURNS TABLE (
    type text,
    id uuid,
    content text,
    channel_id uuid,
    channel_name text,
    user_id uuid,
    username text,
    created_at timestamptz,
    parent_id uuid,
    message_id uuid,
    similarity float4
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Debug: Log search parameters
    RAISE NOTICE 'Searching with query: %, channel_id: %', search_query, target_channel_id;
    
    RETURN QUERY
    -- Search messages
    SELECT 
        'message' as type,
        m.id,
        m.content,
        m.channel_id,
        c.name as channel_name,
        m.user_id,
        p.username,
        m.created_at,
        m.parent_id,
        m.id as message_id,
        ts_rank(m.search_text, to_tsquery('english', search_query)) as similarity
    FROM messages m
    JOIN user_channels uc ON m.channel_id = uc.channel_id
    JOIN channels c ON m.channel_id = c.id
    JOIN profiles p ON m.user_id = p.id
    WHERE 
        uc.user_id = auth.uid()
        AND m.search_text @@ to_tsquery('english', search_query)
        AND (target_channel_id IS NULL OR m.channel_id = target_channel_id)
    UNION ALL
    -- Search files
    SELECT 
        'file' as type,
        f.id,
        f.name as content,
        m.channel_id,
        c.name as channel_name,
        m.user_id,
        p.username,
        f.created_at,
        m.parent_id,
        m.id as message_id,
        ts_rank(f.search_text, to_tsquery('english', search_query)) as similarity
    FROM files f
    JOIN messages m ON f.message_id = m.id
    JOIN user_channels uc ON m.channel_id = uc.channel_id
    JOIN channels c ON m.channel_id = c.id
    JOIN profiles p ON m.user_id = p.id
    WHERE 
        uc.user_id = auth.uid()
        AND f.search_text @@ to_tsquery('english', search_query)
        AND (target_channel_id IS NULL OR m.channel_id = target_channel_id)
    ORDER BY similarity DESC, created_at DESC
    LIMIT 50;
END;
$$; 