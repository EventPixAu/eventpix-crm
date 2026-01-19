-- Add "Functions Manager" role if it doesn't exist
INSERT INTO public.contact_roles (name, sort_order)
VALUES ('Functions Manager', 5)
ON CONFLICT DO NOTHING;