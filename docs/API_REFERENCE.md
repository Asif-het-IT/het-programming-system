# API Reference

All API endpoints are prefixed with `/api`. The base URL is `https://programing.hetdubai.com/api` in production or `http://localhost:3001/api` in development.

---

## Authentication

### POST /api/login

Authenticate a user and receive access and refresh tokens.

**Request body:**

```json
{
  "email": "dua@het.local",
  "password": "dua123"
}
```

**Response 200:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "dua",
    "email": "dua@het.local",
    "role": "user",
    "databases": ["LACE_GAYLE"],
    "views": ["Dua Trading & ... - Lace", "Dua Trading & ... - Gayle"]
  }
}
```

**Response 401:** Invalid credentials.
**Rate limit:** 10 requests / 15 minutes per IP.

---

### POST /api/refresh

Exchange a valid refresh token for a new access token.

**Request body:**

```json
{ "refreshToken": "<refresh_token>" }
```

**Response 200:**

```json
{ "accessToken": "eyJ..." }
```

**Response 401:** Token invalid, expired, or revoked.

---

### POST /api/logout

Revoke the current refresh token from the in-memory store.

**Authorization:** Bearer `<access_token>` required.

**Response 204:** No content.

---

## Data

All data endpoints require `Authorization: Bearer <access_token>`.

---

### GET /api/data

Fetch paginated, view-projected records.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `database` | `MEN_MATERIAL` \| `LACE_GAYLE` | Yes | Target database |
| `view` | string | Yes | View name as configured in Settings sheet |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Rows per page (default: 100, max: 500) |
| `search` | string | No | Full-text search across displayed columns |
| `marka` | string | No | Filter by MARKA_CODE value |

**Response 200:**

```json
{
  "records": [
    { "ORDER_NO": "LD-001", "PARTY": "ABC Co.", "QTY": "500" }
  ],
  "total": 153,
  "page": 1,
  "limit": 100,
  "viewMeta": {
    "columns": ["ORDER_NO", "PARTY", "QTY"],
    "filters": { "MARKA_CODE": "LLL", "PRODUCT_CATEGORY": "Lace" }
  }
}
```

**Response 403:** User does not have access to the requested `view`.

---

### GET /api/filters

Get available filter values for the authenticated user's current database and view.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `database` | string | Yes | Target database |
| `view` | string | Yes | View name |

**Response 200:**

```json
{
  "markas": ["LLL", "BBB", "AAA"],
  "stages": ["CUTTING", "STITCHING", "COMPLETED"],
  "categories": ["Lace", "Gayle"]
}
```

---

### GET /api/dashboard

Get aggregated chart data for the current view.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `database` | string | Yes | Target database |
| `view` | string | Yes | View name |

**Response 200:**

```json
{
  "totalOrders": 153,
  "byStage": { "CUTTING": 40, "STITCHING": 60, "COMPLETED": 53 },
  "byMarka": { "LLL": 153 },
  "byCategory": { "Lace": 153 }
}
```

---

### GET /api/export

Export current view data as CSV.

**Query parameters:** Same as `/api/data` (without `page` / `limit`).

**Response 200:** `Content-Type: text/csv`, file attachment.

---

### POST /api/save-entry

Submit a new data row. Only users with `data:write` permission (role: admin or manager) can call this endpoint. Each user has a per-day write quota enforced by `quotaStore.js`.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `database` | string | Yes | Target database |
| `view` | string | Yes | View name |

**Request body:**

```json
{
  "ORDER_NO": "LD-154",
  "PARTY": "ABC Co.",
  "QTY": 200,
  "MARKA_CODE": "LLL"
}
```

**Response 200:**

```json
{ "ok": true, "message": "Entry saved successfully." }
```

**Response 403:** No `data:write` permission, or quota exceeded.
**Response 400:** Schema validation failure.

---

## Admin

All admin endpoints require `admin:manage` permission (role: admin).

---

### GET /api/admin/users

List all users in the in-memory user store.

**Response 200:**

```json
[
  { "id": "dua", "email": "dua@het.local", "role": "user", "active": true, "databases": ["LACE_GAYLE"], "views": ["Dua..."] }
]
```

---

### POST /api/admin/user

Create a new user.

**Request body:**

```json
{
  "email": "new@het.local",
  "password": "securepass123",
  "role": "user",
  "databases": ["LACE_GAYLE"],
  "views": ["Dua Trading & ... - Lace"]
}
```

**Response 201:** User created.
**Response 409:** Email already in use.

---

### PUT /api/admin/assign-view

Update the databases and views assigned to a user.

**Request body:**

```json
{
  "email": "dua@het.local",
  "databases": ["LACE_GAYLE"],
  "views": ["Dua Trading & ... - Lace", "Dua Trading & ... - Gayle"]
}
```

---

### DELETE /api/admin/user/:email

Permanently delete a user by email.

---

### POST /api/admin/reset-password

Reset a user's password (admin-initiated, no old password required).

**Request body:**

```json
{ "email": "dua@het.local", "newPassword": "newpassword123" }
```

---

### PUT /api/admin/user-status

Activate or deactivate a user account.

**Request body:**

```json
{ "email": "dua@het.local", "active": false }
```

---

### GET /api/admin/audit-log

Retrieve the audit event log.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `from` | ISO date | No | Start date filter |
| `to` | ISO date | No | End date filter |
| `user` | string | No | Filter by user email |
| `event` | string | No | Filter by event type |

---

### GET /api/admin/audit-report/daily

Retrieve pre-aggregated daily audit summaries.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `date` | ISO date | No | Specific date (default: today) |

---

### GET /api/admin/verify-view-alignment

Compare the web API output against the GAS target sheet output for a given view to confirm 1:1 parity.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `database` | string | Yes | `MEN_MATERIAL` or `LACE_GAYLE` |
| `view` | string | Yes | View name from Settings sheet |

**Response 200:**

```json
{
  "database": "LACE_GAYLE",
  "view": "Dua Trading & Co - Lace",
  "match": true,
  "counts": { "web": 153, "target": 153 },
  "mismatches": [],
  "summary": "MATCH — 153/153 rows identical"
}
```

**Response 200 (mismatch):**

```json
{
  "match": false,
  "counts": { "web": 0, "target": 91 },
  "mismatches": [
    { "row": 1, "column": "ORDER_NO", "web": null, "target": "LD-001" }
  ],
  "summary": "MISMATCH — 20 differences found"
}
```

---

### GET /api/health

Health check. Returns GAS configuration status.

**Response 200:**

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
