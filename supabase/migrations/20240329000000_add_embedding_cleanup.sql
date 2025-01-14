-- Enable pgcron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create archive table for old embeddings
CREATE TABLE IF NOT EXISTS public.archived_vector_embeddings (
    id uuid PRIMARY KEY,
    message_id uuid,
    embedding vector(3072),
    metadata jsonb,
    status text,
    error text,
    created_at timestamptz,
    updated_at timestamptz,
    archived_at timestamptz DEFAULT now() NOT NULL
);

-- Add RLS to archive table
ALTER TABLE public.archived_vector_embeddings ENABLE ROW LEVEL SECURITY;

-- Add same RLS policies as vector_embeddings
CREATE POLICY "Channel members can view archived embeddings"
    ON public.archived_vector_embeddings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.user_channels uc ON m.channel_id = uc.channel_id
            WHERE m.id = archived_vector_embeddings.message_id
            AND uc.user_id = auth.uid()
        )
    );

-- Function to remove orphaned embeddings
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_embeddings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    removed_count integer;
BEGIN
    -- Delete embeddings where message no longer exists
    -- (This should be rare due to CASCADE, but good to have)
    WITH deleted AS (
        DELETE FROM public.vector_embeddings ve
        WHERE NOT EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = ve.message_id
        )
        RETURNING id
    )
    SELECT count(*) INTO removed_count FROM deleted;

    RETURN removed_count;
END;
$$;

-- Function to archive old embeddings
CREATE OR REPLACE FUNCTION public.archive_old_embeddings(age_threshold interval)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    archived_count integer;
BEGIN
    -- Move old embeddings to archive table
    WITH moved AS (
        DELETE FROM public.vector_embeddings ve
        WHERE ve.created_at < (now() - age_threshold)
        AND ve.status = 'completed'
        RETURNING *
    )
    INSERT INTO public.archived_vector_embeddings
    SELECT 
        id,
        message_id,
        embedding,
        metadata,
        status,
        error,
        created_at,
        updated_at
    FROM moved
    RETURNING id INTO archived_count;

    RETURN archived_count;
END;
$$;

-- Schedule daily cleanup job (runs at 3 AM UTC)
SELECT cron.schedule(
    'cleanup-embeddings',
    '0 3 * * *',
    $$
    SELECT public.cleanup_orphaned_embeddings();
    SELECT public.archive_old_embeddings('90 days'::interval);
    $$
); 