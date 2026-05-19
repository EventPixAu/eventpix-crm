-- Allow crew assigned to an event to view the team brief uploaded under team-briefs/{event_id}/...
CREATE POLICY "Crew can view team brief uploads"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'event-documents'
  AND (storage.foldername(name))[1] = 'team-briefs'
  AND public.is_crew()
  AND public.is_assigned_to_event(((storage.foldername(name))[2])::uuid)
);