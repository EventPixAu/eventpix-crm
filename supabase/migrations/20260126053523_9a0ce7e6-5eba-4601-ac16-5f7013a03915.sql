-- Add lead_source text field to clients table for import flexibility
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS lead_source text;