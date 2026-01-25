-- Fix ambiguous audit logging function overloads breaking inserts/updates
-- Keep the secure version (derives actor from auth.uid()) and remove the legacy overload.

DROP FUNCTION IF EXISTS public.log_audit_entry(uuid, uuid, audit_action, jsonb, jsonb);