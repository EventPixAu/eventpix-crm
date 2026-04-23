INSERT INTO public.staff_roles (name, sort_order, is_active)
SELECT 'Photographer + Videographer', COALESCE((SELECT MAX(sort_order) FROM public.staff_roles), 0) + 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.staff_roles WHERE name = 'Photographer + Videographer');