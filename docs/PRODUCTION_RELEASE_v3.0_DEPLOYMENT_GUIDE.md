# Production Release Guide (v3.0)

Release tag: v3.0-production-ready  
Release message: v3.0: dynamic SaaS database platform production release

## 1) Release Tag Status

- [x] Annotated tag created: v3.0-production-ready
- [x] Tag pushed to origin
- [x] Tag points to commit: c2b0752

Commands used:

```bash
git tag -a v3.0-production-ready -m "v3.0: dynamic SaaS database platform production release"
git push origin v3.0-production-ready
```

## 2) Full Deployment Checklist

### Server Setup

- [ ] Install Node.js 20 LTS (recommended baseline)
- [ ] Install npm (comes with Node)
- [ ] Clone repository and checkout tag v3.0-production-ready
- [ ] Copy environment template and create production env files
- [ ] Confirm API port and reverse proxy mapping

Environment files:

- [ ] Configure .env.production for frontend build values
- [ ] Configure server/.env (or process manager env) for backend runtime values

Minimum backend runtime variables:

- [ ] NODE_ENV=production
- [ ] API_PORT=3001 (or target production API port)
- [ ] CORS_ORIGINS=https://your-domain.com
- [ ] JWT_ACCESS_SECRET (strong random)
- [ ] JWT_REFRESH_SECRET (strong random)
- [ ] JWT_ACCESS_TTL=15m
- [ ] JWT_REFRESH_TTL=7d
- [ ] GAS_PROXY_URL
- [ ] GAS_PROXY_AUTH_TOKEN
- [ ] GAS_BRIDGE_URL_MEN_MATERIAL
- [ ] GAS_BRIDGE_URL_LACE_GAYLE
- [ ] GAS_SECRET_KEY_MEN_MATERIAL
- [ ] GAS_SECRET_KEY_LACE_GAYLE
- [ ] API_CACHE_TTL_MS
- [ ] WEB_PUSH_PUBLIC_KEY
- [ ] WEB_PUSH_PRIVATE_KEY
- [ ] WEB_PUSH_SUBJECT

Frontend production variables:

- [ ] VITE_API_URL=https://api.your-domain.com
- [ ] VITE_APP_TITLE
- [ ] VITE_ENABLE_DEBUG=false

### Backend

- [ ] Install dependencies: npm ci
- [ ] Start command verified: npm run start:prod
- [ ] PM2 setup completed (recommended)
- [ ] PM2 auto-start on reboot configured
- [ ] Health check endpoint/API checks scripted
- [ ] Log rotation enabled

PM2 example:

```bash
pm2 start npm --name het-api -- run start:prod
pm2 save
pm2 startup
```

Logging setup:

- [ ] Application logs persisted (stdout/stderr)
- [ ] PM2 logs retained with limits
- [ ] Access/error logs available via reverse proxy

### Frontend

- [ ] Install dependencies: npm ci
- [ ] Production build: npm run build
- [ ] Dist output verified
- [ ] Deploy static assets to Nginx/Vercel/Netlify
- [ ] SPA fallback routing configured

### Domain + SSL

