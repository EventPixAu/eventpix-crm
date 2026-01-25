
-- Backfill: Migrate primary contacts from clients table to client_contacts master table
-- This creates contact records for any client.primary_contact_* data that doesn't already exist

-- Step 1: Insert contacts from clients.primary_contact_* into client_contacts
-- Only insert if no existing client_contact matches by email (or name if email is null)
INSERT INTO public.client_contacts (
  client_id,
  contact_name,
  email,
  phone,
  is_primary,
  created_at
)
SELECT 
  c.id AS client_id,
  c.primary_contact_name AS contact_name,
  c.primary_contact_email AS email,
  c.primary_contact_phone AS phone,
  true AS is_primary,
  COALESCE(c.created_at, NOW()) AS created_at
FROM public.clients c
WHERE c.primary_contact_name IS NOT NULL 
  AND TRIM(c.primary_contact_name) <> ''
  AND c.is_training = false
  -- Avoid duplicates: check no existing contact matches
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contacts cc
    WHERE cc.client_id = c.id
      AND (
        -- Match by email if both have email
        (cc.email IS NOT NULL AND c.primary_contact_email IS NOT NULL AND LOWER(TRIM(cc.email)) = LOWER(TRIM(c.primary_contact_email)))
        -- Or match by name if email is null
        OR (c.primary_contact_email IS NULL AND LOWER(TRIM(cc.contact_name)) = LOWER(TRIM(c.primary_contact_name)))
      )
  );

-- Step 2: Also create contact_company_associations for any freelance contacts
-- that were created via CreateAndLinkContactDialog but the association might be missing
-- (This ensures data consistency)
