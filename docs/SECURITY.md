# Security Model

---

## Authentication

### JWT Tokens

The API uses a two-token authentication system:

| Token | Lifetime | Storage | Purpose |
|---|---|---|---|
| Access Token | 15 minutes | Memory (Zustand) | Authorise API calls |
| Refresh Token | 7 days | `localStorage` | Obtain new access tokens without re-login |

Access tokens are **never** stored in `localStorage` or cookies. They live only in the React application's in-memory state (Zustand store) and are cleared on page unload. This limits XSS exposure.

Refresh tokens stored in `localStorage` are valid for 7 days. On page load, the frontend silently calls `/api/refresh` to obtain a new access token if a valid refresh token is present.

The backend maintains an **in-memory refresh token store**. On logout, the refresh token is removed from the store immediately, making it invalid regardless of its remaining lifetime.

---

## Role-Based Access Control (RBAC)

### Roles and Permissions

| Role | Permissions |
|---|---|
| `admin` | `data:read`, `data:write`, `admin:manage`, `audit:read`, `report:read` |
| `manager` | `data:read`, `data:write`, `audit:read`, `report:read` |
| `user` | `data:read` |

### View-Level Access Control

Beyond role permissions, every data request is checked against the user's assigned views. Even a valid JWT cannot access a view that is not listed in the user's `views` array. This is enforced in `routes/data.js` before any GAS call is made.

---

## GAS Proxy Security

### Cloudflare Worker

The real Google Apps Script deployment URLs are never exposed to the browser. The Cloudflare Worker:

- Validates the `x-proxy-auth` header against a secret token (`PROXY_AUTH_TOKEN`)
- Only forwards requests with a valid auth token
- Stores real GAS URLs as Cloudflare secrets (not in code, not in environment files)
- Returns 401 for any request with a missing or invalid auth header

This means even if a browser network request is inspected, the GAS URL is never visible.

### GAS Tokens

Each GAS deployment uses an independent authentication token passed as a `?token=` query parameter. Tokens are stored only in Cloudflare Worker secrets and are never returned in API responses.

---

## Input Validation

All request bodies and query parameters are validated using **Zod v4 schemas** before reaching any handler or service. This prevents:

- Type injection
- Unexpected field injection
- Missing required parameters causing silent failures

Zod validation runs before authentication on public endpoints and after authentication on protected endpoints. Validation errors return a structured `400` response with field-level error messages.

---

## Write Safety

### Controlled Write Path

`POST /api/save-entry` goes through multiple safety layers:

1. **JWT + permission** — `data:write` required (admin or manager role only)
2. **View authorisation** — user must have the target view assigned
3. **Schema validation** — Zod validates the payload structure
4. **Write resolver** — maps the payload to correct sheet columns before sending to GAS
5. **Quota enforcement** — per-user daily write quota checked before GAS call
6. **Audit log** — every write (success or blocked) is recorded with user, timestamp, view, and outcome

### Quota Store

The quota is persisted to `server/storage/quota-db.json` on every update. This survives server restarts. Quota resets daily at midnight (server local time).

---

## HTTP Security Headers

Applied via `helmet` middleware on every response:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS) — enabled in production
- `Referrer-Policy: no-referrer`
- `Content-Security-Policy` — configured for SPA

---

## CORS

CORS origins are set via the `CORS_ORIGINS` environment variable (comma-separated list). In production this must be exactly `https://programing.hetdubai.com`.

Allowing `*` is never permitted in production. The default dev value is `http://localhost:5173`.

---

## Rate Limiting

| Route | Limit | Window |
|---|---|---|
| `/api/login` | 10 requests | 15 minutes |
| `/api/refresh` | 30 requests | 15 minutes |
| `/api/*` (general) | 200 requests | 1 minute |

---

## Sensitive Data Storage

| Data | Storage | Notes |
|---|---|---|
| User passwords | bcryptjs hash (rounds: 12) | Never stored in plaintext |
| JWT secret | `server/.env` → never committed | Must be a 256-bit random value |
| GAS URLs | Cloudflare Worker secrets | Never in code or `.env` |
| GAS proxy token | `server/.env` → never committed | Forwarded to Worker in header |
| Refresh tokens | In-memory store | Cleared on server restart |
| Audit log | `server/storage/*.json` | Git-ignored |

---

## Secrets Management

**Never commit:**
- `server/.env`
- `server/storage/*.json`
- `cloudflare-worker/wrangler.toml` (contains secret names)

**Rotate these if exposed:**
- `JWT_SECRET` — invalidates all active sessions (users must re-login)
- `GAS_PROXY_AUTH_TOKEN` — update Cloudflare Worker secret simultaneously
- GAS deployment tokens — update Cloudflare Worker secrets

**Verification:** Run `git log --all --full-history -- server/.env` to confirm the env file was never committed.
