
-- Temporarily disable the restrictive trigger
ALTER TABLE event_assignments DISABLE TRIGGER trg_restrict_crew_event_assignment_update;

-- Reassign event assignments from test profile to admin profile
UPDATE event_assignments 
SET user_id = '1f0172cb-0c9f-4e63-9922-2d7d747a69c6' 
WHERE user_id = '95d9c281-e7f5-4483-82d6-bb1a261f1e22';

-- Re-enable the trigger
ALTER TABLE event_assignments ENABLE TRIGGER trg_restrict_crew_event_assignment_update;

-- Deactivate the test profile
UPDATE profiles 
SET is_active = false, status = 'inactive', updated_at = now() 
WHERE id = '95d9c281-e7f5-4483-82d6-bb1a261f1e22';

-- Deactivate the linked staff record
UPDATE staff 
SET status = 'inactive', updated_at = now() 
WHERE user_id = '95d9c281-e7f5-4483-82d6-bb1a261f1e22';
