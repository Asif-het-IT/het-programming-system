# SaaS Productization Guide

This guide is the final deployment and operations checklist for running the system as a production SaaS platform.

## 1) Production Build

Frontend:

```bash
npm run build:prod
npm run preview:prod
```

Backend API:

```bash
npm run start:prod
```

## 2) Production Environment

Frontend values are in `.env.production`.

Backend template is in `server/.env.production.example`.

Minimum required settings before go-live:
- `NODE_ENV=production`
- `CORS_ORIGINS=https://app.your-domain.com`
- JWT secrets and TTL values
- GAS bridge/proxy credentials
- Push VAPID keys

## 3) Deployment Topology

Recommended topology:
- `app.your-domain.com` -> React build (`dist/`)
- `api.your-domain.com` -> Express API (`server/index.js`)
- Cloudflare Worker between API and GAS for token shielding
- GAS deployments for MEN_MATERIAL and LACE_GAYLE

Flow:

Browser -> Express API -> Cloudflare Worker -> GAS -> Google Sheets

## 4) Domain + HTTPS

1. Point DNS to frontend host and API host.
2. Enable TLS certificates for both subdomains.
3. Force HTTPS redirects.
4. Set secure CORS origin list (no wildcard in production).

Nginx API reverse-proxy snippet:

```nginx
server {
  listen 443 ssl;
  server_name api.your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 5) Admin Productization Features

Enabled in this phase:
- Critical admin APIs for database CRUD:
  - `GET /api/admin/databases`
  - `POST /api/admin/databases`
  - `PUT /api/admin/databases/:id`
  - `DELETE /api/admin/databases/:id`
- ID-based dynamic database management persisted in registry storage
- Dynamic view builder enhancements for grouped column selection
- Rule-based filter builder with stable rule IDs
- Admin error retry + debug detail toggle

## 6) Cache and Refresh Behavior

Cache behavior now includes:
- Per database + view cache key scoping
- TTL clamped between 30 and 120 seconds
- Scoped invalidation on monitoring refresh by database/view
- Full invalidation on force reload and write operations

## 7) Final Hardening Checklist

- Remove bootstrap admin credentials after first run.
- Keep `NODE_ENV=production`.
- Keep API behind HTTPS only.
- Use worker proxy credentials and rotate secrets.
- Keep rate limiting enabled in Express.
- Validate token refresh flow from browser against `/api/refresh`.
- Keep monitoring and audit endpoints admin-protected.

## 8) Performance Snapshot

From final enterprise validation run:
- 57+ column dynamic dataset handling: PASS (detected columns: 59 including system columns)
- 429 retry recovery: PASS (`retry429Recovered=true`)
- Parallel read stability: PASS (6 concurrent calls all `200`)
- First large fetch latency: ~72 ms in local validation
- Subsequent paged fetch latency: ~11-15 ms in local validation
- Export path on 1200-row scoped dataset: PASS

Note: figures above are from local validation and should be re-baselined in production infrastructure.
