-- Add is_primary column to track primary contact per company
ALTER TABLE public.contact_company_associations 
ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

-- Create function to ensure only one primary contact per company
CREATE OR REPLACE FUNCTION public.ensure_single_primary_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If setting this contact as primary, clear others for this company
  IF NEW.is_primary = true THEN
    UPDATE public.contact_company_associations
    SET is_primary = false
    WHERE company_id = NEW.company_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to enforce single primary
CREATE TRIGGER trg_ensure_single_primary_contact
  BEFORE INSERT OR UPDATE OF is_primary ON public.contact_company_associations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_primary_contact();

-- Add index for faster primary lookups
CREATE INDEX idx_contact_company_assoc_primary 
  ON public.contact_company_associations(company_id, is_primary) 
  WHERE is_primary = true;