-- Add Supplier status to company_statuses
INSERT INTO public.company_statuses (name, label, badge_variant, sort_order, is_active, is_system)
VALUES ('supplier', 'Supplier', 'outline', 5, true, false);