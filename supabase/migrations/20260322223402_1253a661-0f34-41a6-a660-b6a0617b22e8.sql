
-- Add page_key column to role_section_visibility
ALTER TABLE public.role_section_visibility 
ADD COLUMN IF NOT EXISTS page_key text NOT NULL DEFAULT 'event_detail';

-- Drop the old unique constraint and create a new one including page_key
ALTER TABLE public.role_section_visibility 
DROP CONSTRAINT IF EXISTS role_section_visibility_role_section_key_key;

ALTER TABLE public.role_section_visibility 
ADD CONSTRAINT role_section_visibility_role_section_page_key UNIQUE (role, section_key, page_key);
