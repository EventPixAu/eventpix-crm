-- Add 'contract_sent' status to lead_status enum for Studio Ninja-style pipeline
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'contract_sent' AFTER 'quoted';