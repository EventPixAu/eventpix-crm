
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS brief_file_name text,
ADD COLUMN IF NOT EXISTS brief_file_path text,
ADD COLUMN IF NOT EXISTS client_brief_file_name text,
ADD COLUMN IF NOT EXISTS client_brief_file_path text;
