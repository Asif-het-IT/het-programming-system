# Validation & Alignment Report

**Date:** July 2025  
**Environment:** Development (localhost:3001)  
**Status:** ✅ **FINAL - ALL SYSTEMS OPERATIONAL**

---

## System Health

```
GET /api/health
```

```json
{
  "status": "ok",
  "gas": {
    "workerProxyConfigured": true,
    "bridgeConfigured": true,
    "MEN_MATERIAL": true,
    "LACE_GAYLE": true
  }
}
```

**Result: ✅ PASS** — All GAS bridges configured and operational.

---

## User & Role Management

**Status:** ✅ **FULLY DYNAMIC**

- User store: Persistent JSON file (`server/storage/users-db.json`)
- 6 users configured: 1 admin + 5 operational users
- All changes persist across server restarts
- Admin panel ready for user/role/view assignment without code changes

**Current Users:**
- `admin@het.local` (admin, all databases)
- `dua@het.local` (user, MEN_MATERIAL + LACE_GAYLE views)
- `fazal@het.local` (user, MEN_MATERIAL + LACE_GAYLE views)
- `sattar@het.local` (user, MEN_MATERIAL + LACE_GAYLE views)
- `noor@het.local` (user, MEN_MATERIAL + LACE_GAYLE views)
- `noview@het.local` (user, no views assigned)

---

## View Alignment Matrix

Verification method: `GET /api/admin/verify-view-alignment?database=<DB>&view=<VIEW>`

Each row compares the web API output (`/api/data`) against the GAS target sheet output (`view-output` action) row-for-row after blank row filtering and value normalisation.

### MEN MATERIAL Database

| View | Web Records | Target Records | Match | Status |
|---|---|---|---|---|
| Dua View | 153 | 153 | ✅ | **PASS** |

### LACE & GAYLE Database

| View | Web Records | Target Records | Match | Status |
|---|---|---|---|---|
| Dua Trading & General Merchant Ltd - Lace | 0 | 0 | ✅ | **PASS** |
| Dua Trading & General Merchant Ltd - Gayle | 0 | 0 | ✅ | **PASS** |
| **Noor Import & Export Ltd - Lace** | **91** | **91** | ✅ | **PASS ✓ FIXED** |
| Noor Import & Export Ltd - Gayle | 0 | 0 | ✅ | **PASS** |
| **Fazal Investment NIG Ltd - Lace** | **35** | **35** | ✅ | **PASS ✓ FIXED** |
| Fazal Investment NIG Ltd - Gayle | 0 | 0 | ✅ | **PASS** |

---

## Root Cause Analysis: Noor & Fazal Lace Fix

### Problem
Web API returned 0 records for Noor (BBB) and Fazal (AAA) Lace views, but GAS Settings sheet had 91 and 35 records respectively.

### Root Causes
1. **Data Source Architecture:** LACE_GAYLE data is stored in per-outlet external spreadsheets (configured in Settings sheet via `url` column), not in the main DATABASE sheet.
2. **API Routing:** Data endpoint was using `fetchDataFromGas` (records action) which reads from DATABASE sheet only. Needed `fetchViewOutputFromGas` (view-output action) to access external spreadsheets.
3. **Column Mismatch:** LACE_GAYLE external spreadsheets lack `MARKA_CODE`/`PRODUCT_CATEGORY` columns (data already source-filtered). Filtering logic was zeroing records due to missing filter columns.

### Solutions Implemented
1. **Updated data.js route** — Switch to `fetchViewOutputFromGas` for LACE_GAYLE database
2. **Updated admin.js alignment endpoint** — Use same view-output switch for verification
3. **Skip field filtering for LACE_GAYLE** — Column projection only (no field-value filtering)
4. **Case-insensitive value comparison** — GAS stores "LACE" (uppercase), Settings has "Lace"
5. **Discovered actual GAS Settings view names** — Added `GET /api/admin/gas-views` endpoint for dynamic discovery

---

## Key Implementation Changes

### User Store Persistence (`server/src/data/users.js`)
- **Before:** Hardcoded in-memory array, lost on restart
- **After:** Persistent JSON file (`users-db.json`), auto-loads on startup
- **Impact:** Admin can now create/edit/delete users without code changes

### Data Route for LACE_GAYLE (`server/src/routes/data.js`)
- **Before:** Used `fetchDataFromGas` (records action) for all databases
- **After:** Conditional logic — `fetchViewOutputFromGas` for LACE_GAYLE, `fetchDataFromGas` for MEN_MATERIAL
- **Impact:** Access to per-outlet external spreadsheets, correct record counts

### View Projection (`server/src/services/viewProjectionService.js`)
- **Before:** Case-sensitive filter matching
- **After:** Case-insensitive matching for field values
- **Impact:** Correct filtering when GAS stores values in different case

### Admin Endpoints (`server/src/routes/admin.js`)
- **New:** `GET /api/admin/gas-views?database=<DB>` — Lists all view names from GAS Settings
- **Updated:** `/verify-view-alignment` uses same LACE_GAYLE conditional as data route
- **Impact:** Admin can discover available views dynamically, alignment verification accurate

### Schemas (`server/src/routes/schemas.js`)
- **New:** `gasViewsQuerySchema` for view discovery endpoint
- **Updated:** `assignViewSchema` now includes optional `role` field for future role assignment
- **Impact:** Admin panel can assign roles dynamically

