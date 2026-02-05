-- Create table to store Xero OAuth tokens (one per tenant/organization)
CREATE TABLE public.xero_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL UNIQUE,
  tenant_name text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.xero_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins can manage tokens
CREATE POLICY "Admins can manage xero tokens" ON public.xero_tokens
  FOR ALL USING (public.is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_xero_tokens_updated_at
  BEFORE UPDATE ON public.xero_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();