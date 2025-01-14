-- Create the cleanup function
CREATE OR REPLACE FUNCTION delete_batch(p_table text, p_condition text, p_batch_size int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  EXECUTE format('WITH deleted AS (
    DELETE FROM %I
    WHERE %s
    RETURNING 1
  ) SELECT count(*) FROM deleted', p_table, p_condition)
  INTO v_count;
  
  RETURN v_count;
END;
$$;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION delete_batch TO service_role; 