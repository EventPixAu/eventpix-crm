-- Create helper function for operations role check
CREATE OR REPLACE FUNCTION public.is_operations(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'operations'::app_role
  )
$$;

-- Create helper function for crew role check
CREATE OR REPLACE FUNCTION public.is_crew(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'crew'::app_role
  )
$$;

-- Combined function to check if user can access operations data (admin or operations)
CREATE OR REPLACE FUNCTION public.can_access_operations(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin'::app_role, 'operations'::app_role)
  )
$$;

-- Update is_assigned_to_event to work for both crew and photographer roles
CREATE OR REPLACE FUNCTION public.is_assigned_to_event(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_assignments ea
    WHERE ea.event_id = _event_id
    AND ea.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.event_assignments ea
    JOIN public.staff s ON s.id = ea.staff_id
    JOIN public.profiles p ON p.id = s.user_id
    WHERE ea.event_id = _event_id
    AND p.id = _user_id
  )
$$;

-- Operations can manage all events
CREATE POLICY "Operations can manage events"
ON public.events
FOR ALL
TO authenticated
USING (public.can_access_operations(auth.uid()))
WITH CHECK (public.can_access_operations(auth.uid()));

-- Operations can manage all assignments
CREATE POLICY "Operations can manage event_assignments"
ON public.event_assignments
FOR ALL
TO authenticated
USING (public.can_access_operations(auth.uid()))
WITH CHECK (public.can_access_operations(auth.uid()));

-- Operations can manage all worksheets
CREATE POLICY "Operations can manage worksheets"
ON public.worksheets
FOR ALL
TO authenticated
USING (public.can_access_operations(auth.uid()))
WITH CHECK (public.can_access_operations(auth.uid()));

-- Operations can manage worksheet items
CREATE POLICY "Operations can manage worksheet_items"
ON public.worksheet_items
FOR ALL
TO authenticated
USING (public.can_access_operations(auth.uid()))
WITH CHECK (public.can_access_operations(auth.uid()));

-- Operations can manage delivery records
CREATE POLICY "Operations can manage delivery_records"
ON public.delivery_records
FOR ALL
TO authenticated
USING (public.can_access_operations(auth.uid()))
WITH CHECK (public.can_access_operations(auth.uid()));

-- Operations can manage venues
CREATE POLICY "Operations can manage venues"
ON public.venues
FOR ALL
TO authenticated
USING (public.can_access_operations(auth.uid()))
WITH CHECK (public.can_access_operations(auth.uid()));

-- Operations can manage event sessions
CREATE POLICY "Operations can manage event_sessions"
ON public.event_sessions
FOR ALL
TO authenticated
USING (public.can_access_operations(auth.uid()))
WITH CHECK (public.can_access_operations(auth.uid()));

-- Operations can manage event contacts
CREATE POLICY "Operations can manage event_contacts"
ON public.event_contacts
FOR ALL
TO authenticated
USING (public.can_access_operations(auth.uid()))
WITH CHECK (public.can_access_operations(auth.uid()));

-- Operations can manage equipment allocations
CREATE POLICY "Operations can manage equipment_allocations"
ON public.equipment_allocations
FOR ALL
TO authenticated
USING (public.can_access_operations(auth.uid()))
WITH CHECK (public.can_access_operations(auth.uid()));

-- Crew can view assigned events
CREATE POLICY "Crew can view assigned events"
ON public.events
FOR SELECT
TO authenticated
USING (
  public.is_crew(auth.uid()) 
  AND public.is_assigned_to_event(auth.uid(), id)
);

-- Crew can view own assignments
CREATE POLICY "Crew can view own assignments"
ON public.event_assignments
FOR SELECT
TO authenticated
USING (
  public.is_crew(auth.uid())
  AND (user_id = auth.uid() OR public.is_assigned_to_event(auth.uid(), event_id))
);

