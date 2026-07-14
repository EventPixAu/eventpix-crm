INSERT INTO public.ops_statuses (name, label, sort_order, is_active, is_system)
VALUES ('postponed', 'Event Postponed', 9, true, false)
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label, is_active = true;