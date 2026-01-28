-- Create a function to search contacts by tag (partial match)
CREATE OR REPLACE FUNCTION public.search_contacts_by_tag(search_term text)
RETURNS TABLE(contact_id uuid) AS $$
  SELECT DISTINCT cc.id as contact_id
  FROM public.client_contacts cc, unnest(cc.tags) AS tag
  WHERE tag ILIKE '%' || search_term || '%'
$$ LANGUAGE sql STABLE;

-- Add a comment for documentation
COMMENT ON FUNCTION public.search_contacts_by_tag IS 'Searches contacts where any tag contains the search term (case-insensitive partial match)';