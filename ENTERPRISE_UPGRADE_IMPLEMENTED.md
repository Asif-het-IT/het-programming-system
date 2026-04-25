# Enterprise SaaS Upgrade - Implemented

## What Was Added

### 1. Secure Middleware API (Express)
- Path: server/src
- JWT auth with access and refresh tokens
- Role-based authorization (admin/user)
- View/database scope enforcement
- Zod request validation
- Rate limiting
- Helmet + CORS + compression + logging
- In-memory response cache for repeated GAS calls

### 2. API Endpoints Implemented
- POST /api/login
- POST /api/refresh
- GET /api/data?database=&view=
- GET /api/filters
- GET /api/export
- GET /api/admin/users
- POST /api/admin/user
- PUT /api/admin/assign-view
- GET /api/health

### 3. Frontend Enterprise Integration
- Axios client with JWT interceptor and refresh retry flow
- Zustand auth store
- API-only auth flow (no direct sheet login)
- Email + password login UI
- Dashboard server-side query parameters:
  - search, marka, product, dsn, fromDate, toDate
  - page, pageSize, sortBy, sortOrder

### 4. Performance Upgrades
- Route-level lazy loading
- Virtualized data table rows via @tanstack/react-virtual
- API pagination defaults to pageSize=100
- Server cache layer added for bridge responses

### 5. PWA Support
- public/manifest.json
- public/sw.js
- public/offline.html
- Install button component added
- Service worker registration in app bootstrap
- iOS and Android install metadata in index.html

## Security Notes
- Existing GAS logic remains untouched.
- Middleware forwards to GAS bridge securely using:
  - x-gas-secret
  - x-app-referrer
- User with no assigned view is blocked at API level.

## Run Instructions

### Frontend
npm run dev

### API middleware
npm run dev:api

### Production build
npm run build

## Required Environment Variables
See:
- .env.example
- server/.env.example

Key variables:
- VITE_API_URL
- GAS_BRIDGE_URL
- GAS_SECRET_KEY
- GAS_ALLOWED_REFERRER
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET

## Important Integration Requirement
Set GAS_BRIDGE_URL to your deployed GAS web app endpoint before using live data routes.
Without this, login works but /api/data returns an expected configuration error.
