-- pgcrypto is installed in the `extensions` schema. Some existing triggers/functions call
-- `gen_random_bytes()` without a schema prefix, which fails unless it's on the search_path.
-- Provide thin wrappers in `public` for compatibility.

CREATE OR REPLACE FUNCTION public.gen_random_bytes(len integer)
RETURNS bytea
LANGUAGE sql
VOLATILE
STRICT
SET search_path = public, extensions
AS $$
  SELECT extensions.gen_random_bytes(len);
$$;

CREATE OR REPLACE FUNCTION public.gen_random_uuid()
RETURNS uuid
LANGUAGE sql
VOLATILE
SET search_path = public, extensions
AS $$
  SELECT extensions.gen_random_uuid();
$$;