-- Migration: Move primary_contact_* fields from clients to client_contacts + contact_company_associations
-- This creates new Contact records for companies that have primary_contact_* data stored directly
-- and links them as the Primary Contact via contact_company_associations

DO $$
DECLARE
  v_client RECORD;
  v_existing_contact_id uuid;
  v_new_contact_id uuid;
BEGIN
  -- Loop through all clients that have primary contact data stored directly
  FOR v_client IN 
    SELECT id, business_name, primary_contact_name, primary_contact_email, primary_contact_phone
    FROM clients
    WHERE (primary_contact_name IS NOT NULL AND primary_contact_name != '')
       OR (primary_contact_email IS NOT NULL AND primary_contact_email != '')
  LOOP
    -- Check if a contact with matching email already exists for this company
    SELECT cc.id INTO v_existing_contact_id
    FROM client_contacts cc
    WHERE cc.client_id = v_client.id
      AND cc.email = v_client.primary_contact_email
      AND v_client.primary_contact_email IS NOT NULL
      AND v_client.primary_contact_email != ''
    LIMIT 1;

    IF v_existing_contact_id IS NOT NULL THEN
      -- Contact exists - just make sure there's an association marked as primary
      INSERT INTO contact_company_associations (contact_id, company_id, relationship_type, is_primary)
      VALUES (v_existing_contact_id, v_client.id, 'employee', true)
      ON CONFLICT DO NOTHING;
    ELSE
      -- Create a new contact record
      INSERT INTO client_contacts (
        client_id,
        contact_name,
        email,
        phone_mobile,
        is_primary
      ) VALUES (
        v_client.id,
        COALESCE(NULLIF(v_client.primary_contact_name, ''), 'Primary Contact'),
        NULLIF(v_client.primary_contact_email, ''),
        NULLIF(v_client.primary_contact_phone, ''),
        true
      )
      RETURNING id INTO v_new_contact_id;
      
      -- Create the association marked as primary
      INSERT INTO contact_company_associations (contact_id, company_id, relationship_type, is_primary)
      VALUES (v_new_contact_id, v_client.id, 'employee', true)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;