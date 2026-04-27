# het Programming Database — Enterprise SaaS System Full Technical Report

## 1. Executive Summary

The het Programming Database is an enterprise SaaS-style data platform that provides secure, role-based access to business datasets managed in Google Sheets, with a React frontend, Express API, Cloudflare proxy layer, and Google Apps Script data services.

### What this system does
- Serves operational data to authenticated users through controlled database and view access.
- Enforces row, view, and column security from backend policy plus sheet-driven settings.
- Supports read, dashboard analytics, controlled writes, and filtered exports.
- Provides complete admin governance: user lifecycle, permission control, quotas, logs, and monitoring.
- Supports PWA installability and push notifications for announcements and sync incidents.

### Why it was built
- To move spreadsheet-based business operations into a governed enterprise access model.
- To preserve Google Sheets as source of truth while adding SaaS-grade control, auditability, and security.
- To centralize operational controls for administrators without changing core business sheet workflows.

### Supported Google Sheet databases
- MEN_MATERIAL
- LACE_GAYLE

### Admin control coverage
Admin can control:
- Users, roles, passwords, account status
- Database assignment, view assignment, Lace/Gayle split access
- Database-level and view-level column visibility
- Write permissions and per-user quota limits
- Export, audit, monitoring, sync refresh, force reload
- Push notification targets and delivery logs

## 2. Full Architecture

### End-to-end flow

```text
Frontend React App
→ Backend Express API
→ Cloudflare Worker
→ Google Apps Script
→ Google Sheets
```

### Layer roles and why each exists
- Frontend React App:
  - Presents login, dashboard, admin operations, monitoring, and notification UI.
  - Keeps access token in runtime state and calls only backend APIs.
- Backend Express API:
  - Central trust and policy layer.
  - Enforces JWT, RBAC, view scope, column restrictions, quotas, validation, and audit logging.
- Cloudflare Worker:
  - Security proxy between backend and GAS.
  - Hides GAS URLs and validates proxy auth header.
- Google Apps Script:
  - Business-data adapter for Google Sheets.
  - Implements records, dashboard, view-config, view-output, and save-entry actions.
- Google Sheets:
  - Primary source of truth for records and view settings.

### Security across layers
- Browser never calls GAS directly.
- Backend enforces all access decisions before any data response.
- Worker validates x-proxy-auth and keeps GAS URLs/tokens off frontend.
- GAS validates secret token and action contracts.
- Sensitive config lives in environment variables and platform secrets.

## 3. Frontend Report

### Key frontend modules
- Login page:
  - File: src/pages/Login.jsx
  - Handles credential submission, error display, and role-based navigation.
- User dashboard:
  - File: src/pages/UserDashboard.jsx
  - Supports database/view selection, filters, paginated fetch, virtualized table rendering, export actions, theme toggle, PWA install, and notification setup.
- Admin panel:
  - File: src/pages/AdminPanel.jsx
  - Manages users, views, columns, permissions, quotas, logs, notifications, and monitoring.
- Notification setup:
  - File: src/components/NotificationSetup.jsx
  - Registers PushManager subscription through service worker and backend notification APIs.
- PWA install prompt:
  - File: src/components/PwaInstallButton.jsx
  - Uses beforeinstallprompt event to show Install App CTA.

### Major frontend feature logic
- Database selector and view selector:
  - Populated from assigned views returned by /api/my-views.
- Filters and search:
  - Applied through request query params (search, marka, product, date range, sort).
- Table rendering:
  - Uses virtualization for high-row performance.
- Export buttons:
  - Triggers export endpoint by selected database/view/format.
- Theme support:
  - Light/dark toggle component integrated in dashboard/admin.
- PWA install and notification controls:
  - User-accessible action buttons integrated in dashboard UI.

## 4. Backend Report

### Route modules and responsibilities
- Authentication routes:
  - File: server/src/routes/auth.js
  - Endpoints: /api/login, /api/refresh
  - Creates JWT tokens and validates refresh token state.
- Data routes:
  - File: server/src/routes/data.js
  - Endpoints: /api/data, /api/dashboard, /api/filters, /api/save-entry, /api/export, /api/my-views
  - Enforces access scope, applies view/column projection, and write controls.
- Admin routes:
  - File: server/src/routes/admin.js
  - User management, view assignment, column inspection, audit access, alignment verification, notification sending.
- Monitoring routes:
  - File: server/src/routes/monitoring.js
  - Status, logs, performance, refresh, force-reload, log clear, Lace/Gayle per-view monitoring.
- Notification subscription routes:
  - File: server/src/routes/notifications.js
  - VAPID public key, subscribe, unsubscribe, heartbeat.

### Data and governance stores
- Users and refresh token logic:
  - File: server/src/data/users.js
  - Stores user records in server/storage/users-db.json with role, views, permissions, quotas, allowed columns.
- Quota control:
  - File: server/src/data/quotaStore.js
  - Tracks daily/monthly/total plus test/live write counts in server/storage/quota-db.json.
- Audit logs:
  - File: server/src/data/auditLog.js
  - Captures security and admin actions with normalized event records.
- Sync logs:
  - File: server/src/data/syncLog.js
  - Persistent circular log for sync success/error/cache events in server/storage/sync-log.json.
- Notification logs:
  - File: server/src/data/notificationLog.js
  - Records admin push sends and delivery outcomes.

### Core backend capabilities
- Authentication and JWT:
  - Access token and refresh flow with role payload and permission metadata.
- Roles and permissions:
  - Role matrix and per-user overrides via server/src/config/rolePermissions.js.
- Database/view/column access:
  - Scope enforcement in data routes plus response projection.
- Quota control:
  - Blocks writes after configured limits and audits blocked attempts.
