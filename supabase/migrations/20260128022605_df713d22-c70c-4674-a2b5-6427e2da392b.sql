-- Add direction column to email_logs to distinguish inbound vs outbound
ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound' 
CHECK (direction IN ('inbound', 'outbound'));

-- Add in_reply_to column to link replies to original emails
ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS in_reply_to UUID REFERENCES public.email_logs(id);

-- Add from_email for inbound emails (sender)
ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS from_email TEXT;

-- Add from_name for inbound emails
ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS from_name TEXT;

-- Create index for faster reply chain lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_in_reply_to ON public.email_logs(in_reply_to);
CREATE INDEX IF NOT EXISTS idx_email_logs_direction ON public.email_logs(direction);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON public.email_logs(recipient_email);