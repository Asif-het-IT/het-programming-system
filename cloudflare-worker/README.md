# Cloudflare Worker GAS Proxy

This worker hides GAS tokens from clients and proxies middleware requests to the correct Apps Script project.

## Routes

- `GET /gas?database=...&api=records...`
- `POST /gas?database=...&api=save-entry...`

## Required secrets

Run these in the `cloudflare-worker` folder:

```bash
wrangler secret put PROXY_AUTH_TOKEN
wrangler secret put GAS_LACE_URL
wrangler secret put GAS_MEN_URL
wrangler secret put GAS_LACE_TOKEN
wrangler secret put GAS_MEN_TOKEN
```

## Local test

```bash
wrangler dev
```

## Deploy

```bash
wrangler deploy
```

## Backend integration

Set these in `server/.env`:

```env
GAS_PROXY_URL=https://<your-worker-domain>/gas
GAS_PROXY_AUTH_TOKEN=<same-as-PROXY_AUTH_TOKEN>
```

When `GAS_PROXY_URL` is present, middleware routes through Cloudflare Worker automatically.