- Monitoring APIs:
  - Admin-only runtime visibility and manual control of sync operations.

## 5. Google Sheet / GAS Logic

### MEN_MATERIAL logic
- Main script file:
  - gas/apps-script/men-material/Code.js
- View config endpoint:
  - BRIDGE_viewConfig_ reads settings sheet rows and returns:
    - view
    - columnsList
    - filterColumns
    - filterValues
- View output endpoint:
  - BRIDGE_viewOutput_ resolves view config and projects records to configured columns.
- Data fetch behavior:
  - BRIDGE_records_ reads source rows, applies view filters, then pagination and response object.

### LACE_GAYLE logic
- Main script file:
  - gas/apps-script/lace-gayle/Code.js
- Lace/Gayle split and qualifiers:
  - APP_getViewConfig resolves view names, normalizes qualifiers, and supports Lace/Gayle matching.
- MARKA_CODE and PRODUCT_CATEGORY filtering:
  - Settings-driven filterColumns/filterValues are part of view config response.
- Outlet-wise view logic:
  - APP_getViewOutput opens outlet spreadsheet URL from Settings and reads target sheet output.
- Settings sheet as control plane:
  - Columns include NAME, URL, SHEET_NAME, COLUMNS, FILTER_COLUMN, FILTER_VALUE, ACTIVE.

### Source-of-truth logic
- Google Sheets Settings rows are authoritative for:
  - Which view exists
  - Which sheet or outlet URL is used
  - Which columns are visible (alphabet style)
  - Which field filters apply

### Alphabet column selection
- Settings supports letter-based column lists, for example:
  - A,B,D,E,H
- Backend and GAS convert letters into index projection so only listed columns are returned.

## 6. Admin Control System

### Admin capabilities
- Create, edit, delete users
- Enable/disable users
- Reset passwords
- Assign roles
- Assign databases
- Assign views
- Assign Lace/Gayle access via qualified views
- Assign allowed columns by database
- Assign allowed columns by specific view
- Assign quotas (daily/monthly/total/test/live)
- Monitor sync and logs
- Send push notifications

### Enforcement model
- Frontend shows controls, backend enforces controls.
- Every admin route requires auth plus admin:manage permission.
- Critical admin actions write audit events for traceability.

## 7. View & Column Security Logic

### Access layers
- Database-level access:
  - User must have assigned database or wildcard.
- View-level access:
  - User must have assigned view or wildcard.
- Column-level access:
  - Optional policy by database and/or by specific view.
  - Per-view column policy overrides database-level policy.

### Response filtering
- Backend aligns data to view configuration.
- Backend applies allowed column projection after alignment.
- Hidden columns are removed from response payload before sending to frontend.

### Export filtering and API protection
- Export route checks scope and column restrictions.
- Restricted users cannot receive raw downloadUrl exports that could bypass column policy.
- Unauthorized access attempts return 403 and are auditable.

## 8. Export System

### Supported formats
- Excel
- PDF
- PNG

### Export control flow
- User requests export for selected database/view.
- Backend validates permissions and scope.
- Backend applies view alignment and column restrictions.
- Export response is blocked if policy could leak hidden columns through direct file URL.

### Data leakage prevention
- Hidden fields are filtered before export payload creation.
- Export endpoint denies unsafe paths when column restrictions are configured.

## 9. Monitoring & Sync System

### Monitoring features
- Data source status per database
- Manual sync refresh
- Force reload with cache clear
- Optional auto-refresh in admin UI
- Sync logs and error visibility
- Performance metrics (avg, p50, p95, error rate, cache hit rate)
- LACE_GAYLE per-view monitoring table
- Sync failure detection and alert pipeline

### Final Enterprise QA Addendum (2026-04-27)

### Build and Runtime Validation
- `npm install` completed successfully.
- `npm run build` completed successfully.
- `npm run build:prod` completed successfully.
- Backend runtime started and validated on `http://localhost:3001`.

### Security and Access Control Validation
- Unauthenticated access to protected endpoints returns 401.
- Authenticated non-admin access to admin endpoints returns 403.
- Admin routes confirmed behind `requireAuth` and `requirePermission('admin:manage')` patterns.
- No tracked source files were found containing active production secrets during tracked-file review.

### Functional API Validation
- Admin lifecycle APIs validated end-to-end:
  - create user
  - update user
  - reset password
  - disable user
  - enable user
  - delete user
- Monitoring and notifications status endpoints validated.
- Dynamic database/view builder APIs validated with create and delete test cycle.

### Live Data Alignment Validation
- MEN_MATERIAL alignment checks sampled with `mismatchCount=0`.
- LACE_GAYLE alignment checks sampled with `mismatchCount=0`.

### Export Validation Result
- Passing formats: PDF, EXCEL, PNG.
- Current non-passing formats in API probes: CSV, JSON (400 response).

### UI Validation Notes
- Login screen branding verified with required footer identity lines.
- Admin route wiring and Admin About route integration verified in code and route map.
- Dev-server availability issues can produce stale browser websocket errors when Vite is not running; not a production backend defect.

### Per-view Lace/Gayle visibility
- Endpoint: /api/admin/monitoring/lace-gayle/views
- Returns:
  - viewName
  - sheetType (Lace or Gayle)
  - markaCode
  - productCategory
  - sourceUrl
  - sourceSheetName
  - lastSyncStatus
  - recordCount
  - lastError

### Sync failure alert logic
- GAS fetch path is instrumented in server/src/services/gasClient.js.
- On real failures, server/src/services/syncAlerts.js is called.
- Alerts are deduplicated with cooldown and logged to audit trail.
- Manual monitoring refresh/reload suppresses alerts by design.

## 10. Push Notification System

### Components
- PWA service worker:
  - File: public/service-worker.js
  - Handles push event and notification click routing.
