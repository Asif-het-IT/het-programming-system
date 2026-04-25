# Troubleshooting Guide

---

## GAS / API Issues

### GAS returns non-JSON response

**Symptom:** `SyntaxError: Unexpected token '<'` in server logs, or `500` on any data endpoint.

**Cause:** Google Apps Script sometimes returns an HTML error page (redirect, quota exceeded, or script error) instead of JSON.

**Fix:**
1. Open the GAS Apps Script editor → View → Executions → check for recent errors.
2. Check if the GAS deployment is `"Anyone"` access (not just logged-in users).
3. Re-deploy the GAS script (`clasp deploy`) and update the URL in `server/.env` and Cloudflare Worker secrets.
4. Confirm `API/Health` returns `"bridgeConfigured": true` after update.

---

### GAS returns `{ "ok": false }` or `{ "success": false }`

**Symptom:** Backend throws `Error: GAS returned unsuccessful payload for api=records`.

**Cause:** The GAS script handled the request but encountered a business logic error (e.g. missing token, unknown action, misconfigured sheet name).

**Fix:**
1. Test the GAS URL directly in the browser (append `?api=records&token=...&marka=XXX`).
2. Check `error` or `message` field in the GAS response for details.
3. Ensure `GAS_PROXY_AUTH_TOKEN` in `server/.env` matches the Worker's `PROXY_AUTH_TOKEN` secret.

---

### `/api/health` shows `"bridgeConfigured": false`

**Symptom:** `{"gas":{"bridgeConfigured":false}}`.

**Cause:** `GAS_BRIDGE_URL_MEN_MATERIAL` or `GAS_BRIDGE_URL_LACE_GAYLE` is not set in `server/.env`.

**Fix:** Check `server/.env` and restart the server after updating it.

---

### Cloudflare Worker returns 401

**Symptom:** API returns `401` with body `Unauthorized`.

**Cause:** `GAS_PROXY_AUTH_TOKEN` in `server/.env` does not match the `PROXY_AUTH_TOKEN` Cloudflare secret.

**Fix:**
```bash
cd cloudflare-worker
wrangler secret put PROXY_AUTH_TOKEN
# Enter the exact value from server/.env GAS_PROXY_AUTH_TOKEN
```

---

## Authentication Issues

### Login returns 401 "Invalid credentials"

1. Confirm the email is in `server/src/data/users.js`.
2. In development, check the plaintext password in the users file matches what you're typing.
3. In production, if passwords were changed via the admin panel, the hashed value in the in-memory store is correct — try the new password.

---

### "Token expired" after 15 minutes

This is expected. The frontend automatically silently refreshes using the refresh token. If refresh fails:

1. Check the refresh token in `localStorage` is not empty.
2. Check the server has not restarted (restart clears the in-memory refresh token store, invalidating all sessions).
3. If the server restarted, users must re-login. This is by design for the in-memory token store.

---

### JWT secret error on startup

**Symptom:** `Error: secretOrPrivateKey must have a value`.

**Cause:** `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` is not set or is empty in `server/.env`.

**Fix:** Generate values and add to `server/.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## View / Data Issues

### View returns 0 records but target sheet has data

**Symptom:** `GET /api/data` returns an empty array. `/verify-view-alignment` shows `counts: { web: 0, target: N }`.

**Investigation steps:**

1. **Confirm the Settings sheet row exists for this view:**
   ```
   GET /api/admin/verify-view-alignment?database=LACE_GAYLE&view=<exact view name>
   ```
   Check the `viewConfig` field in the response to see what filters were resolved.

2. **Check filter values match actual data:**
   The Settings row may specify `MARKA_CODE=BBB` but the database sheet may use a different code or casing. Fetch raw records directly:
   ```
   GET /api/data?database=LACE_GAYLE&view=<view>&page=1&limit=10&marka=BBB
   ```
   If still 0, the marka filter is not matching any rows.

3. **Check for qualifier mismatch:**
   If the view name ends in `- Lace` or `- Gayle`, confirm the Settings sheet has a matching row with that exact suffix. The qualifier resolver strips the suffix for base matching but uses it to disambiguate duplicates.

4. **Verify GAS filter is applied:**
   Test the GAS URL directly:
   ```
   https://script.google.com/macros/s/<LACE_ID>/exec?action=records&token=Lace%20%26%20Gayle&marka=BBB&category=Lace
   ```
   If this also returns 0, the issue is in the source data or GAS filter logic.

---

### View returns wrong columns

**Symptom:** Columns appear in the web view that should not be there, or expected columns are missing.

**Cause:** The Settings sheet `columnsList` does not match what was expected.

**Fix:**
1. Open the Settings sheet in Google Sheets.
2. Verify the comma-separated column letters in the relevant Settings row.
3. Count the columns in the database sheet to confirm the letters match the correct headers.
4. Wait 30 seconds for the Settings cache to expire, or restart the server to force a fresh fetch.

---

### View alignment mismatch after GAS update

After deploying a new GAS version:

1. The new deployment gets a new execution URL.
2. Update `server/.env` with the new URL.
3. Update the corresponding Cloudflare Worker secret.
4. Restart the backend API.
5. Run the alignment verifier for all affected views.

---

### "view not assigned" error

**Symptom:** `403 Forbidden: view not assigned to user`.

**Cause:** The user's `views` array in `server/src/data/users.js` does not include the requested view name.

**Fix (admin):** Call `PUT /api/admin/assign-view` with the exact view name from the Settings sheet:

```json
{
  "email": "noor@het.local",
  "databases": ["LACE_GAYLE"],
  "views": ["Noor Fabrics - Lace", "Noor Fabrics - Gayle"]
}
```

---

## Build Issues

### `npm run build` fails with import error

**Symptom:** `Cannot find module '...'`

**Fix:**
```bash
rm -rf node_modules
npm install
npm run build
```

---

### `vite preview` shows API errors

The preview server serves only the frontend build. It does not start the backend API. Run `npm run dev:api` in a separate terminal to serve the API.

---

## Server / PM2 Issues

### API is not reachable after server restart

PM2 process may not have been saved:

```bash
pm2 list              # Check if process is running
pm2 restart programming-database-api
pm2 save              # Save to survive reboots
```

### Audit log grows too large

`server/storage/daily-audit-reports.json` accumulates entries. Archive or truncate old entries periodically:

```bash
# Backup then truncate
cp server/storage/daily-audit-reports.json server/storage/daily-audit-reports-backup-$(date +%Y%m%d).json
echo "{}" > server/storage/daily-audit-reports.json
```

---

## CORS Issues

### Frontend gets CORS error in production

**Cause:** `CORS_ORIGINS` in `server/.env` does not include `https://programing.hetdubai.com`.

**Fix:**
```env
CORS_ORIGINS=https://programing.hetdubai.com
```

Restart the API after updating. Do not add trailing slashes.
