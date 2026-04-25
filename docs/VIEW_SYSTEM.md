# View System

The view system is the core business logic layer. It makes Google Sheets the single source of truth for what data each user can see, what columns are displayed, and how rows are filtered.

---

## Core Principle

> The `Settings` sheet in each Google Sheets workbook IS the authoritative configuration. The backend and frontend are consumers, not sources of truth.

When a user requests their view, the backend:

1. Fetches the current Settings sheet row from GAS (`view-config` action)
2. Extracts filter conditions and column list
3. Applies them to the raw database rows
4. Returns only the projected, filtered result

Any change to the Settings sheet in Google Sheets is immediately reflected without any code deployment.

---

## Settings Sheet Structure

Each Settings sheet row defines exactly one view. Column layout:

| Column | Field | Description |
|---|---|---|
| A | View Name | Display name shown to users |
| B | Sheet / Table | Which database sheet to read from |
| C | Filter Column 1 | Column name to filter by (e.g. MARKA_CODE) |
| D | Filter Value 1 | Value that must match (e.g. LLL) |
| E | Filter Column 2 | Second filter column (optional) |
| F | Filter Value 2 | Second filter value (optional) |
| G+ | Column List | Alphabetic column references (A, B, D, E…) |

### Example Settings row (LACE & GAYLE, Dua Lace view):

```
| View Name               | Sheet    | Filter Col 1 | Filter Val 1 | Filter Col 2     | Filter Val 2 | Columns           |
|-------------------------|----------|--------------|--------------|------------------|--------------|-------------------|
| Dua Trading & Co - Lace | Database | MARKA_CODE   | LLL          | PRODUCT_CATEGORY | Lace         | A,B,C,D,E,F,G,H,I |
```

---

## Column Selection — Alphabet System

Column letters reference the **physical column positions** in the Google Sheets database sheet, not header names. This is intentional: as columns are added to the sheet, the Settings value controls exactly which ones appear in the web view.

**Alphabet system rules:**
- Only columns explicitly listed in the Settings row are projected
- Letters must be comma-separated (e.g. `A,B,D,E,F`)
- Gaps are valid — `A,B,D` means skip column C
- The projection is applied after row filtering
- Empty columns (all blank cells) are not included in the output

**Example:** If the database sheet has columns A–L but Settings says `A,B,D,F,H`, only those five columns appear in the web output.

---

## View Matching (Backend)

The backend normalises view names before matching to handle:
- Whitespace differences
- Case differences
- `&` vs `and`
- Special character differences

**Normalisation steps:**

1. Strip leading/trailing whitespace
2. Lowercase
3. Replace `&` with `and`
4. Remove all non-alphanumeric characters except spaces

**Qualifier matching:**

Views with `-Lace` or `-Gayle` suffixes in the requested name are matched using a qualifier resolver to prevent ambiguity when multiple views share the same base company name.

For example: `Noor Fabrics - Lace` and `Noor Fabrics - Gayle` have the same base name but different qualifiers. The system extracts `lace` or `gayle` from the requested view and uses it to select the correct Settings row.

Relevant functions in `server/src/services/viewConfigService.js`:
- `normalizeViewName(value)` — strips qualifier suffix, normalises
- `resolveRequestedQualifier(value)` — returns `'lace'`, `'gayle'`, or `''`

---

## Filter Enforcement

Row-level filters are always enforced. The backend:

1. Reads `filterColumns` and `filterValues` arrays from the resolved Settings config
2. Passes them to the GAS `records` call as query parameters
3. GAS applies the filters on the sheet side (first-class, not post-filtering)
4. Backend applies `alignRecordsToView` for final column projection

This means users can never access rows outside their filter unless the Settings sheet is changed by an admin.

---

## Blank Row Handling

Blank rows in Google Sheets (spacer rows, formatting rows) are excluded before any comparison or output. A row is considered blank if every cell in the projected columns is either:
- An empty string
- A whitespace-only string
- Null or undefined

This is enforced in both the backend (`viewProjectionService.js`) and in GAS (`BRIDGE_viewOutput_`, `APP_getViewOutput`) using consistent blank-detection helpers.

---

## Multi-Database Views

Users can be assigned views across both databases:

| Database | Settings sheet | GAS bridge |
|---|---|---|
| MEN_MATERIAL | `settings` sheet in MEN Material workbook | `AKfycbwy...` |
| LACE_GAYLE | `Settings` sheet in Lace & Gayle workbook | `AKfycbx_...` |

A user with access to both databases will see a database selector in the UI. Their assigned views are stored in the user record and verified against the resolved GAS Settings config on every request.

---

## Verification Tool

The alignment verifier (`GET /api/admin/verify-view-alignment`) fetches both:
- **Web output:** What `/api/data` would return for a given view
- **Target output:** What GAS `view-output` returns for the same view (derived directly from the target sheet)

It normalises both result sets and compares row-by-row. A `match: true` result means the web view is 100% identical to the target sheet output.

Run verification after any GAS deployment or Settings sheet change.