- User subscription flow:
  - NotificationSetup requests permission and registers endpoint.
- VAPID keys:
  - Stored in server environment (WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, WEB_PUSH_SUBJECT).
- Admin notification panel:
  - In AdminPanel, can target all, email, role, databases, or specific views.
- Notification delivery service:
  - server/src/services/pushService.js sends payloads to saved subscriptions.
- Notification logs:
  - server/src/data/notificationLog.js stores delivery summary.

### Operational prerequisites
- Browser notification permission must be granted.
- For sync-failure push alerts to deliver, at least one admin browser must be subscribed.

## 11. PWA / Install App

### PWA assets and behavior
- Manifest file:
  - public/manifest.json
- Service worker:
  - public/service-worker.js
- Icons:
  - public/icon-192.png
  - public/icon-512.png
- Install prompt:
  - src/components/PwaInstallButton.jsx listens to beforeinstallprompt.

### Install behavior
- Desktop and mobile browsers that support PWA show install flow.
- After installation, app runs in standalone display mode as defined in manifest.

## 12. Security Report

### Security controls
- No hardcoded production credentials in source.
- Environment secrets are loaded from server/.env and cloud worker secrets.
- .env files are not intended for repository commits.
- Cloudflare Worker hides GAS endpoints and tokens from frontend.
- Backend is the policy gate for all protected operations.
- Audit logs record critical admin and write actions.
- Admin-only APIs require admin:manage permission.
- CORS origin allowlist is enforced from environment config.
- Bootstrap admin variables are one-time startup controls and should be removed after first admin creation.

## 13. Performance Report

### Performance techniques
- API cache for frequently requested read actions.
- Warm request performance through cache-hit pathways.
- Pagination controls on data routes for large datasets.
- Virtualized frontend table rendering for large row counts.
- Monitoring metrics for latency and cache hit analysis.

### Large data handling
- Data APIs return paginated records.
- Frontend keeps rendering cost low with virtualized rows.
- Backend avoids exposing full unrestricted data for restricted users.

## 14. Operations Guide

### Local run
1. Install dependencies with npm install.
2. Configure frontend and backend environment files.
3. Start frontend: npm run dev.
4. Start API: npm run dev:api.

### Deploy
1. Build frontend with npm run build.
2. Deploy dist to static host and run API server with process manager.
3. Configure reverse proxy for /api to backend port.
4. Deploy Cloudflare Worker and set secrets.
5. Deploy GAS updates via clasp and update production deployment IDs.

### Create first admin
1. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in server/.env.
2. Start API once to bootstrap account.
3. Remove bootstrap values immediately after account creation.

### Onboard user
1. Create user from admin panel.
2. Assign role.
3. Assign databases and views.
4. Assign allowed columns and quota policy.
5. Verify user login and access scope.

### Enable notifications
1. Configure WEB_PUSH_* keys in server/.env.
2. User enables notifications in browser.
3. Admin confirms subscription count in notification status panel.

### Backup
- Schedule backups for:
  - server/storage/users-db.json
  - server/storage/quota-db.json
  - server/storage/sync-log.json
  - server/storage/notification-log.json
  - Google Sheets workbooks and settings tabs

### Rollback
- API rollback:
  - Deploy prior server release and restart process manager.
- Frontend rollback:
  - Re-serve prior dist bundle.
- Worker rollback:
  - Redeploy previous worker revision.
- GAS rollback:
  - Re-point to prior deployment version and verify endpoint contract.

## 15. File/Folder Structure

```text
src/
  Frontend React pages, components, API client, state, UI logic
server/
  Express API, routes, middleware, config, services, data stores
cloudflare-worker/
  Worker proxy implementation and wrangler configuration
gas/
  Google Apps Script source for MEN_MATERIAL and LACE_GAYLE
docs/
  Architecture, security, deployment, troubleshooting documentation
public/
  PWA assets: service worker, manifest, icons, offline assets
server/storage/
  Runtime JSON stores: users, quotas, sync logs, notification logs
```

## 16. Final Validation Summary

Validated in current enterprise cycle:
- Login flow and role-based redirection
- Dashboard data load and filters
- Admin panel user management operations
- MEN_MATERIAL data access and view behavior
- LACE_GAYLE data access and outlet view behavior
- Lace/Gayle qualified view handling
- Column restriction enforcement
- Export restriction enforcement
- Monitoring APIs including status/logs/performance/refresh/force reload
- LACE_GAYLE per-view monitoring endpoint and admin rendering
- Push notification subscription/send flow
- Sync-failure alert pipeline behavior (with subscriber/no-subscriber handling)
- PWA build/install infrastructure
- GitHub delivery workflow and deployment readiness

## 17. Known Notes / Operational Warnings

- Some views can return zero records when source sheet or filter criteria has no data.
- Admin browser subscription is required to actually receive push sync alerts.
- Bootstrap admin environment values must be removed after first setup.
- Secrets must never be committed into repository history.
- Backup scheduling for storage JSON and Google Sheets is mandatory for operations.
- Manual monitoring refresh is intentionally alert-suppressed and should not be treated as failure.

## 18. Database Schema Tables

### MEN_MATERIAL — Column Definitions

