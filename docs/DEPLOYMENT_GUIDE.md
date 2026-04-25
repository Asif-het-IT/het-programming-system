# Deployment Guide

---

## Prerequisites

- Node.js v18+
- npm v9+
- A Cloudflare account (for the Worker proxy)
- CLASP installed globally for GAS deployments: `npm install -g @google/clasp`
- cPanel VPS with Node.js support at `https://programing.hetdubai.com`

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment files

```bash
# Frontend (Vite reads this automatically)
cp .env.example .env.development

# Backend
cp .env.example server/.env
```

### 3. Configure `server/.env`

```env
API_PORT=3001
CORS_ORIGINS=http://localhost:5173

JWT_ACCESS_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_REFRESH_SECRET=<generate another random 32-byte hex>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

GAS_PROXY_URL=https://het-gas-proxy.hetgraphic17.workers.dev/gas
GAS_PROXY_AUTH_TOKEN=<your proxy auth token>

# Direct GAS fallback (used if Worker is unavailable)
GAS_BRIDGE_URL_MEN_MATERIAL=https://script.google.com/macros/s/<MEN_ID>/exec
GAS_BRIDGE_URL_LACE_GAYLE=https://script.google.com/macros/s/<LACE_ID>/exec

API_CACHE_TTL_MS=30000
```

### 4. Configure `.env.development` (Vite)

```env
VITE_API_URL=http://localhost:3001
VITE_APP_DOMAIN=http://localhost:5173
```

### 5. Start development servers

Open two terminals:

```bash
# Terminal 1 — Frontend (port 5173)
npm run dev

# Terminal 2 — Backend API (port 3001)
npm run dev:api
```

Access the app at `http://localhost:5173`.

---

## Production Build

```bash
npm run build
```

Output is written to `dist/`. This directory contains the static SPA that Apache/Nginx/cPanel will serve.

---

## Production Deployment — cPanel VPS

Target URL: `https://programing.hetdubai.com`

The deployment serves the React SPA as static files and runs the Node.js API as a persistent process.

### Step 1 — Upload files

Upload the following to the server (via cPanel File Manager or SFTP):

```
dist/                  → public_html/ (or the subdomain's document root)
server/                → /home/<user>/apps/programming-database/server/
server/.env            → /home/<user>/apps/programming-database/server/.env
package.json           → /home/<user>/apps/programming-database/
```

> **Important:** Do NOT upload `node_modules/` or `.env` (root) to the server.

### Step 2 — Install production dependencies on server

SSH into the server:

```bash
cd /home/<user>/apps/programming-database
npm install --omit=dev
```

### Step 3 — Configure `server/.env` on server

```env
NODE_ENV=production
API_PORT=3001
CORS_ORIGINS=https://programing.hetdubai.com

JWT_ACCESS_SECRET=<32-byte random hex — DIFFERENT from dev>
JWT_REFRESH_SECRET=<32-byte random hex — DIFFERENT from dev>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

GAS_PROXY_URL=https://het-gas-proxy.hetgraphic17.workers.dev/gas
GAS_PROXY_AUTH_TOKEN=<proxy auth token>
GAS_BRIDGE_URL_MEN_MATERIAL=https://script.google.com/macros/s/<MEN_ID>/exec
GAS_BRIDGE_URL_LACE_GAYLE=https://script.google.com/macros/s/<LACE_ID>/exec

API_CACHE_TTL_MS=30000
```

### Step 4 — Start the API with PM2

```bash
# Install PM2 globally if not present
npm install -g pm2

# Start the API
pm2 start server/index.js --name "programming-database-api" --interpreter node

# Save PM2 state to survive reboots
pm2 save
pm2 startup
```

Check status:

```bash
pm2 status
pm2 logs programming-database-api
```

### Step 5 — Configure Apache reverse proxy (cPanel)

In cPanel → Apache Configuration or `.htaccess`, add a reverse proxy rule so `/api/*` requests are forwarded to the Node.js API:

**`.htaccess` in the subdomain document root:**

```apache
RewriteEngine On

# Proxy API requests to Node.js
RewriteRule ^api/(.*)$ http://127.0.0.1:3001/api/$1 [P,L]

# SPA fallback — serve index.html for all non-file routes
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

Enable `mod_proxy` and `mod_proxy_http` in cPanel → Apache Modules if not already active.

### Step 6 — Verify deployment

```bash
# Health check
curl https://programing.hetdubai.com/api/health

# Expected:
# {"status":"ok","gas":{"workerProxyConfigured":true,"bridgeConfigured":true,...}}
```

---

## Cloudflare Worker Deployment

The Worker proxy is deployed once and updated via Wrangler CLI.

### Initial deploy

```bash
cd cloudflare-worker
npm install
wrangler login
wrangler deploy
```

### Set secrets (run once per secret)

```bash
wrangler secret put PROXY_AUTH_TOKEN     # Your proxy auth token
wrangler secret put GAS_MEN_URL         # Full MEN GAS exec URL
wrangler secret put GAS_LACE_URL        # Full LACE GAS exec URL
wrangler secret put GAS_MEN_TOKEN       # MEN GAS auth token
wrangler secret put GAS_LACE_TOKEN      # LACE GAS auth token
```

### Update Worker allowed origin

Edit `cloudflare-worker/wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGIN = "https://programing.hetdubai.com"
```

Then redeploy: `wrangler deploy`

---

## GAS Deployments (CLASP)

### Authenticate

```bash
clasp login --no-localhost
```

### Deploy MEN MATERIAL

```bash
cd gas/apps-script/men-material
clasp push
clasp deploy --description "v<N> - <description>"
```

### Deploy LACE & GAYLE

```bash
cd gas/apps-script/lace-gayle
clasp push
clasp deploy --description "v<N> - <description>"
```

After each deployment, update the GAS execution URL in `server/.env` (the new deployment gets a new URL) or update the Cloudflare Worker secret with the new URL.

### Test after deployment

```bash
# From backend server
curl "http://localhost:3001/api/admin/verify-view-alignment?database=MEN_MATERIAL&view=Dua+View"
curl "http://localhost:3001/api/admin/verify-view-alignment?database=LACE_GAYLE&view=Dua+Trading+%26+Co+-+Lace"
```

Expected: `"match": true` for all configured views.

---

## Environment Variable Reference

| Variable | Location | Description |
|---|---|---|
| `VITE_API_URL` | `.env.*` (Vite) | Backend API base URL visible to frontend |
| `API_PORT` | `server/.env` | Port the Express server listens on |
| `CORS_ORIGINS` | `server/.env` | Comma-separated allowed CORS origins |
| `JWT_ACCESS_SECRET` | `server/.env` | HMAC secret for access tokens |
| `JWT_REFRESH_SECRET` | `server/.env` | HMAC secret for refresh tokens |
| `JWT_ACCESS_TTL` | `server/.env` | Access token lifetime (default: 15m) |
| `JWT_REFRESH_TTL` | `server/.env` | Refresh token lifetime (default: 7d) |
| `GAS_PROXY_URL` | `server/.env` | Cloudflare Worker proxy URL |
| `GAS_PROXY_AUTH_TOKEN` | `server/.env` | Shared secret sent to Worker |
| `GAS_BRIDGE_URL_MEN_MATERIAL` | `server/.env` | Direct MEN GAS exec URL (fallback) |
| `GAS_BRIDGE_URL_LACE_GAYLE` | `server/.env` | Direct LACE GAS exec URL (fallback) |
| `API_CACHE_TTL_MS` | `server/.env` | GAS response cache lifetime in ms |
