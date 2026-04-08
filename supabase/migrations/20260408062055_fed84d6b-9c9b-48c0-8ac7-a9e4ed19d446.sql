-- Temporarily disable the restrictive trigger
ALTER TABLE event_assignments DISABLE TRIGGER trg_restrict_crew_event_assignment_update;

-- Link existing assignments to the correct session
UPDATE event_assignments 
SET session_id = '1e84d655-e398-490a-8f82-ff608e3ae658' 
WHERE event_id = '4ec1739c-f541-4de1-ad8e-87447d3cf577' 
AND session_id IS NULL;

-- Re-enable the trigger
ALTER TABLE event_assignments ENABLE TRIGGER trg_restrict_crew_event_assignment_update;