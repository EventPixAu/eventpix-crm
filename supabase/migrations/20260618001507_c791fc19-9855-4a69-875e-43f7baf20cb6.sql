-- Function: re-sync all crew_checklists linked to a given template
CREATE OR REPLACE FUNCTION public.sync_crew_checklists_from_template(_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _checklist RECORD;
  _tpl_items jsonb;
BEGIN
  SELECT items INTO _tpl_items
  FROM public.crew_checklist_templates
  WHERE id = _template_id;

  IF _tpl_items IS NULL THEN
    RETURN;
  END IF;

  FOR _checklist IN
    SELECT id FROM public.crew_checklists WHERE template_id = _template_id
  LOOP
    -- Insert new items from template that don't already exist on the checklist
    INSERT INTO public.crew_checklist_items (checklist_id, item_text, sort_order, is_done)
    SELECT
      _checklist.id,
      (elem->>'item_text')::text,
      COALESCE((elem->>'sort_order')::int, 0),
      false
    FROM jsonb_array_elements(_tpl_items) AS elem
    WHERE NOT EXISTS (
      SELECT 1 FROM public.crew_checklist_items ci
      WHERE ci.checklist_id = _checklist.id
        AND ci.item_text = (elem->>'item_text')::text
    );

    -- Update sort_order on existing items to match template order
    UPDATE public.crew_checklist_items ci
    SET sort_order = COALESCE((elem->>'sort_order')::int, ci.sort_order)
    FROM jsonb_array_elements(_tpl_items) AS elem
    WHERE ci.checklist_id = _checklist.id
      AND ci.item_text = (elem->>'item_text')::text;

    -- Delete items no longer present in the template
    DELETE FROM public.crew_checklist_items ci
    WHERE ci.checklist_id = _checklist.id
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(_tpl_items) AS elem
        WHERE (elem->>'item_text')::text = ci.item_text
      );

    -- Touch the checklist's updated_at
    UPDATE public.crew_checklists
    SET updated_at = now()
    WHERE id = _checklist.id;
  END LOOP;
END;
$$;

-- Trigger function: fires when a template's items change
CREATE OR REPLACE FUNCTION public.trg_sync_crew_checklists_from_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.items IS DISTINCT FROM OLD.items THEN
    PERFORM public.sync_crew_checklists_from_template(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_crew_checklists_on_template_update ON public.crew_checklist_templates;
CREATE TRIGGER sync_crew_checklists_on_template_update
AFTER UPDATE ON public.crew_checklist_templates
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_crew_checklists_from_template();