| # | Column Name | Type | Visible | Notes |
|---|---|---|---|---|
| 1 | SR | Number | Yes | Auto-incremented serial row number |
| 2 | PROCESS_DATE | Date | Yes | Order processing date |
| 3 | PRODUCT_CATEGORY | String | Yes | Top-level product category |
| 4 | PRODUCT_NAME | String | Yes | Product name / style |
| 5 | FACTORY | String | Yes | Manufacturing factory name |
| 6 | MARKA_CODE | String | Yes | Brand/marka identifier code |
| 7 | OUTLET_NAME | String | Yes | Outlet or customer name |
| 8 | DESIGN_NO | String | Yes | Design reference number |
| 9 | COLOUR_CODES | String | Yes | Comma-separated colour codes |
| 10 | COLOUR_COUNT | Number | Yes | Number of distinct colours |
| 11 | PCS_PER_COLOUR | Number | Yes | Pieces ordered per colour |
| 12 | TOTAL_ORDER | Number | Yes | Total order quantity |
| 13 | TOTAL_Received | Number | Yes | Total quantity received |
| 14 | READY_DATE | Date | Yes | Expected ready date |
| 15 | Send_To_Tailor | Date | Yes | Date sent to tailor |
| 16 | Recevied_From_Tailor | Date | Yes | Date received back from tailor |
| 17 | SHIPMENT_TYPE | String | Yes | Shipment type (Air / Sea / Road) |
| 18 | SHIPMENT_NO | String | Yes | Shipment reference number |
| 19 | DISPATCH_DATE | Date | Yes | Date of dispatch |
| 20 | ARRIVAL_DATE | Date | Yes | Estimated or actual arrival date |
| 21 | STAGE | String | Yes | Current production/shipment stage |
| 22 | REMARKS | String | Yes | Free-text remarks field |
| 23 | ENTRY_ID | String | **Hidden** | System-generated unique record ID — hidden from all user responses |
| 24 | SEARCH_KEY | String | **Hidden** | Concatenated search index key — hidden from all user responses |

**Hidden columns note:** ENTRY_ID and SEARCH_KEY are always stripped from API responses before delivery to any client. They are used internally by GAS for record identification and search indexing only.

---

### LACE_GAYLE — Column Definitions

LACE_GAYLE shares the same 24-column database schema as MEN_MATERIAL. All column names, types, and hidden rules are identical.

| # | Column Name | Type | Visible | Notes |
|---|---|---|---|---|
| 1 | SR | Number | Yes | Auto-incremented serial row number |
| 2 | PROCESS_DATE | Date | Yes | Order processing date |
| 3 | PRODUCT_CATEGORY | String | Yes | Lace or Gayle product category |
| 4 | PRODUCT_NAME | String | Yes | Product name / style |
| 5 | FACTORY | String | Yes | Manufacturing factory name |
| 6 | MARKA_CODE | String | Yes | Brand/marka identifier |
| 7 | OUTLET_NAME | String | Yes | Outlet or customer name |
| 8 | DESIGN_NO | String | Yes | Design reference number |
| 9 | COLOUR_CODES | String | Yes | Comma-separated colour codes |
| 10 | COLOUR_COUNT | Number | Yes | Number of distinct colours |
| 11 | PCS_PER_COLOUR | Number | Yes | Pieces ordered per colour |
| 12 | TOTAL_ORDER | Number | Yes | Total order quantity |
| 13 | TOTAL_Received | Number | Yes | Total quantity received |
| 14 | READY_DATE | Date | Yes | Expected ready date |
| 15 | Send_To_Tailor | Date | Yes | Date sent to tailor |
| 16 | Recevied_From_Tailor | Date | Yes | Date received back from tailor |
| 17 | SHIPMENT_TYPE | String | Yes | Shipment type |
| 18 | SHIPMENT_NO | String | Yes | Shipment reference number |
| 19 | DISPATCH_DATE | Date | Yes | Date of dispatch |
| 20 | ARRIVAL_DATE | Date | Yes | Arrival date |
| 21 | STAGE | String | Yes | Current stage |
| 22 | REMARKS | String | Yes | Free-text remarks |
| 23 | ENTRY_ID | String | **Hidden** | System-generated record ID — always hidden |
| 24 | SEARCH_KEY | String | **Hidden** | Search index key — always hidden |

---

### Settings Sheet — Column Definitions (used by both databases)

| # | Column Name | Type | Notes |
|---|---|---|---|
| 1 | NAME | String | View name as shown in the system |
| 2 | URL | String | Outlet Google Sheet URL (for Lace/Gayle outlet views) |
| 3 | SHEET_NAME | String | Target sheet tab name within the spreadsheet |
| 4 | COLUMNS | String | Alphabet-style column list (e.g. A,B,D,E,H) |
| 5 | FILTER_COLUMN | String | Column header to apply filter on |
| 6 | FILTER_VALUE | String | Value to match for filter |
| 7 | ACTIVE | Boolean | Whether this view is active (TRUE/FALSE) |
| 8 | START_ROW | Number | First data row index (usually 2 to skip header) |
| 9 | NOTES | String | Optional operational notes for this view |

---

## 19. Full API Endpoint Reference

All endpoints are prefixed with `/api`. Auth column indicates minimum required role or permission.

### Authentication

| Method | Path | Auth | Key Params | Response Shape | Error Codes |
|---|---|---|---|---|---|
| POST | /login | None | body: email, password | `{ accessToken, refreshToken, user }` | 400 invalid input, 401 bad credentials, 403 account disabled |
| POST | /refresh | None | body: refreshToken | `{ accessToken }` | 401 invalid/expired refresh token |

### Data

| Method | Path | Auth | Key Params | Response Shape | Error Codes |
|---|---|---|---|---|---|
| GET | /data | data:read | query: database, view, page, pageSize, search, marka, product, dateFrom, dateTo, sort | `{ data: { records[], total, page, pageSize } }` | 400 missing params, 401 unauthorized, 403 view not assigned, 404 view not found |
| GET | /dashboard | dashboard:read | query: database, view | `{ summary, charts, counts }` | 401, 403 |
| GET | /filters | data:read | query: database, view | `{ filterOptions }` | 401, 403 |
| POST | /save-entry | data:write | query: database, view; body: field map | `{ success, mapping: { entryId } }` | 400 invalid fields, 401, 403 blocked/quota exceeded, 429 rate limited |
| GET | /export | data:export | query: database, view, format (excel/pdf/png) | File download or `{ downloadUrl }` | 401, 403 column restriction blocks export, 404 |
| GET | /my-views | data:read | — | `{ views[], databases[] }` | 401 |

