UPDATE public.contracts
SET rendered_html = regexp_replace(rendered_html, 'body \{.*acceptance-box h2 \{[^}]*\}', '', 's')
WHERE rendered_html ~ 'body \{[\s\S]*acceptance-box h2 \{';