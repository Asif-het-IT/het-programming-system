# Programming Database — Enterprise SaaS Platform

A production-ready enterprise data platform connecting React 18 to Google Sheets databases through a secure, role-based Node.js API, Cloudflare Worker proxy, and Google Apps Script bridge layer.

**Live deployment target:** `https://programing.hetdubai.com`

![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933)
![React](https://img.shields.io/badge/React-18-61dafb)
![Vite](https://img.shields.io/badge/Vite-6-646cff)
![License](https://img.shields.io/badge/License-Internal-blue)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp server/.env.example server/.env
# Optional first-run bootstrap only:
# set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in server/.env
# then remove them after the admin account is created.

# 3. Start development — two terminals required
npm run dev        # Frontend  → http://localhost:5173
npm run dev:api    # Backend   → http://localhost:3001

# 4. Build for production
npm run build
```

---

## User Bootstrap

The repository ships with no built-in users.

On a fresh environment, create the first admin by setting these temporary values in `server/.env` before the first API startup:

```env
BOOTSTRAP_ADMIN_EMAIL=your-admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=choose-a-strong-password
```

After the first admin account is created and persisted, remove both variables from `server/.env`. All later user creation and access assignment happens through the admin panel.

---

## Architecture (Summary)

```
Browser (React SPA)
  → Node.js Express API (JWT + RBAC)
    → Cloudflare Worker (hides GAS URLs, validates proxy token)
      → Google Apps Script (MEN MATERIAL / LACE & GAYLE)
        → Google Sheets (single source of truth)
```

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Documentation

| Document | Purpose |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full system architecture and request lifecycle |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | All API endpoints with request/response examples |
| [docs/VIEW_SYSTEM.md](docs/VIEW_SYSTEM.md) | Settings sheet, view filtering, alphabet column selection |
| [docs/SECURITY.md](docs/SECURITY.md) | JWT, RBAC, proxy security, write safety |
| [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | Local dev, cPanel/VPS, Cloudflare Worker, GAS deployment |
| [docs/SAAS_PRODUCTIZATION_GUIDE.md](docs/SAAS_PRODUCTIZATION_GUIDE.md) | Final SaaS deployment mode, cache strategy, hardening checklist, and benchmark snapshot |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and step-by-step fixes |
| [docs/VALIDATION_REPORT.md](docs/VALIDATION_REPORT.md) | View alignment test matrix and acceptance criteria |
| [PROJECT_FULL_TECHNICAL_REPORT.md](PROJECT_FULL_TECHNICAL_REPORT.md) | A-to-Z enterprise handover report for frontend, backend, GAS, security, monitoring, notifications, and operations |

---

## Final Enterprise QA Snapshot

Validation timestamp: 2026-04-27 (pre-production handoff pass)

- Build pipeline passed: `npm install`, `npm run build`, `npm run build:prod`.
- Backend runtime verified on `http://localhost:3001` with health and protected route checks.
- Admin lifecycle APIs validated (create/update/reset-password/disable/enable/delete).
- Authorization matrix verified:
  - Unauthenticated requests return 401 on protected endpoints.
  - Authenticated non-admin requests to admin routes return 403.
- Dynamic builder APIs verified with live create/delete cycles for database and view definitions.
- Google Sheets alignment probes executed for MEN_MATERIAL and LACE_GAYLE with `mismatchCount=0` in sampled calls.
- Export endpoint status:
  - Supported and validated: PDF, EXCEL, PNG.
  - CSV and JSON returned 400 in current implementation and should be treated as non-production formats unless implemented later.
- Login page branding verified:
  - Built by: Sattari Labs
  - Developer: Asif Ali

Notes:
- Runtime operational JSON files under `server/storage/` can change during normal testing and operations.
- Local development `server/.env` may contain machine-specific secrets and must remain untracked.

---

## Project Structure

```
programming-database/
├── src/                        # React 18 frontend
│   ├── components/             # Reusable UI components (Radix UI + Tailwind)
│   ├── pages/                  # Login, UserDashboard, AdminPanel
│   ├── lib/                    # API client, Zustand store, React Query hooks
│   └── hooks/                  # Custom hooks
├── server/                     # Node.js + Express 5 API
│   ├── index.js                # Entry point
│   └── src/
│       ├── config/             # Role permissions, environment
│       ├── data/               # Users, audit log, quota store
│       ├── middleware/         # requireAuth, validate (Zod), rate limit
│       ├── routes/             # auth.js, data.js, admin.js, health.js
│       ├── services/           # gasClient, viewConfigService, viewProjectionService
│       └── utils/              # JWT helpers, security utilities
├── cloudflare-worker/          # Cloudflare Worker proxy
│   ├── src/index.js
│   └── wrangler.toml
├── gas/
│   └── apps-script/
│       ├── men-material/       # MEN MATERIAL GAS bridge (Code.js)
│       └── lace-gayle/         # LACE & GAYLE GAS bridge (Code.js)
├── docs/                       # Full documentation suite
├── dist/                       # Production build output (git-ignored)
├── .env.example                # Environment template
└── package.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, Tailwind CSS 3, Radix UI |
| State | Zustand, TanStack Query |
| Virtualization | TanStack Virtual |
| Charts | Recharts |
| Backend | Node.js 18+, Express 5, ESM |
| Validation | Zod v4 |
| Auth | jsonwebtoken, bcryptjs |
| Security | helmet, cors, express-rate-limit, compression |
| Proxy | Cloudflare Worker |
| Business Logic | Google Apps Script (CLASP-managed) |
| Database | Google Sheets |
| Deploy | cPanel VPS + Cloudflare |

---

## Join the Team — Open Collaboration

We are scaling this platform and looking for skilled professionals to join the **het AI Agent project**.

If you have experience in any of the roles below, feel free to reach out:

| Role | Focus |
|---|---|
| 🎨 **UI/UX Designer** | Modern, user-friendly interfaces and design systems |
| 💻 **Frontend Developer** | Responsive UI, smooth UX, React / Tailwind |
| ⚙️ **Backend Developer** | APIs, server logic, system integration |
| 🗄️ **Database Engineer** | Efficient data management and query optimization |
| 🔐 **Security Expert** | Data protection, secure architecture, OWASP compliance |
| 🚀 **DevOps Engineer** | Deployment pipelines, server management, scalability |

We are building enterprise-grade SaaS tools and welcome professionals who care about quality, performance, and clean architecture.