### Admin — User Management

| Method | Path | Auth | Key Params | Response Shape | Error Codes |
|---|---|---|---|---|---|
| GET | /admin/users | admin:manage | — | `{ users[] }` | 401, 403 |
| POST | /admin/users | admin:manage | body: email, password, role, name | `{ user }` | 400 validation, 409 email exists |
| PUT | /admin/users/:id | admin:manage | body: partial user fields | `{ user }` | 400, 404 user not found |
| DELETE | /admin/users/:id | admin:manage | — | `{ success }` | 404 |
| POST | /admin/users/:id/reset-password | admin:manage | body: newPassword | `{ success }` | 400, 404 |
| PUT | /admin/users/:id/views | admin:manage | body: views[] | `{ user }` | 400, 404 |
| PUT | /admin/users/:id/columns | admin:manage | body: columns object | `{ user }` | 400, 404 |
| PUT | /admin/users/:id/quota | admin:manage | body: quota object | `{ user }` | 400, 404 |

### Admin — Audit and Alignment

| Method | Path | Auth | Key Params | Response Shape | Error Codes |
|---|---|---|---|---|---|
| GET | /admin/audit-log | audit:read | query: limit, offset, action, userId | `{ events[], total }` | 401, 403 |
| GET | /admin/verify-view-alignment | admin:manage | query: database, view, page, pageSize | `{ config, comparison: { mismatches[] } }` | 400, 401, 403, 404 |

### Admin — Monitoring

| Method | Path | Auth | Key Params | Response Shape | Error Codes |
|---|---|---|---|---|---|
| GET | /admin/monitoring/status | admin:manage | — | `{ databases: { name, status, lastSync, errorRate }[] }` | 401, 403 |
| GET | /admin/monitoring/logs | admin:manage | query: limit, database | `{ logs[] }` | 401, 403 |
| GET | /admin/monitoring/performance | admin:manage | query: database, window | `{ avgMs, p50Ms, p95Ms, errorRate, cacheHitRate }` | 401, 403 |
| POST | /admin/monitoring/refresh | admin:manage | body: `{}` | `{ success, results[] }` | 401, 403 |
| POST | /admin/monitoring/force-reload | admin:manage | body: `{}` | `{ success }` | 401, 403 |
| DELETE | /admin/monitoring/logs | admin:manage | — | `{ success }` | 401, 403 |
| GET | /admin/monitoring/lace-gayle/views | admin:manage | — | `{ count, views[] }` | 401, 403 |

### Notifications

| Method | Path | Auth | Key Params | Response Shape | Error Codes |
|---|---|---|---|---|---|
| GET | /notifications/vapid-public-key | None | — | `{ publicKey }` | 500 if VAPID not configured |
| POST | /notifications/subscribe | data:read | body: subscription object | `{ success }` | 400 invalid subscription |
| POST | /notifications/unsubscribe | data:read | body: `{ endpoint }` | `{ success }` | 400 |
| GET | /notifications/heartbeat | data:read | — | `{ subscribed, endpoint }` | 401 |
| POST | /admin/notifications/send | admin:manage | body: target, title, body, url | `{ sent, failed, skipped }` | 400, 401, 403 |
| GET | /admin/notifications/log | admin:manage | — | `{ log[] }` | 401, 403 |
| GET | /admin/notifications/subscribers | admin:manage | — | `{ count, subscribers[] }` | 401, 403 |

---

## 20. Admin Workflow Guides

### Workflow 1 — Create a New User

1. Log in as admin.
2. Navigate to Admin Panel → Users tab.
3. Click "Add User".
4. Enter name, email, temporary password, and select role (user/manager/admin).
5. Click Save. User is created and disabled login is off by default.

`[SCREENSHOT: Admin Panel → Users tab → Add User form with fields filled]`

6. Assign databases: click the user row → Databases tab → select MEN_MATERIAL and/or LACE_GAYLE.
7. Assign views: click Views tab → select one or more view names from the list.
8. Assign columns (optional): click Columns tab → select allowed columns per database or per view.
9. Assign quota policy: click Quota tab → set daily/monthly/total/test/live limits.
10. Click Save Changes. User can now log in with assigned access.

`[SCREENSHOT: User detail panel showing Databases, Views, Columns, Quota tabs]`

---

### Workflow 2 — Assign Lace/Gayle View Access

1. Navigate to Admin Panel → Users → select target user.
2. Open Views tab.
3. Select qualified view names that contain " - Lace" or " - Gayle" suffix.
   - Example: "Noor Import & Export Ltd - Lace"
4. Save. The LACE_GAYLE split resolves automatically from the view name qualifier.

`[SCREENSHOT: View assignment panel with Lace/Gayle views checked]`

---

### Workflow 3 — Send Push Notification

1. Navigate to Admin Panel → Notifications tab.
2. Choose targeting mode: All Users, By Role, By Database, By Email, or By View.
3. Enter Title, Body message, and optional click URL.
4. Click Send Notification.
5. System reports: sent count, failed count, skipped count.

`[SCREENSHOT: Notification send form with targeting options and send button]`

6. View delivery history in Notification Log panel below the send form.

`[SCREENSHOT: Notification log table with timestamp, target, sent, failed columns]`

---

### Workflow 4 — Read Monitoring Status

