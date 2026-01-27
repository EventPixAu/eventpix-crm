-- Add RLS policies for admin management of crew checklists
-- Admins need to be able to create checklists for any user when assigning staff

-- Drop existing policies if they exist and recreate with admin access
DROP POLICY IF EXISTS "Users can view their own checklists" ON public.crew_checklists;
DROP POLICY IF EXISTS "Users can create their own checklists" ON public.crew_checklists;
DROP POLICY IF EXISTS "Admins can manage all crew checklists" ON public.crew_checklists;

-- Create comprehensive policies for crew_checklists
CREATE POLICY "Users can view their own checklists" 
ON public.crew_checklists 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all crew checklists" 
ON public.crew_checklists 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own checklists" 
ON public.crew_checklists 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Also allow ops to manage checklists
CREATE POLICY "Ops can manage all crew checklists" 
ON public.crew_checklists 
FOR ALL 
USING (public.has_role(auth.uid(), 'operations'))
WITH CHECK (public.has_role(auth.uid(), 'operations'));

-- Update policies for crew_checklist_items
DROP POLICY IF EXISTS "Users can view their checklist items" ON public.crew_checklist_items;
DROP POLICY IF EXISTS "Users can update their checklist items" ON public.crew_checklist_items;
DROP POLICY IF EXISTS "Admins can manage all checklist items" ON public.crew_checklist_items;

-- Allow users to view/update their own items
CREATE POLICY "Users can view their checklist items" 
ON public.crew_checklist_items 
FOR SELECT 
USING (
  checklist_id IN (
    SELECT id FROM public.crew_checklists WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their checklist items" 
ON public.crew_checklist_items 
FOR UPDATE 
USING (
  checklist_id IN (
    SELECT id FROM public.crew_checklists WHERE user_id = auth.uid()
  )
);

-- Admins can manage all items
CREATE POLICY "Admins can manage all checklist items" 
ON public.crew_checklist_items 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ops can manage all items
CREATE POLICY "Ops can manage all checklist items" 
ON public.crew_checklist_items 
FOR ALL 
USING (public.has_role(auth.uid(), 'operations'))
WITH CHECK (public.has_role(auth.uid(), 'operations'));