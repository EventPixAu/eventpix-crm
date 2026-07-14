## Series-Level Budgets & Agreements

Enable one budget and one contract that cover an entire event series, priced "per event × N events", with the option to add per-event addendum quotes for client-requested extras.

### 1. Data model changes

Add series-scoping to `quotes` and `contracts` (both currently event-scoped):

- `quotes`
  - `event_series_id UUID NULL` → FK to `event_series`
  - `scope TEXT NOT NULL DEFAULT 'event'` → `'event' | 'series' | 'addendum'`
  - `parent_quote_id UUID NULL` → FK to `quotes` (used when `scope = 'addendum'`)
  - Constraint: `scope='series'` requires `event_series_id NOT NULL` and `event_id NULL`.
  - Constraint: `scope='addendum'` requires `event_id NOT NULL` and `parent_quote_id NOT NULL`.
- `quote_items`
  - `pricing_basis TEXT NOT NULL DEFAULT 'flat'` → `'flat' | 'per_event'`
  - `event_count INT NULL` (snapshot used at accept time for per_event lines)
- `contracts`
  - `event_series_id UUID NULL` → FK
  - `scope TEXT NOT NULL DEFAULT 'event'` → `'event' | 'series'`
  - Same nullability constraint as quotes.

RLS: mirror existing quote/contract policies (owners + admin/ops) — no policy structure change.

### 2. Series budget builder

New tab on the series Program Control Centre (`Mastercard 2026` screenshot): **Budget & Agreement**.

- Create/edit a single Series Quote for the series.
- Line items each mark **Per event** or **Flat** (checkbox). Per-event lines display `unit × N events = subtotal` where N = count of non-cancelled events currently in the series.
- Live totals panel: `Per-event subtotal`, `Flat subtotal`, `Number of events`, `Grand total`.
- Standard note auto-inserted (editable): *"Fees marked 'per event' apply to each scheduled event in this series. Additional services requested for a specific event will be quoted separately as an addendum."*
- Actions: Save draft · Send for acceptance · Download PDF (reuses existing proposal PDF pipeline with series header).

### 3. Series contract

- New Series Contract type built off existing `contract_templates` with `{{series_name}}`, `{{event_count}}`, `{{per_event_total}}`, `{{flat_total}}`, `{{grand_total}}` merge fields.
- Same public accept flow as event contracts (`PublicAcceptContract.tsx`), scoped to series.
- Once accepted, the series shows a green "Agreement in place" badge; each event in the series inherits an "Under series agreement" indicator on its detail page (replaces the "needs individual quote/contract" nag).

### 4. Per-event addendum quotes

- On any event that belongs to a series with an accepted series quote, the QuoteList shows a new button **"Add addendum quote"** instead of "New quote".
- Addendum quotes copy client/contact from event, set `parent_quote_id` to the series quote, and only contain the extra line items for that event.
- Event financials roll up = (its share of series quote) + (accepted addendum quotes).

### 5. UI touchpoints

- `src/pages/admin/EventSeriesList.tsx` → open series → new **Budget & Agreement** tab.
- New `src/components/series/SeriesQuoteBuilder.tsx`, `SeriesContractPanel.tsx`.
- `QuoteDetail.tsx` → render per-event breakdown when `scope='series'`; render "Addendum to #Q-xxx" banner when `scope='addendum'`.
- `EventDetail` financial panel → show "Covered by series agreement Q-xxx" plus any addendum totals.

### 6. Out of scope for this pass

- Invoicing/Xero split across events (kept as-is; series quote invoices as one line for now — happy to add per-event invoice generation next).
- Retroactive migration of already-issued per-event quotes into a series quote.

### Technical notes

- Migration adds the columns above with defaults so existing rows stay `scope='event'`.
- `event_count` on a per-event line is recalculated whenever the series quote is edited **before** acceptance; frozen at acceptance so later event additions/removals don't silently change the signed amount.
- PDF generator (`generate-proposal-pdf`) gets a `scope` branch to render the series header, event list, and per-event math table.
- Addendum quotes reuse the existing quote acceptance edge function; only the UI entry point differs.

Confirm and I'll ship it — starting with the migration, then the builder UI, then the PDF/accept flow updates.