1. Navigate to Admin Panel → Monitoring tab.
2. Status cards show each database: status (OK/degraded/error), last sync timestamp, error rate.
3. Sync Logs panel shows last N events with database, action, duration, status.
4. Performance panel shows avg/p50/p95 latency and cache hit rate.

`[SCREENSHOT: Monitoring tab with status cards for MEN_MATERIAL and LACE_GAYLE]`

5. To manually trigger sync refresh: click Refresh button. No alerts are raised for manual refresh.
6. To clear cache and force full reload: click Force Reload.
7. To clear all sync logs: click Clear Logs.

---

### Workflow 5 — View LACE_GAYLE Per-View Monitor Table

1. Navigate to Admin Panel → Monitoring tab → LACE_GAYLE Per-View section.
2. Table shows each configured Lace/Gayle view with:
   - View Name
   - Sheet Type (Lace / Gayle)
   - MARKA_CODE
   - PRODUCT_CATEGORY
   - Source Sheet Name
   - Last Sync Status
   - Record Count
   - Last Error (if any)
3. Use this table to confirm which views are active and which have sync issues.

`[SCREENSHOT: LACE_GAYLE per-view monitoring table with 22+ rows]`

---

## 21. Failure Scenario Matrix

| Scenario | Symptoms | Root Cause | Troubleshooting Steps | Prevention |
|---|---|---|---|---|
| Google Apps Script unreachable | Data endpoint returns 502 or empty; sync log shows error | GAS deployment down, quota exceeded, or Apps Script error | Check GAS execution log in Google Apps Script editor. Redeploy if needed. Check Google Workspace quota. | Monitor GAS error rate dashboard. Set alert threshold. |
| Cloudflare Worker returns 403 | All data requests fail with 403 | `x-proxy-auth` secret mismatch between backend env and Worker secret | Verify PROXY_SECRET in server/.env matches wrangler secret. Redeploy worker if secret was rotated. | Rotate secrets on schedule. Keep wrangler secret in sync with backend env. |
| Cloudflare Worker returns 500 | All requests fail with 500 | Worker code error or routing logic broken | Check Cloudflare dashboard → Worker logs. Rollback to previous worker revision. | Test worker changes in staging first. |
| JWT access token expired | Frontend gets 401 on data calls | Token lifetime (15m) elapsed and refresh was not called | Frontend auto-refresh on 401 should handle this. If still failing, check refresh token validity in localStorage. Clear and re-login. | Access token auto-refresh is built in. Ensure frontend interceptor is active. |
| Refresh token expired | Login page appears after 7 days | 7-day refresh window elapsed | User must re-login. This is expected behavior. | Inform users that sessions expire after 7 days of inactivity. |
| Quota blocked | POST /save-entry returns 403 with quota reason | User has hit daily/monthly/test/live write limit | Admin: go to Users → Quota tab → raise or reset quota. Audit log shows `data.save_entry.write.blocked` events. | Review quota settings during user onboarding. Set appropriate limits per role. |
| View returns zero records | Dashboard or data table shows empty | Source sheet has no rows, filter criteria matches nothing, or view config ACTIVE=FALSE | Check Settings sheet row for the view. Verify FILTER_VALUE matches actual data. Confirm ACTIVE=TRUE. | Validate view configs after any Settings sheet update. |
| Push notification not delivered | Notification sent but user does not receive | Browser notification permission denied, subscription expired, or user is not subscribed | Admin: check subscriber count in Notifications panel. User: check browser notification settings. Re-subscribe if needed. | Show in-app reminder if subscription count drops. |
| Sync failure alert not received | Real GAS failure occurs but no push alert appears | No admin browser is currently subscribed to push notifications | Admin must subscribe at least one browser session to push notifications. Audit log still records `monitoring.sync_failure.alert.skipped`. | Ensure at least one admin browser maintains an active push subscription. |
| Monitoring not updating | Status cards show stale timestamp | API server cache TTL has not expired, or GAS calls are failing silently | Click Force Reload in monitoring panel. Check sync logs for error entries. | Set `API_CACHE_TTL_MS` to appropriate value. Review sync log errors. |
| Column restriction bypass attempt | User receives hidden column data | Column projection not applied correctly | Check backend `allowedColumns` config for user. Verify route enforces projection. Backend is the enforcement layer. | Never rely on frontend hiding alone. Backend projection must always be verified. |
| Missing view in Settings | View name requested does not resolve | Settings sheet row missing or NAME field does not match | Check GAS Settings sheet. Add/fix the row for the view name. Redeploy GAS if needed. | Validate all view names in Settings before assigning to users. |
| Bootstrap admin not removed | Security exposure: bootstrap vars still active in env | Admin forgot to remove BOOTSTRAP_ADMIN_* from server/.env | Immediately comment out or delete bootstrap vars. Restart API. | Add a startup log warning when bootstrap vars are detected. |
| Storage JSON corrupted | API crashes on startup or returns 500 for all users | users-db.json or quota-db.json is malformed | Restore from last backup. Check file for JSON syntax errors. | Schedule regular backups. Never edit storage files manually while API is running. |

---

## 22. Data Privacy and Sensitive Column Handling

### Sensitive Column Policy

Two columns in both databases are classified as system-internal and are always hidden from user-facing responses:

| Column | Classification | Handling |
|---|---|---|
| ENTRY_ID | System record identifier | Stripped from all API responses before delivery. Used internally by GAS for record targeting and audit references only. |
| SEARCH_KEY | Search index | Stripped from all API responses. GAS-generated concatenation of searchable fields. Never exposed to frontend. |

These columns are filtered at the backend projection layer, meaning even admin-role API responses do not include them in the data payload. They are accessible only through direct GAS-level or Sheets-level operations.

### Column-Level Access Control

Beyond system-hidden columns, the backend supports per-user column restrictions:

