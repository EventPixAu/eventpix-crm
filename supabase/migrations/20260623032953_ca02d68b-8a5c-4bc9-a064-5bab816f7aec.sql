
-- Add bot/scanner detection to email engagement events
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS bot_suspected BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_email_logs_bot_suspected
  ON public.email_logs(bot_suspected) WHERE bot_suspected = TRUE;

-- Backfill: flag suspected bot OPENS
-- Open event lives on the original send row (status='opened', has opened_at + delivered_at)
-- Bot suspicion: first_opened_at within 30s of delivered_at AND only a single open recorded
UPDATE public.email_logs
SET bot_suspected = TRUE
WHERE direction = 'outbound'
  AND status = 'opened'
  AND delivered_at IS NOT NULL
  AND COALESCE(first_opened_at, opened_at) IS NOT NULL
  AND EXTRACT(EPOCH FROM (COALESCE(first_opened_at, opened_at) - delivered_at)) < 30
  AND COALESCE(open_count, 1) <= 1;

-- Backfill: flag suspected bot CLICKS
-- Click events are inserted as new rows with status='clicked' and in_reply_to=parent_send_id
-- Bot suspicion:
--   (a) clicked within 60s of parent delivered_at
--   (b) OR clicked before any genuine human open on parent (no open, or open also flagged as bot)
WITH parent AS (
  SELECT c.id AS click_id,
         c.clicked_at,
         p.delivered_at,
         p.opened_at,
         p.first_opened_at,
         p.bot_suspected AS parent_open_is_bot
  FROM public.email_logs c
  LEFT JOIN public.email_logs p ON p.id = c.in_reply_to
  WHERE c.direction = 'outbound'
    AND c.status = 'clicked'
)
UPDATE public.email_logs e
SET bot_suspected = TRUE
FROM parent
WHERE e.id = parent.click_id
  AND (
    (parent.delivered_at IS NOT NULL
      AND parent.clicked_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (parent.clicked_at - parent.delivered_at)) < 60)
    OR
    -- No genuine human open before the click
    (COALESCE(parent.first_opened_at, parent.opened_at) IS NULL
     OR parent.parent_open_is_bot = TRUE
     OR COALESCE(parent.first_opened_at, parent.opened_at) > parent.clicked_at)
  );
