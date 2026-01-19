-- Add format column to contract_templates
ALTER TABLE public.contract_templates
ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'text'
CONSTRAINT contract_templates_format_check CHECK (format IN ('text', 'html'));

-- Add format column to email_templates
ALTER TABLE public.email_templates
ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'text'
CONSTRAINT email_templates_format_check CHECK (format IN ('text', 'html'));

-- Set existing templates with HTML content to 'html' format
UPDATE public.contract_templates
SET format = 'html'
WHERE body_html IS NOT NULL 
  AND body_html != ''
  AND (body_html LIKE '<%' OR body_html LIKE '%</%');

UPDATE public.email_templates
SET format = 'html'
WHERE body_html IS NOT NULL 
  AND body_html != ''
  AND (body_html LIKE '<%' OR body_html LIKE '%</%');

-- Add comment explaining the format field
COMMENT ON COLUMN public.contract_templates.format IS 'Template format: text (plain text with newlines) or html (legacy HTML templates)';