- **Database-level column policy:** Admin can assign a list of allowed columns for a specific database. Any column not in the allowed list is removed from responses.
- **View-level column policy:** Admin can assign a per-view column override that takes precedence over the database-level policy.
- **Export restriction:** When a user has column restrictions, export requests that would produce a full-column file (e.g. raw download URL) are blocked. The endpoint returns 403 rather than leaking unrestricted data through a file bypass.

### Data in Transit

- All API communication uses HTTPS in production.
- JWT tokens are short-lived (15 minutes) and refresh tokens expire after 7 days.
- The Cloudflare Worker layer ensures GAS URLs and tokens are never exposed to the browser.

### Data at Rest

- User passwords are stored as bcrypt hashes in `users-db.json`. Plaintext passwords are never stored.
- Push subscription endpoints (stored in `push-subscriptions.json`) should be treated as sensitive data. They allow message delivery to specific browsers.
- Google Sheets data is managed under the organization's Google Workspace account and governed by its data retention and access policies.

### Audit Trail

- All write operations, blocked attempts, admin actions, and security events are recorded in the in-memory audit log.
- The audit log includes: timestamp, action type, user ID, IP address, and relevant details.
- Audit entries do not include password values, raw push subscription keys, or full request bodies.

### PII Considerations

- The system does not explicitly store personal identifiable information beyond user account email and name in `users-db.json`.
- OUTLET_NAME in business data may contain individual or company names. Access to this field is governed by the standard view/column restriction system.
- If handling data subject to GDPR, PDPL, or similar regulations, the organization should conduct a data mapping review against the schema above and implement appropriate retention and deletion policies.

---

## 23. Production Deployment Checklist

Complete these steps in order when deploying to a new production environment.

### Phase 1 — Environment Preparation

- [ ] Provision a Linux server (Ubuntu 22.04 LTS recommended) or equivalent VPS
- [ ] Install Node.js 18+ and npm 9+
- [ ] Install PM2 globally: `npm install -g pm2`
- [ ] Clone the repository to the server
- [ ] Run `npm install` in the project root (installs frontend dependencies)
- [ ] Run `npm install` in `server/` (installs backend dependencies)

### Phase 2 — Environment Configuration

- [ ] Copy `server/.env.example` to `server/.env`
- [ ] Set `NODE_ENV=production`
- [ ] Set `PORT` (default 3001) to your desired API port
- [ ] Set `JWT_SECRET` to a strong random secret (minimum 32 characters)
- [ ] Set `REFRESH_TOKEN_SECRET` to a different strong random secret
- [ ] Set `PROXY_URL` to the Cloudflare Worker URL
- [ ] Set `PROXY_SECRET` to match the Worker's secret
- [ ] Generate VAPID keys: `npx web-push generate-vapid-keys`
- [ ] Set `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`
- [ ] Set `CORS_ORIGIN` to your production frontend domain (e.g. `https://programing.hetdubai.com`)
- [ ] Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` for first-run only
- [ ] Verify `server/storage/` directory exists and is writable by the Node process

### Phase 3 — Cloudflare Worker Deployment

- [ ] Install Wrangler: `npm install -g wrangler`
- [ ] Authenticate: `npx wrangler login`
- [ ] Navigate to `cloudflare-worker/`
- [ ] Set Worker secret: `npx wrangler secret put PROXY_SECRET` (enter same value as `server/.env`)
- [ ] Set GAS URL secrets for each database: `npx wrangler secret put GAS_MEN_URL`, `npx wrangler secret put GAS_LACE_URL`
- [ ] Deploy Worker: `npx wrangler deploy`
- [ ] Copy the deployed Worker URL into `server/.env` as `PROXY_URL`

### Phase 4 — Google Apps Script Deployment

- [ ] Install clasp: `npm install -g @google/clasp`
- [ ] Authenticate: `npx clasp login`
- [ ] Navigate to `gas/apps-script/men-material/` and push: `npx clasp push`
- [ ] Deploy as Web App in GAS editor. Copy the deployment URL.
- [ ] Set that URL as the GAS_MEN_URL Worker secret (or update existing)
- [ ] Repeat for `gas/apps-script/lace-gayle/`
- [ ] Verify GAS Settings sheets contain all active view configurations

### Phase 5 — Frontend Build and Deploy

- [ ] Create `.env.production` in project root
- [ ] Set `VITE_API_URL=https://your-api-domain.com/api`
- [ ] Build: `npm run build`
- [ ] Upload `dist/` contents to your static hosting (Cloudflare Pages, Nginx, or equivalent)
- [ ] Set `Cache-Control` headers appropriately for static assets (long TTL) vs `index.html` (no-cache)

### Phase 6 — API Server Start

- [ ] Start API with PM2: `pm2 start server/index.js --name het-api`
- [ ] Verify startup: `pm2 logs het-api --lines 20`
- [ ] Confirm bootstrap admin was created (check log for "bootstrap admin created" message)
- [ ] **Immediately remove** `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` from `server/.env`
- [ ] Restart API: `pm2 restart het-api`
- [ ] Save PM2 process list: `pm2 save`
- [ ] Enable PM2 on system startup: `pm2 startup`

### Phase 7 — Reverse Proxy (Nginx)

