# Company Categories Restructure + Client Type

## Goal
- Replace flat company categories with **Parent → Sub-category** structure.
- Add **Client Type** (Direct / Indirect) to companies.
- Wire both into list views, filters, dashboards, and campaign audience.

## 1. Database changes (single migration)

### `company_categories` (Parents — repurpose existing table)
- Add `is_parent boolean default true`, `excluded_from_campaigns boolean default false`.
- Wipe & re-seed with the 9 parents (CORPORATE … EPX SUPPLIER). EPX SUPPLIER gets `excluded_from_campaigns=true`.

### `company_subcategories` (new table)
```
id uuid pk
parent_id uuid → company_categories(id)
name text
sort_order int
is_active boolean default true
```
+ GRANTs, RLS (admins manage, all authenticated read), seeded with full sub-cat list above.

### `clients` table
- Add `subcategory_id uuid → company_subcategories(id)`.
- Add `client_type text check in ('Direct','Indirect') null`.
- Keep existing `category_id` column (now points at the new Parent rows).

### Data migration
- Build a temp mapping table from existing flat names → (parent name, sub name).
- For every existing `clients.category_id`, look up old name → upsert/find new parent + sub → set `clients.category_id` (parent) and `clients.subcategory_id` (sub).
- Unmapped names → create "Uncategorised" parent + sub, assign there.
- Drop the old flat category rows once nothing references them.

## 2. Hooks

- `useCompanyCategories` — return parents (already named so).
- Add `useCompanySubcategories(parentId?)` — sub list, filterable by parent.
- Add admin mutation hooks for sub CRUD (used in `CrmLookups`).

## 3. UI changes

### Company record (CompanyList drawer / ClientProfileCard / QuickCreateCompanyDialog)
- Replace single category picker with two-step: **Parent select** → **Sub-category select** (filtered by parent).
- New **Client Type** radio/select (Direct / Indirect / Unassigned). Hidden when Parent = EPX Supplier.

### Companies list (`CompanyList.tsx`)
- New columns: Parent Category, Sub-category, Client Type.
- New filters in toolbar: Parent, Sub-category (dependent on Parent), Client Type.

### Inline editor
- Update `InlineCategoryEditor` to a two-step popover (parent then sub).

### Bulk update
- Extend `BulkCategoryUpdateDialog` to set Parent + Sub; add Client Type bulk action.

### CRM Lookups admin (`CrmLookups.tsx`)
- Section for managing Parents and their Sub-categories (nested list with add/edit/archive).

### Dashboard (`PromotionsDashboard.tsx`)
- Category summary tiles roll up by **Parent**.

### Campaign Audience (`CampaignWizardDialog.tsx`)
- Add filters: Parent (multi), Sub-category (multi, scoped to selected parents), Client Type (Direct/Indirect/Any).
- Default-exclude parents flagged `excluded_from_campaigns` (EPX Supplier) unless user explicitly selects them.

## 4. Out of scope / preserved
- No client/contact records deleted.
- Contact-level category UI untouched (uses same parent list via existing hook; sub-category optional, left null).

## Technical notes
- Filter state in CompanyList: `parentId | 'all'`, `subcategoryId | 'all' | 'none'`, `clientType | 'all' | 'Direct' | 'Indirect' | 'unassigned'`.
- Campaign filter persisted in existing `email_campaigns.audience_filters` jsonb.
- Migration uses a single PL/pgSQL DO block to map names safely; preserves any unknown via "Uncategorised".
