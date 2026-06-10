
-- Unify rate card: each role has a single mode (hourly or fixed)
ALTER TABLE public.pay_rate_card
  ADD COLUMN IF NOT EXISTS rate_mode text NOT NULL DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS fixed_rate numeric;

ALTER TABLE public.pay_rate_card
  ADD CONSTRAINT pay_rate_card_rate_mode_check CHECK (rate_mode IN ('hourly','fixed'));

ALTER TABLE public.pay_rate_card ALTER COLUMN hourly_rate DROP NOT NULL;
ALTER TABLE public.pay_rate_card ALTER COLUMN minimum_paid_hours DROP NOT NULL;

-- Migrate any existing fixed_rate_card rows into pay_rate_card (upsert by role)
INSERT INTO public.pay_rate_card (staff_role_id, rate_mode, fixed_rate, hourly_rate, minimum_paid_hours, notes)
SELECT f.staff_role_id, 'fixed', f.fixed_rate, NULL, NULL, f.notes
FROM public.fixed_rate_card f
ON CONFLICT (staff_role_id) DO UPDATE
  SET rate_mode = 'fixed',
      fixed_rate = EXCLUDED.fixed_rate,
      notes = COALESCE(public.pay_rate_card.notes, EXCLUDED.notes),
      updated_at = now();

-- If pay_rate_card has no unique constraint on staff_role_id, the above ON CONFLICT will fail.
-- Add it (safe if already exists via index).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pay_rate_card_staff_role_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.pay_rate_card ADD CONSTRAINT pay_rate_card_staff_role_id_key UNIQUE (staff_role_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
    END;
  END IF;
END$$;

DROP TABLE IF EXISTS public.fixed_rate_card;