- [ ] Install Nginx
- [ ] Configure server block: proxy `/api` to `http://localhost:3001/api`
- [ ] Serve `dist/` files for all other paths
- [ ] Install SSL certificate (Let's Encrypt / Certbot recommended)
- [ ] Verify HTTPS is active and HTTP redirects to HTTPS

### Phase 8 — First-Login Verification

- [ ] Open the production URL in browser
- [ ] Log in with bootstrap admin credentials (before they were removed)
- [ ] Verify dashboard loads, admin panel accessible
- [ ] Create a non-admin test user and verify scoped access
- [ ] Enable push notifications in admin browser and confirm subscription count = 1
- [ ] Test monitoring panel: status, logs, LACE_GAYLE per-view table
- [ ] Confirm PWA install prompt appears

### Phase 9 — Backup Schedule

- [ ] Schedule daily backup for: `server/storage/users-db.json`, `quota-db.json`, `sync-log.json`, `notification-log.json`
- [ ] Confirm Google Sheets backup policy with Google Workspace admin

---

## 24. Monitoring SLA and Thresholds

### Response Time Targets

| Endpoint Type | Target (p50) | Warning Threshold (p95) | Critical Threshold |
|---|---|---|---|
| Data fetch (cached) | < 100ms | > 300ms | > 1000ms |
| Data fetch (live GAS) | < 2000ms | > 4000ms | > 8000ms |
| Dashboard analytics | < 3000ms | > 5000ms | > 10000ms |
| Login / auth | < 300ms | > 800ms | > 2000ms |
| Export (small dataset) | < 4000ms | > 8000ms | > 15000ms |
| Admin monitoring status | < 500ms | > 1500ms | > 4000ms |

### Error Rate Thresholds

| Metric | Acceptable | Warning | Critical Action |
|---|---|---|---|
| GAS error rate (rolling 15 min) | < 2% | 5% | 10% — raise alert, check GAS deployment |
| API 5xx rate | < 0.5% | 2% | 5% — check server logs, restart if needed |
| Auth failure rate | < 5% | 15% | 30% — possible brute-force, review rate limits |
| Push delivery failure rate | < 5% | 15% | 30% — check subscription freshness |

### Cache Performance

| Metric | Target | Action if Below Target |
|---|---|---|
| Cache hit rate | > 60% | Review `API_CACHE_TTL_MS`. Increase TTL if data freshness allows. |
| Cache miss rate (live GAS calls) | < 40% | Acceptable baseline. Peaks expected after Force Reload. |

### Alert and Cooldown Settings

| Setting | Value | Notes |
|---|---|---|
| Sync failure push alert cooldown | 5 minutes | Prevents alert storms during sustained GAS outage |
| Manual refresh alert suppression | Always | Manual refresh never raises alerts by design |
| Force reload alert suppression | Always | Force reload clears cache and is expected to cause miss spike |
| Minimum admin subscriptions for alert delivery | 1 | At least one admin browser must be subscribed |

### Sync Log Retention

| Setting | Value | Notes |
|---|---|---|
| Max sync log entries | Configurable (circular) | Default circular buffer in `syncLog.js`. Old entries overwritten. |
| Recommended max entries | 500 | Enough for operational review without excessive file growth |
| Log file location | `server/storage/sync-log.json` | Must be included in backup schedule |

### Recommended Auto-Sync Interval

| Environment | Recommended | Rationale |
|---|---|---|
| Production (business hours) | Every 5 minutes | Keeps cache warm. GAS quota allows ~1000 calls/day per user. |
| Production (off hours) | Every 30 minutes or disabled | Reduces GAS quota consumption overnight |
| Development | On-demand only | Avoids polluting sync logs with dev noise |

---

## 25. Version History and Change Log

| Version | Date | Author | Summary of Changes |
|---|---|---|---|
| 1.0.0 | 2025 Q1 | het Engineering | Initial enterprise build: React frontend, Express API, GAS integration, JWT auth, role-based access |
| 1.1.0 | 2025 Q2 | het Engineering | RBAC permission matrix, per-user view assignment, column restriction policy |
| 1.2.0 | 2025 Q3 | het Engineering | MEN_MATERIAL write system: save-entry with quota controls and audit logging |
| 1.3.0 | 2025 Q3 | het Engineering | LACE_GAYLE database integration with Lace/Gayle split view logic and outlet URL resolution |
| 1.4.0 | 2025 Q4 | het Engineering | Export system: Excel/PDF/PNG with column restriction enforcement and leakage prevention |
| 1.5.0 | 2026 Q1 | het Engineering | Push notification system: VAPID keys, service worker, admin send panel, notification logs |
| 1.6.0 | 2026 Q1 | het Engineering | PWA support: manifest, standalone mode, install prompt, offline service worker |
| 1.7.0 | 2026 Q2 | het Engineering | Data Control + Sync Monitoring System: gasClient instrumentation, monitorState, syncLog, performance metrics, manual refresh, force reload |
| 1.7.1 | 2026 Q2 | het Engineering | Route permission fix: admin monitoring routes switched from `admin:read` to `admin:manage` |
| 1.8.0 | 2026 Q2 | het Engineering | LACE_GAYLE per-view monitoring endpoint and admin UI table (22 views with sheetType, markaCode, productCategory, lastSyncStatus) |
| 1.8.1 | 2026 Q2 | het Engineering | Real sync-failure alert pipeline: syncAlerts.js with push notification delivery, 5-min cooldown, audit events |
| 1.8.2 | 2026 Q2 | het Engineering | Manual refresh alert suppression (`suppressAlerts` flag) — silent refresh confirmed |
| 1.9.0 | 2026 Q2 | het Engineering | Enterprise handover documentation: PROJECT_FULL_TECHNICAL_REPORT.md created (17 sections + 8 enterprise sections) |

---

## Report Ownership and Handover Scope

This report is the final handover baseline for file management, operations, and future development teams. It reflects the current enterprise implementation including frontend, backend, GAS integration, security policy, monitoring, notifications, PWA, and operational lifecycle.

Sections 18–25 were added to meet enterprise handover standards and include: full database schemas, complete API reference, admin workflow guides, failure scenario matrix, data privacy policy, production deployment checklist, monitoring SLA thresholds, and version history.
