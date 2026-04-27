# Operations Checklist

Scope: Production operations hardening and daily runbook.
Purpose: Keep system secure, recoverable, and monitorable without changing application business logic.

## Final Enterprise QA Sign-off (2026-04-27)

- [x] Build/install pipeline validated (`npm install`, `npm run build`, `npm run build:prod`).
- [x] Backend runtime and protected API routes validated on localhost.
- [x] Admin lifecycle API coverage validated (create/update/reset/disable/enable/delete).
- [x] Authorization behavior validated (401 unauthenticated, 403 non-admin on admin routes).
- [x] Dynamic database and view-definition create/delete cycle validated.
- [x] MEN_MATERIAL and LACE_GAYLE sampled alignment checks returned `mismatchCount=0`.
- [ ] Full authenticated UI responsive pass on all target devices pending dedicated visual QA session.
- [ ] CSV and JSON export formats pending implementation or explicit de-scope (currently returning 400).

## 1. Admin Security

- [ ] Change bootstrap admin password immediately after first login.
- [ ] Create one secondary backup admin account (different credentials, different owner).
- [ ] Verify both admin accounts can login before disabling bootstrap path.
- [ ] Remove bootstrap credentials after initial setup:
  - [ ] Remove `BOOTSTRAP_ADMIN_EMAIL` from `server/.env` (or leave empty).
  - [ ] Remove `BOOTSTRAP_ADMIN_PASSWORD` from `server/.env` (or leave empty).
- [ ] Restart API and confirm normal admin login still works from persisted users database.
- [ ] Store admin credentials only in approved password manager (never in chat or docs).

## 2. User Access Verification (Operational Test)

Create one test user and validate least-privilege behavior:

- [ ] User assigned exactly one database.
- [ ] User assigned exactly one view.
- [ ] User allowed only 2-3 columns.
- [ ] User cannot access any other database/view via direct URL or API query.
- [ ] Export endpoint returns only allowed data policy:
  - [ ] Restricted export rows do not include hidden columns.
  - [ ] If export uses unrestricted `downloadUrl`, request is blocked for restricted users.

Suggested test matrix:

1. Login as admin, create test user with:
   - one database
   - one view
   - column restrictions
2. Login as test user and verify:
   - dashboard table shows only allowed columns
   - manual API call with different database/view returns 403
   - export request respects same restrictions
3. Remove or disable test user after validation.

## 3. Backup Plan

### Google Sheets

- [ ] Weekly full spreadsheet copy for MEN_MATERIAL and LACE_GAYLE.
- [ ] Monthly immutable archive export (XLSX/CSV) to secure storage.
- [ ] Keep at least 30-day retention with version naming.

### Server Storage JSON

Back up these files from `server/storage/`:

- `users-db.json`
- `quota-db.json`
- `daily-audit-reports.json`

Operational policy:

- [ ] Daily snapshot backup.
- [ ] Keep last 14 daily + 8 weekly copies.
- [ ] Encrypt backups at rest.

### Repository Backup

- [ ] Push to remote origin after approved changes.
- [ ] Weekly mirror/clone backup to secondary remote or private archive.
- [ ] Tag release points before major config changes.

### Environment Backup

- [ ] Store encrypted backup of required environment values in secrets manager.
- [ ] Never backup raw `.env` unencrypted.
- [ ] Rotate and re-backup secrets after any credential change.

## 4. Monitoring Plan

### API Health

- [ ] Poll `GET /api/health` every 1-5 minutes.
- [ ] Alert if 2 consecutive failures.

### Worker Health

- [ ] Monitor Worker endpoint status and latency.
- [ ] Alert on 4xx/5xx spikes and auth mismatch responses.

### GAS/API Failures

- [ ] Track failed bridge calls and response parsing errors.
- [ ] Alert on repeated `view-config`, `view-output`, `records`, `save-entry` failures.

### Slow Views

- [ ] Track p95 response time for `/api/data` and `/api/dashboard`.
- [ ] Warn at >2s sustained; critical at >5s sustained.

### Login/Access Errors

- [ ] Monitor 401/403 rates for `/api/login`, `/api/refresh`, protected routes.
- [ ] Investigate unusual failed-login bursts and permission-denied spikes.

## 5. Security Confirmation Checklist

- [x] `.env` files are git-ignored; only `.env.example` templates are tracked.
- [ ] Confirm no secrets in pull requests before merge.
- [x] Runtime credentials are read from environment variables (no hardcoded secrets in app logic).
- [x] Worker/GAS auth uses secret-managed headers and env config.
- [x] Audit logging path remains enabled (`writeAuditEvent` + daily report pipeline).

## 6. Daily Checks

- [ ] API health endpoint responding.
- [ ] Admin login works.
- [ ] One sample user login works.
- [ ] One sample view fetch works.
- [ ] Error logs reviewed (401/403/5xx anomalies).
- [ ] Disk usage and backup job status checked.

## 7. Weekly Tasks

- [ ] Execute backup jobs and validate restore sample.
- [ ] Review user list for stale/unused accounts.
- [ ] Review admin actions and audit events.
- [ ] Rotate temporary/test accounts.
- [ ] Validate Worker and GAS routing with a smoke query.

## 8. User Onboarding Standard

1. Create user with minimum required role.
2. Assign minimum database access.
3. Assign only required view(s).
4. Apply column restrictions when needed.
5. Set permission toggles (read/write/export/dashboard/viewOnly).
6. Apply quota limits.
7. Test login with user and verify restrictions.

## 9. Emergency Rollback

If production issue occurs:

1. Freeze admin config changes.
2. Restore last known-good `server/storage` snapshot.
3. Restore previous stable deploy tag/commit.
4. Verify `/api/health`, login, and one data view.
5. Re-enable access in stages (admin first, then users).
6. Record incident summary and remediation actions.

## 10. Security Reminders

- Never share tokens, secrets, or admin passwords in chat/email.
- Use strong unique credentials and MFA where available.
- Remove bootstrap admin env values after first-time setup.
- Prefer least privilege for every user and role.
- Re-validate access controls after any schema or route change.
