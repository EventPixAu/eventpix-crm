-- Migrate legacy notes from clients.notes to client_notes table
-- This migration:
-- 1. Creates client_notes entries from existing clients.notes values
-- 2. Prefixes them with "Migrated Company Note: "
-- 3. Preserves created_at timestamp from the client record

DO $$
DECLARE
  v_client RECORD;
  v_note_text TEXT;
BEGIN
  FOR v_client IN 
    SELECT id, notes, created_at
    FROM clients
    WHERE notes IS NOT NULL 
      AND TRIM(notes) <> ''
  LOOP
    -- Check if this note has already been migrated (idempotent)
    IF NOT EXISTS (
      SELECT 1 FROM client_notes 
      WHERE client_id = v_client.id 
        AND note LIKE 'Migrated Company Note: %'
    ) THEN
      v_note_text := 'Migrated Company Note: ' || v_client.notes;
      
      INSERT INTO client_notes (client_id, note, created_at)
      VALUES (
        v_client.id,
        v_note_text,
        COALESCE(v_client.created_at, NOW())
      );
    END IF;
  END LOOP;
END $$;