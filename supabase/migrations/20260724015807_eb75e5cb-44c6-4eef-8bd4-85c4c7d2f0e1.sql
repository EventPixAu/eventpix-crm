CREATE TABLE public.enquiry_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_enquiry_rate_limits_lookup ON public.enquiry_rate_limits (ip_hash, created_at);
GRANT ALL ON public.enquiry_rate_limits TO service_role;
ALTER TABLE public.enquiry_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies — only the service-role edge function accesses this table.