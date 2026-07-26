
-- Extend contract_templates scope to include photographer
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contract_templates' AND column_name='scope') THEN
    ALTER TABLE public.contract_templates ADD COLUMN scope text NOT NULL DEFAULT 'event';
  END IF;
END $$;

ALTER TABLE public.contract_templates DROP CONSTRAINT IF EXISTS contract_templates_scope_check;
ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_scope_check
  CHECK (scope IN ('event','series','both','photographer'));

-- Photographer contracts table
CREATE TABLE IF NOT EXISTS public.photographer_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  template_name text,
  title text NOT NULL DEFAULT 'Photographer Services Agreement',
  rendered_html text NOT NULL,
  signed_html_snapshot text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','signed','cancelled','expired')),
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  signed_by_name text,
  signed_by_email text,
  signature_data text,
  signing_token uuid UNIQUE DEFAULT gen_random_uuid(),
  signing_token_expires_at timestamptz,
  ip_address text,
  user_agent text,
  cancelled_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photographer_contracts_photographer_idx ON public.photographer_contracts(photographer_id);
CREATE INDEX IF NOT EXISTS photographer_contracts_token_idx ON public.photographer_contracts(signing_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photographer_contracts TO authenticated;
GRANT ALL ON public.photographer_contracts TO service_role;

ALTER TABLE public.photographer_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage photographer contracts"
  ON public.photographer_contracts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales view photographer contracts"
  ON public.photographer_contracts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'admin'));

-- Audit table
CREATE TABLE IF NOT EXISTS public.photographer_contract_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.photographer_contracts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_description text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photographer_contract_audit_contract_idx ON public.photographer_contract_audit(contract_id);

GRANT SELECT, INSERT ON public.photographer_contract_audit TO authenticated;
GRANT ALL ON public.photographer_contract_audit TO service_role;

ALTER TABLE public.photographer_contract_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view photographer contract audit"
  ON public.photographer_contract_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_photographer_contract_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_photographer_contracts_updated_at ON public.photographer_contracts;
CREATE TRIGGER trg_photographer_contracts_updated_at
BEFORE UPDATE ON public.photographer_contracts
FOR EACH ROW EXECUTE FUNCTION public.set_photographer_contract_updated_at();

-- Seed starter template if none exists
INSERT INTO public.contract_templates (name, body_html, format, is_active, scope)
SELECT
  'Photographer Services Agreement',
  $html$
<h1 style="text-align:center;">Photographer Services Agreement</h1>
<p style="text-align:center;"><strong>Between EventPix and {{photographer.name}}</strong></p>
<p><strong>Date:</strong> {{contract.created_date}}</p>

<h2>1. Parties</h2>
<p>This agreement is made between <strong>EventPix</strong> ("the Company") and:</p>
<ul>
  <li><strong>Photographer:</strong> {{photographer.name}}</li>
  <li><strong>Business Name:</strong> {{photographer.business_name}}</li>
  <li><strong>ABN / TFN:</strong> {{photographer.abn}}</li>
  <li><strong>Email:</strong> {{photographer.email}}</li>
  <li><strong>Phone:</strong> {{photographer.phone}}</li>
  <li><strong>Address:</strong> {{photographer.address}}, {{photographer.state}}</li>
</ul>

<h2>2. Engagement</h2>
<p>EventPix engages the Photographer as an independent contractor to provide event photography and related services on assigned jobs.</p>

<h2>3. Responsibilities</h2>
<ul>
  <li>Attend all assigned events on time with all required equipment in good working order.</li>
  <li>Maintain professional conduct with clients and guests at all times.</li>
  <li>Deliver photographs in accordance with EventPix's editing and delivery standards.</li>
  <li>Maintain current Public Liability Insurance and any legally required licences.</li>
</ul>

<h2>4. Fees &amp; Payment</h2>
<p>The Photographer will be paid according to the current EventPix rate card. Invoices are to be submitted following the completion of each assignment.</p>

<h2>5. Confidentiality &amp; Intellectual Property</h2>
<p>All images captured on EventPix assignments remain the intellectual property of EventPix and the client. The Photographer must not publish, share or use these images without written consent.</p>

<h2>6. Term &amp; Termination</h2>
<p>This agreement remains in effect until terminated by either party in writing. Both parties may terminate at any time subject to completion of any confirmed assignments.</p>

<h2>7. Acceptance</h2>
<p>By signing below, the Photographer acknowledges they have read, understood and agree to be bound by the terms of this Photographer Services Agreement.</p>
  $html$,
  'html', true, 'photographer'
WHERE NOT EXISTS (
  SELECT 1 FROM public.contract_templates WHERE scope = 'photographer'
);
