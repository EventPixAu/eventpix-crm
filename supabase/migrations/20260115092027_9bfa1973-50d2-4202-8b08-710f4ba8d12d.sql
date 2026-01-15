-- Fix check_staff_eligibility to restrict access to admin or self only
-- This prevents any authenticated user from checking other users' compliance status

CREATE OR REPLACE FUNCTION public.check_staff_eligibility(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_required_docs uuid[];
  v_submitted_docs jsonb[];
  v_missing_docs text[];
  v_expired_docs text[];
  v_pending_docs text[];
  v_is_eligible boolean := true;
  v_reasons text[] := '{}';
BEGIN
  -- Only admin or self can check eligibility
  IF NOT (has_role(auth.uid(), 'admin') OR auth.uid() = p_user_id) THEN
    RAISE EXCEPTION 'Access denied: You can only check your own eligibility or must be an admin';
  END IF;

  -- Get the user's profile
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reasons', ARRAY['User profile not found']
    );
  END IF;

  -- Check onboarding status
  IF v_profile.onboarding_status NOT IN ('active') THEN
    v_is_eligible := false;
    v_reasons := array_append(v_reasons, 'Onboarding status is ' || v_profile.onboarding_status);
  END IF;

  -- Get required document types
  SELECT array_agg(id) INTO v_required_docs
  FROM compliance_document_types
  WHERE required = true AND is_active = true;

  -- Check for missing required documents
  SELECT array_agg(cdt.name) INTO v_missing_docs
  FROM compliance_document_types cdt
  WHERE cdt.required = true 
    AND cdt.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM staff_compliance_documents scd
      WHERE scd.user_id = p_user_id 
        AND scd.document_type_id = cdt.id
        AND scd.status IN ('approved', 'pending')
    );

  IF v_missing_docs IS NOT NULL AND array_length(v_missing_docs, 1) > 0 THEN
    v_is_eligible := false;
    v_reasons := array_append(v_reasons, 'Missing documents: ' || array_to_string(v_missing_docs, ', '));
  END IF;

  -- Check for expired documents
  SELECT array_agg(cdt.name) INTO v_expired_docs
  FROM staff_compliance_documents scd
  JOIN compliance_document_types cdt ON cdt.id = scd.document_type_id
  WHERE scd.user_id = p_user_id 
    AND scd.status = 'expired';

  IF v_expired_docs IS NOT NULL AND array_length(v_expired_docs, 1) > 0 THEN
    v_is_eligible := false;
    v_reasons := array_append(v_reasons, 'Expired documents: ' || array_to_string(v_expired_docs, ', '));
  END IF;

  -- Check for pending documents (informational, doesn't block eligibility)
  SELECT array_agg(cdt.name) INTO v_pending_docs
  FROM staff_compliance_documents scd
  JOIN compliance_document_types cdt ON cdt.id = scd.document_type_id
  WHERE scd.user_id = p_user_id 
    AND scd.status = 'pending';

  RETURN jsonb_build_object(
    'eligible', v_is_eligible,
    'reasons', v_reasons,
    'onboarding_status', v_profile.onboarding_status,
    'missing_documents', COALESCE(v_missing_docs, '{}'),
    'expired_documents', COALESCE(v_expired_docs, '{}'),
    'pending_documents', COALESCE(v_pending_docs, '{}')
  );
END;
$$;