ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS share_team_vehicle_info boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS share_team_dietary boolean NOT NULL DEFAULT false;