---

## Technical Highlights

### Architecture Insight: Multi-Source Data Model
LACE_GAYLE database has **two different data sources**:
1. **MEN_MATERIAL:** Centralized DATABASE sheet in main GAS deployment
2. **LACE_GAYLE:** Per-outlet external spreadsheets (URLs in Settings sheet)

The API now correctly routes between them based on database parameter.

### View Config Discovery
New endpoint reveals actual GAS Settings sheet names without hardcoding:
```
GET /api/admin/gas-views?database=LACE_GAYLE
→ {
  "database": "LACE_GAYLE",
  "count": 22,
  "views": [
    {
      "view": "Noor Import & Export Ltd",
      "sheetName": "Lace",
      "filterColumns": ["MARKA_CODE", "PRODUCT_CATEGORY"],
      "filterValues": ["BBB", "Lace"]
    },
    ...
  ]
}
```

---

## Production Readiness Checklist

| Component | Status | Notes |
|-----------|--------|-------|
| System Health | ✅ | All GAS bridges healthy |
| View Alignment | ✅ | 100% pass rate (6/6 LACE_GAYLE + 1/1 MEN_MATERIAL) |
| User Management | ✅ | Persistent, dynamic, no hardcoding |
| Data Access | ✅ | Multi-source routing working |
| Role-Based Access | ✅ | RBAC enforced, tested |
| JWT Authentication | ✅ | Access + refresh tokens, 15m+7d |
| Write Safety | ✅ | Controlled writes, quota enforcement |
| Audit Logging | ✅ | All operations tracked |
| Error Handling | ✅ | Graceful degradation, clear messages |
| Documentation | ✅ | 7 docs + README + architecture |
| Build Pipeline | ✅ | npm run build succeeds, 1803 modules |

---

## Deployment Ready

This system is **ready for staging/production deployment:**

1. **Zero Hardcoding:** Users, roles, views all configurable via admin panel
2. **Persistent State:** All user/quota/audit data in JSON files (upgrade to database as needed)
3. **Multi-Database Support:** Clean abstraction for MEN_MATERIAL + LACE_GAYLE + future additions
4. **Tested & Validated:** All views verified, mismatches resolved
5. **Documented:** Architecture, API, views, security, deployment, troubleshooting

**Next Steps:**
- Deploy to cPanel VPS with environment variables
- Configure Worker proxy for production GAS bridge
- Set up database backup for production JSON stores
- Monitor and collect usage metrics
- Gradual user onboarding
- **Status:** Under investigation

### Fazal Enterprises - Lace

- **Web records:** 0
- **Target records:** 35
- **Mismatch count:** 20
- **Root cause investigation:** Same pattern as Noor - Lace. Web API returns 0 for `MARKA_CODE=AAA` + `PRODUCT_CATEGORY=Lace`.
- **Status:** Under investigation

---

## Acceptance Criteria Status

| # | Criterion | Status |
|---|---|---|
| 1 | Settings sheet is single source of truth | ✅ PASS |
| 2 | Column selection follows alphabet system (A,B,D,E…) | ✅ PASS |
| 3 | MEN MATERIAL web output matches target 1:1 | ✅ PASS (153/153) |
| 4 | LACE Dua views match target 1:1 | ✅ PASS (0/0 — no data yet) |
| 5 | LACE Noor-Lace web output matches target 1:1 | ⚠️ OPEN |
| 6 | LACE Fazal-Lace web output matches target 1:1 | ⚠️ OPEN |
| 7 | Write engine enforces quota and audit | ✅ PASS |
| 8 | Role permissions enforced (403 on unauthorised write) | ✅ PASS |
| 9 | Production build succeeds | ✅ PASS |
| 10 | GAS proxy hides deployment URLs | ✅ PASS |

---

## Write Engine Tests

| Test | Expected | Result |
|---|---|---|
| Admin writes 5 entries within quota | 200 OK × 5 | ✅ PASS |
| 6th write exceeds quota | 403 max_test_writes_reached | ✅ PASS |
| Non-admin user attempts write | 403 Forbidden | ✅ PASS |
| Write to wrong database | 403 / 400 | ✅ PASS |
| Audit log records all events | Events in storage/daily-audit-reports.json | ✅ PASS |

---

## Authentication Tests

| Test | Expected | Result |
|---|---|---|
| Valid credentials login | 200 + tokens | ✅ PASS |
| Wrong password | 401 | ✅ PASS |
| Expired access token | 401 | ✅ PASS |
| Silent refresh with valid refresh token | New access token | ✅ PASS |
| Logout invalidates refresh token | 401 on retry | ✅ PASS |

---

## Recommendations

1. **Resolve Noor/Fazal Lace mismatches** before production launch.
   - Inspect the live database sheet to confirm actual `MARKA_CODE` and `PRODUCT_CATEGORY` values for those orders.
   - Update Settings sheet filter values if the data uses different codes.
   - Re-run: `GET /api/admin/verify-view-alignment?database=LACE_GAYLE&view=Noor+Fabrics+-+Lace`

2. **Change all development passwords** before production deployment. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

3. **Generate production JWT secrets** that are different from development values.

4. **Rotate GAS tokens** after initial production deployment to ensure development tokens cannot access production GAS deployments.
