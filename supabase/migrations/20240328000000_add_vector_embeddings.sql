-- Enable the vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector_embeddings table
CREATE TABLE public.vector_embeddings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
    embedding vector(3072), -- Using larger OpenAI model with 3072 dimensions
    metadata jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    -- Ensure one embedding per message
    CONSTRAINT unique_message_embedding UNIQUE (message_id)
);

-- Add RLS
ALTER TABLE public.vector_embeddings ENABLE ROW LEVEL SECURITY;

-- Add indices for better performance
CREATE INDEX vector_embeddings_message_id_idx ON public.vector_embeddings (message_id);
CREATE INDEX vector_embeddings_status_idx ON public.vector_embeddings (status);
CREATE INDEX vector_embeddings_created_at_idx ON public.vector_embeddings (created_at);

-- Add trigger for updated_at
CREATE TRIGGER set_vector_embeddings_updated_at
    BEFORE UPDATE ON public.vector_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime (updated_at);

-- Add RLS policies
-- Allow channel members to read embeddings
CREATE POLICY "Channel members can view embeddings"
    ON public.vector_embeddings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.user_channels uc ON m.channel_id = uc.channel_id
            WHERE m.id = vector_embeddings.message_id
            AND uc.user_id = auth.uid()
        )
    );

-- Only allow system to insert/update/delete (no direct user access)
CREATE POLICY "System only write access"
    ON public.vector_embeddings
    FOR ALL
    USING (auth.uid()::text = current_setting('app.system_user', true))
    WITH CHECK (auth.uid()::text = current_setting('app.system_user', true));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vector_embeddings; 