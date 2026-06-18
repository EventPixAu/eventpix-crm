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
  SELECT COALESCE(items, '[]'::jsonb) INTO _tpl_items
  FROM public.crew_checklist_templates
  WHERE id = _template_id;

  IF _tpl_items IS NULL THEN
    RETURN;
  END IF;

  FOR _checklist IN
    SELECT id FROM public.crew_checklists WHERE template_id = _template_id
  LOOP
    INSERT INTO public.crew_checklist_items (checklist_id, item_text, sort_order, is_done)
    SELECT
      _checklist.id,
      elem->>'item_text',
      COALESCE(NULLIF(elem->>'sort_order', '')::int, ordinality::int - 1),
      false
    FROM jsonb_array_elements(_tpl_items) WITH ORDINALITY AS item(elem, ordinality)
    WHERE COALESCE(elem->>'item_text', '') <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM public.crew_checklist_items ci
        WHERE ci.checklist_id = _checklist.id
          AND ci.item_text = elem->>'item_text'
      );

    UPDATE public.crew_checklist_items ci
    SET sort_order = COALESCE(NULLIF(item.elem->>'sort_order', '')::int, item.ordinality::int - 1)
    FROM jsonb_array_elements(_tpl_items) WITH ORDINALITY AS item(elem, ordinality)
    WHERE ci.checklist_id = _checklist.id
      AND ci.item_text = item.elem->>'item_text';

    DELETE FROM public.crew_checklist_items ci
    WHERE ci.checklist_id = _checklist.id
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(_tpl_items) AS item(elem)
        WHERE ci.item_text = item.elem->>'item_text'
      );

    UPDATE public.crew_checklists
    SET updated_at = now()
    WHERE id = _checklist.id;
  END LOOP;
END;
$$;

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
AFTER UPDATE OF items ON public.crew_checklist_templates
FOR EACH ROW
WHEN (NEW.items IS DISTINCT FROM OLD.items)
EXECUTE FUNCTION public.trg_sync_crew_checklists_from_template();

DO $$
DECLARE
  _template_id uuid;
BEGIN
  FOR _template_id IN SELECT id FROM public.crew_checklist_templates LOOP
    PERFORM public.sync_crew_checklists_from_template(_template_id);
  END LOOP;
END;
$$;