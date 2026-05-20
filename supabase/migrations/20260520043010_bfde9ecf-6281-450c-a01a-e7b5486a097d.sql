UPDATE contract_templates
SET body_html = regexp_replace(body_html, '<h2>Signatures</h2>.*?</table>\s*', '', 'gs'),
    body_text = regexp_replace(body_text, '<h2>Signatures</h2>.*?</table>\s*', '', 'gs'),
    updated_at = now()
WHERE id = '36f4fd57-ec5f-4be5-89bb-347ace9eddb9';