- [ ] Domain DNS points to frontend host
- [ ] API subdomain (or /api reverse proxy) points to backend
- [ ] HTTPS certificate installed (Let's Encrypt or Cloudflare)
- [ ] HTTP to HTTPS redirect enabled
- [ ] SSL renewal automation enabled

### Cloudflare Worker

- [ ] Wrangler authenticated
- [ ] Worker secrets configured
- [ ] Worker deployed
- [ ] Origin allowlist and auth token validated
- [ ] Worker route to /gas verified

Worker commands:

```bash
npm run worker:deploy
wrangler secret put PROXY_AUTH_TOKEN
wrangler secret put GAS_LACE_URL
wrangler secret put GAS_MEN_URL
wrangler secret put GAS_LACE_TOKEN
wrangler secret put GAS_MEN_TOKEN
```

### Google Apps Script

- [ ] MEN deployment URL verified (exec URL)
- [ ] LACE deployment URL verified (exec URL)
- [ ] GAS token permissions checked
- [ ] Script deployment versions recorded
- [ ] Required scopes/permissions granted

### Security

- [ ] Remove bootstrap admin credentials from production env after first secure admin setup
- [ ] Rotate JWT, GAS, and worker auth secrets before go-live
- [ ] Verify CORS only allows approved production origins
- [ ] Confirm no debug mode in production frontend
- [ ] Confirm rate limiting active
- [ ] Confirm admin routes require admin:manage permission

### Backup

- [ ] Backup server/storage/database-registry.json before deployment
- [ ] Archive/reset server/storage/sync-log.json baseline (optional but recommended)
- [ ] Backup source Google Sheets (MEN + LACE)
- [ ] Store backup timestamp and restore instructions

### Monitoring

- [ ] PM2 process monitoring enabled
- [ ] API error-rate alerting enabled
- [ ] Worker error monitoring enabled
- [ ] Sync failure alerts enabled
- [ ] Notification channel tested (email/push/ops)

## 3) Deployment Modes

### Local Development

- Frontend: npm run dev
- Backend: npm run dev:api
- Worker local test: npm run worker:dev
- Typical URLs:
- Frontend: http://localhost:5173
- API: http://localhost:3001

### Staging

- Use isolated staging domain and API
- Use staging-specific secrets and GAS tokens
- Deploy from release tag candidate
- Run full verification suite before production promotion

### Production

- Checkout and deploy tag: v3.0-production-ready
- Frontend built with production env
- Backend run via PM2/systemd
- Worker deployed with production secrets
- Monitoring and alerting enabled before opening traffic

## 4) Post-Deployment Final Verification

Run this full smoke suite after deployment:

- [ ] Login flow (admin + non-admin)
- [ ] Dashboard load and data fetch
- [ ] Admin panel load
- [ ] Create dynamic database from admin API/UI
- [ ] Create view definition (selected columns + filters)
- [ ] Filter and query data from created view
- [ ] Export path validation
- [ ] Monitoring page checks
- [ ] Notification send test
- [ ] Audit log entries confirmed
- [ ] Security checks: unauthorized access blocked, CORS enforced

Recommended API checks:

- [ ] GET /api/admin/databases => 200
- [ ] GET /api/admin/view-definitions => 200
- [ ] POST /api/admin/databases => 201
- [ ] POST /api/admin/view-definitions => 201

## 5) Rollback Plan

- [ ] Keep previous stable deployment artifact
- [ ] Keep previous env snapshot
- [ ] Revert DNS/traffic if critical errors occur
- [ ] Restore storage backup if registry corruption detected
- [ ] Re-run smoke tests after rollback

## 6) Operational Notes

- Current system baseline is verified stable and clean.
- Runtime JSON files can change during normal operation.
- Treat database-registry.json and sync-log.json as operational state files.

## 7) Final Enterprise QA Execution Record (2026-04-27)

Validated in controlled local runtime before production handoff:

- Build and packaging:
	- `npm install` passed
	- `npm run build` passed
	- `npm run build:prod` passed
- Backend functional checks:
	- `/api/health` returned 200
	- admin database/view endpoints returned 200
	- admin user lifecycle endpoints validated (create/update/reset/disable/enable/delete)
- Access control checks:
	- unauthenticated protected calls return 401
	- authenticated non-admin calls to admin routes return 403
- Dynamic builder checks:
	- dynamic database create (201) and delete (200)
	- dynamic view-definition create (201) and delete (200)
- Export checks:
	- PDF/EXCEL/PNG returned 200
	- CSV/JSON returned 400 (treat as unsupported until implemented)
- Live data alignment checks:
	- MEN_MATERIAL sampled mismatchCount=0
	- LACE_GAYLE sampled mismatchCount=0

Open risk notes:

- Full authenticated visual QA across all target breakpoints should be completed in a dedicated UI pass.
- Local machine `server/.env` may contain live-like values and must remain untracked and rotation-managed.

## 8) Release Candidate Handoff Note (Approved)

Release position:

enterprise incident management and analytics platform ready for deployment

### 8.1 Mandatory Deployment Checklist

Environment:

- [ ] `.env` production variables configured
- [ ] Telegram, Email, and Push channels verified
- [ ] API base URLs updated to production domain

Backend:

- [ ] `npm install`
- [ ] `npm run build`
- [ ] Server started via PM2/systemd/node service
- [ ] Health endpoint check passed: `/api/admin/monitoring/health` returns 200

Frontend:

- [ ] Production build deployed
- [ ] Static hosting or CDN configured
- [ ] Routing verified for `/admin/incidents`

Database and storage:

- [ ] `alerts.json` baseline verified clean
- [ ] Storage file permissions verified
- [ ] Backup snapshot created before go-live

### 8.2 Critical Rollback Checklist

Code rollback:

- [ ] Previous stable tag available (example: v3.x)
- [ ] `git checkout <previous-tag>` tested and ready

Config rollback:

- [ ] Previous `.env` backup stored securely
- [ ] API endpoint mapping revert-ready

Data safety rollback:

- [ ] Backup verified for `alerts.json`
- [ ] Backup verified for `users-db.json`
- [ ] Backup verified for registry/state files

Trigger conditions for rollback:

- [ ] API errors above threshold
- [ ] Alert pipeline not triggering or not delivering
- [ ] UI crash, severe rendering failure, or blank screen

### 8.3 First 24 Hours Post-Release Monitoring

System health:

- [ ] API uptime stable with no sustained 5xx
- [ ] Response time remains within SLO

Alert pipeline:

- [ ] Test alert delivered across configured channels
- [ ] No duplicate alert storm detected
- [ ] Escalation logic working as expected

Incident flow:

- [ ] Incident creation verified
- [ ] Incident grouping verified
- [ ] Bulk actions verified
- [ ] Re-open flow verified

Analytics dashboard:

- [ ] KPI cards updating
- [ ] Trend section visible and updating
- [ ] No empty/blank regressions in normal data conditions

Critical watchpoints:

- [ ] Alert volume spike behavior
- [ ] External provider delays (Telegram/Email)
- [ ] Memory profile under larger datasets
- [ ] Retry queue growth trend

### 8.4 Final Go-Live Confirmation

After deployment and first validation pass, record:

production deployment completed and system live

### 8.5 Platform Capability Snapshot

- Server-side filtering: complete
- Bulk lifecycle actions: complete
- Re-open incident flow: complete
- Incident analytics dashboard: complete
- SLO and escalation intelligence: complete
- Multi-channel alerting: complete
- Audit-verified monitoring: complete

Operational loop now supported end-to-end:

Filter -> Select -> Act -> Re-open -> Analyze
