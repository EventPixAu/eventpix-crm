-- Update Local Business Awards events to 2026 dates
UPDATE events 
SET 
  event_date = event_date + INTERVAL '1 year',
  start_at = start_at + INTERVAL '1 year',
  end_at = end_at + INTERVAL '1 year',
  delivery_deadline = delivery_deadline + INTERVAL '1 year'
WHERE event_series_id = '979ab0a3-551a-4d5b-adda-9ea1c8b47bf9'
  AND event_date < '2026-01-01';

-- Update delivery records to 2026 dates
UPDATE delivery_records 
SET 
  delivered_at = delivered_at + INTERVAL '1 year',
  updated_at = now()
WHERE event_id IN (
  SELECT id FROM events 
  WHERE event_series_id = '979ab0a3-551a-4d5b-adda-9ea1c8b47bf9'
)
AND delivered_at < '2026-01-01';