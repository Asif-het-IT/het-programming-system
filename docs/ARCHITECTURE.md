# System Architecture

## Overview

The platform is a multi-layer enterprise web application that connects a secure React frontend to Google Sheets databases through a chain of authenticated services.

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│              https://programing.hetdubai.com                    │
│                   React SPA (Vite build)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │  HTTPS / JWT Bearer Token
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API                                │
│               Node.js + Express (port 3001)                     │
│  • JWT authentication & refresh tokens                          │
│  • Role-based access control (admin / manager / user)           │
│  • View-based row and column filtering                          │
│  • Controlled write engine (mapping + resolver)                 │
│  • Quota enforcement + persistent audit log                     │
└────────────────────────────┬────────────────────────────────────┘
                             │  Internal HTTP (GAS Proxy Auth Token)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               CLOUDFLARE WORKER PROXY                           │
│          https://het-gas-proxy.hetgraphic17.workers.dev         │
│  • Hides real GAS deployment URLs from browser                  │
│  • Validates x-proxy-auth header before forwarding              │
│  • Forwards requests to correct GAS endpoint per database       │
└──────────────┬──────────────────────────────┬───────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  MEN MATERIAL GAS        │   │  LACE & GAYLE GAS                │
│  Google Apps Script      │   │  Google Apps Script              │
│  • records               │   │  • records (with view filter)    │
│  • dashboard             │   │  • dashboard                     │
│  • view-config           │   │  • view-config (Settings sheet)  │
│  • view-output           │   │  • view-output (target sheet)    │
│  • save-entry            │   │  • save-entry                    │
└──────────────┬───────────┘   └──────────────┬───────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  MEN MATERIAL            │   │  LACE & GAYLE DATABASE           │
│  Google Sheets           │   │  Google Sheets                   │
│  • MEN MATERIAL sheet    │   │  • Database sheet                │
│  • settings sheet        │   │  • Settings sheet                │
│                          │   │  • Per-outlet target sheets      │
└──────────────────────────┘   └──────────────────────────────────┘
```

---

## Layer Details

### 1. Frontend (React SPA)

| Technology | Purpose |
|---|---|
| React 18 + Vite | Component framework and bundler |
| Tailwind CSS + Radix UI | Styling and accessible component primitives |
| Zustand | Global state (auth, active DB, active view) |
| TanStack Query | Server-state caching and background refetch |
| TanStack Virtual | Virtualized table rows for 10k+ records |
| Recharts | Charts (by product, marka, stage, category) |
| Axios | HTTP client with JWT interceptor and refresh retry |

The frontend **never** calls GAS or Google Sheets directly. All requests go through the backend API using a Bearer JWT token.

**Key pages:**

| Route | Component | Access |
|---|---|---|
| `/login` | Login.jsx | Public |
| `/dashboard` | UserDashboard.jsx | All authenticated |
| `/admin` | AdminPanel.jsx | admin only |

---

### 2. Backend API (Node.js + Express)

**Entry:** `server/index.js` → `server/src/app.js`

**Route map:**

| Prefix | File | Guard |
|---|---|---|
| `/api/login`, `/api/refresh` | routes/auth.js | Public (rate-limited) |
| `/api/data`, `/api/dashboard`, `/api/filters`, `/api/save-entry`, `/api/export` | routes/data.js | JWT required |
| `/api/admin/*` | routes/admin.js | JWT + `admin:manage` permission |
| `/api/health` | routes/health.js | Public |

**Services:**

| Service | Responsibility |
|---|---|
| `gasClient.js` | HTTP calls to Cloudflare Worker → GAS |
| `viewConfigService.js` | Fetches + caches Settings sheet config; normalises view names |
| `viewProjectionService.js` | Strict column projection and row filtering against settings |
| `viewAlignmentResolver.js` | Enforces filter conditions for write payloads |
| `cache.js` | In-memory TTL cache for GAS responses |

**Security middleware applied in order:**

1. `helmet` — secure headers
2. `cors` — origin allowlist from `CORS_ORIGINS`
3. `compression` — gzip
4. `morgan` — HTTP request log
5. `express-rate-limit` — per-IP limits on auth and data routes
6. `requireAuth` — verifies JWT, attaches `req.user`
7. `requirePermission` — checks role permissions map
8. `validate` (Zod) — validates query and body schemas

---

### 3. Cloudflare Worker

**File:** `cloudflare-worker/src/index.js`
**Config:** `cloudflare-worker/wrangler.toml`

The Worker is a lightweight HTTP proxy that:
- Accepts requests from the backend (verified with `x-proxy-auth` header secret)
- Routes to either the MEN_MATERIAL or LACE_GAYLE GAS deployment URL based on `?database=` query param
- Never exposes real GAS URLs to the browser
- Uses Cloudflare secrets (`wrangler secret put`) so credentials are never in code

---

### 4. Google Apps Script (GAS)

Two independent GAS projects, one per database.

**MEN MATERIAL actions (doGet):**

| `?api=` | Function | Description |
|---|---|---|
| `records` | `BRIDGE_records_` | Paginated data with view/marka/search filters |
| `dashboard` | `BRIDGE_dashboard_` | Summary stats |
| `product-names` | `BRIDGE_productNames_` | Filter dropdown values |
| `view-config` | `BRIDGE_viewConfig_` | Settings sheet rows |
| `view-output` | `BRIDGE_viewOutput_` | Projected records matching settings config |
| `save-entry` | `BRIDGE_saveEntry_` | Append validated row (POST) |

**LACE & GAYLE actions (doGet/doPost):**

| `?action=` | Function | Description |
|---|---|---|
| `records` | `APP_listEntries` | Paginated data |
| `dashboard` | `APP_getDashboardData` | Summary stats |
| `view-config` | `APP_getViewConfig` | Settings sheet rows with qualifier matching |
| `view-output` | `APP_getViewOutput` | Target sheet projected records |
| `save-entry` | `APP_saveEntry` | Append validated row (POST) |

---

### 5. Google Sheets

#### MEN MATERIAL spreadsheet

Single source spreadsheet with:
- `MEN MATERIAL` — main data sheet (all orders)
- `settings` — view definitions (see [VIEW_SYSTEM.md](VIEW_SYSTEM.md))

#### LACE & GAYLE spreadsheet

Main spreadsheet with:
- `Database` — all Lace & Gayle orders
- `Settings` — view definitions with MARKA_CODE + PRODUCT_CATEGORY filters
- Separate per-outlet **target sheets** (Lace / Gayle per company)

---

## Request Lifecycle Example — User views Dua Lace data

```
1. User opens dashboard → React reads auth from Zustand
2. React calls: GET /api/data?database=LACE_GAYLE&view=Dua+Trading+%26+...+-+Lace
3. Backend: requireAuth → verifies JWT, reads user.views → checks "Dua Trading... - Lace" is assigned
4. Backend: viewConfigService.getViewConfigFromSource() → calls GAS view-config → returns Settings row
   { view: "Dua Trading...", sheetName: "Lace", filterColumns: ["MARKA_CODE","PRODUCT_CATEGORY"], filterValues: ["LLL","Lace"], columnsList: ["A","B","D","E","H",...] }
5. Backend: for `LACE_GAYLE`, calls GAS `view-output` via Cloudflare Worker using the resolved Settings row
6. GAS: opens the per-outlet spreadsheet URL from Settings and reads the `Lace` target sheet directly
7. Backend: projects the returned rows to only the allowed columns from Settings
8. Backend: returns projected records as JSON
9. React: renders virtualised table — user sees only their authorised data
```
