
# Photographer Services Agreement Workflow

Add a new signing workflow so admins can generate, send and track a Photographer Services Agreement against a Team Member profile — independent of any client, event or job.

## 1. Database (migration)

New table `public.photographer_contracts`:
- `id`, `photographer_id` (references `profiles.id`), `template_id`, `template_name`
- `rendered_html` (locked snapshot on signing)
- `status` enum: `draft | sent | viewed | signed | cancelled | expired`
- `sent_at`, `signed_at`, `signed_by_name`, `signed_by_email`, `signature_data`
- `signing_token` (unique, uuid), `signing_token_expires_at`
- `ip_address`, `user_agent`
- `created_at`, `updated_at`, `created_by`

New table `public.photographer_contract_audit` (optional trail):
- `id`, `contract_id`, `event_type`, `event_description`, `created_at`, `created_by_user_id`, `ip_address`, `user_agent`

New template scope value: extend existing `contract_templates.scope` to allow `photographer` (or add a boolean `is_photographer_agreement`). Seed one starter template **"Photographer Services Agreement"** with merge fields `{{photographer.name|business_name|abn|email|phone|address|state}}` and `{{contract.created_date}}`.

RLS + GRANTs:
- Admin/Sales can manage all rows.
- Public read of a single row via `signing_token` handled through an edge function (service role) — no anon RLS.
- Audit table: admin read only, inserts via edge function.

## 2. Backend edge functions

- `send-photographer-agreement`: authenticated admin action. Loads photographer + template, renders HTML with photographer merge fields, upserts a `photographer_contracts` row (reuse existing draft when resending), issues a new signing token (30 days), sets `status=sent`, sends email via Gmail (`send-crm-email` pattern) with signing link `{PUBLIC_BASE_URL}/sign/photographer-agreement/{token}`.
- `photographer-agreement-sign`: public (verify_jwt=false). GET returns the rendered HTML + photographer/business summary for a valid token. POST accepts `{ full_name, email, signature_data }`, validates token not expired/signed/cancelled, snapshots HTML, sets `status=signed`, records IP + user agent, writes audit row.
- Resend and cancel are handled inline by `send-photographer-agreement` with an `action` param.

## 3. Frontend

- **Team member detail (`StaffDetail.tsx`)** – add a "Photographer Services Agreement" card in the Compliance tab (visible when the profile is a photographer/contractor):
  - Shows status, sent_at, signed_at.
  - Buttons vary by status: Send Agreement / View Agreement / Resend Agreement / Copy Signing Link / Cancel Agreement / View Signed Agreement.
- **`SendPhotographerAgreementDialog`** (new component): shows photographer name/email/business/ABN, template name, scrollable rendered preview, Cancel + Send for Signature buttons; disables send with the required message when email is missing.
- **`SignedAgreementDialog`** (new component): read-only display of the stored signed HTML with signed metadata.
- **`PublicSignPhotographerAgreement.tsx`** (new route `/sign/photographer-agreement/:token`): fetches via edge function, shows agreement, name/email fields, acceptance checkbox, typed-signature (name = signature), Sign Agreement button, success confirmation and locked view after signing/expiry.
- Add hook `usePhotographerAgreements(photographerId)` for status + actions (send/resend/cancel/copy link) using `supabase.functions.invoke` and query invalidation.

## 4. Merge-field rendering

Reuse existing merge-field renderer (`renderMergeFields` in `useContractTemplates`) with a new context shape mapping `photographer.*` and `contract.created_date`. Server-side rendering happens in the edge function so the signed snapshot is authoritative.

## 5. Wording & AU English

Use exact labels from the request: "Send Photographer Agreement", "View Agreement", "Resend Agreement", "Copy Signing Link", "View Signed Agreement", statuses "Sent / Not sent / Signed / Cancelled / Expired".

## Technical notes
- Public signing page never touches `profiles` directly — edge function returns only display-safe fields.
- Signed rows are immutable in the UI; regeneration only allowed while unsigned and warns before overwriting.
- Signing token: `gen_random_uuid()`, 30-day expiry, single use.
- Emails via existing Gmail-backed `send-crm-email` pattern to stay consistent with the hybrid email architecture.
- PDF: v1 offers "Print / Save as PDF" via browser print styles on the signed dialog; native PDF generation can follow.