-- Crew can update own assignment status (accept/decline)
CREATE POLICY "Crew can update own assignment status"
ON public.event_assignments
FOR UPDATE
TO authenticated
USING (public.is_crew(auth.uid()) AND user_id = auth.uid())
WITH CHECK (public.is_crew(auth.uid()) AND user_id = auth.uid());

-- Crew can view worksheets for assigned events
CREATE POLICY "Crew can view assigned worksheets"
ON public.worksheets
FOR SELECT
TO authenticated
USING (
  public.is_crew(auth.uid())
  AND public.is_assigned_to_event(auth.uid(), event_id)
);

-- Crew can view worksheet items for assigned events
CREATE POLICY "Crew can view assigned worksheet_items"
ON public.worksheet_items
FOR SELECT
TO authenticated
USING (
  public.is_crew(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.worksheets w
    WHERE w.id = worksheet_id
    AND public.is_assigned_to_event(auth.uid(), w.event_id)
  )
);

-- Crew can update worksheet items for assigned events
CREATE POLICY "Crew can update assigned worksheet_items"
ON public.worksheet_items
FOR UPDATE
TO authenticated
USING (
  public.is_crew(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.worksheets w
    WHERE w.id = worksheet_id
    AND public.is_assigned_to_event(auth.uid(), w.event_id)
  )
)
WITH CHECK (
  public.is_crew(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.worksheets w
    WHERE w.id = worksheet_id
    AND public.is_assigned_to_event(auth.uid(), w.event_id)
  )
);

-- Crew can view event contacts for assigned events
CREATE POLICY "Crew can view assigned event_contacts"
ON public.event_contacts
FOR SELECT
TO authenticated
USING (
  public.is_crew(auth.uid())
  AND public.is_assigned_to_event(auth.uid(), event_id)
);

-- Crew can view event sessions for assigned events
CREATE POLICY "Crew can view assigned event_sessions"
ON public.event_sessions
FOR SELECT
TO authenticated
USING (
  public.is_crew(auth.uid())
  AND public.is_assigned_to_event(auth.uid(), event_id)
);

-- Crew can view delivery records for assigned events
CREATE POLICY "Crew can view assigned delivery_records"
ON public.delivery_records
FOR SELECT
TO authenticated
USING (
  public.is_crew(auth.uid())
  AND public.is_assigned_to_event(auth.uid(), event_id)
);

-- Crew can view venues (read-only)
CREATE POLICY "Crew can view venues"
ON public.venues
FOR SELECT
TO authenticated
USING (public.is_crew(auth.uid()));

-- Operations can view clients (for context)
CREATE POLICY "Operations can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (public.is_operations(auth.uid()));

-- Operations can view contacts (for context)
CREATE POLICY "Operations can view client_contacts"
ON public.client_contacts
FOR SELECT
TO authenticated
USING (public.is_operations(auth.uid()));

-- Operations can manage leads (for conversion)
CREATE POLICY "Operations can manage leads"
ON public.leads
FOR ALL
TO authenticated
USING (public.can_access_operations(auth.uid()))
WITH CHECK (public.can_access_operations(auth.uid()));

-- Sales can view events (read-only for context)
CREATE POLICY "Sales can view events"
ON public.events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'sales'::app_role));

-- Operations can manage tasks
CREATE POLICY "Operations can manage tasks"
ON public.tasks
FOR ALL
TO authenticated
USING (public.can_access_operations(auth.uid()))
WITH CHECK (public.can_access_operations(auth.uid()));

-- Crew can view their own tasks
CREATE POLICY "Crew can view own tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  public.is_crew(auth.uid())
  AND (
    assigned_to = auth.uid()
    OR (related_type = 'event' AND public.is_assigned_to_event(auth.uid(), related_id))
  )
);

-- Crew can update their own tasks
CREATE POLICY "Crew can update own tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (public.is_crew(auth.uid()) AND assigned_to = auth.uid())
WITH CHECK (public.is_crew(auth.uid()) AND assigned_to = auth.uid());