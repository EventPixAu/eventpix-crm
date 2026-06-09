CREATE POLICY "Crew can read pay_rate_card" ON public.pay_rate_card
FOR SELECT TO authenticated
USING (is_crew(auth.uid()));

CREATE POLICY "Crew can read pay_allowances" ON public.pay_allowances
FOR SELECT TO authenticated
USING (is_crew(auth.uid()));

CREATE POLICY "Crew can read own assignment_allowances" ON public.assignment_allowances
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_assignments ea
    WHERE ea.id = assignment_allowances.assignment_id
      AND ea.user_id = auth.uid()
  )
);