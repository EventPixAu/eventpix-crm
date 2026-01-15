-- Add related_contract_id to client_communications for contract email logging
ALTER TABLE public.client_communications 
ADD COLUMN IF NOT EXISTS related_contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_client_communications_related_contract_id 
ON public.client_communications(related_contract_id);

-- Comment
COMMENT ON COLUMN public.client_communications.related_contract_id IS 'Links communication to a specific contract when applicable';