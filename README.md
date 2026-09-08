# SafeGuard — backend

Backend API for the **SafeGuard** frontend (Expo SDK 54 / Expo Router prototype).
Built to match that frontend's exact data shapes (`context/AppContext.tsx`,
`data/reports.json`, `data/alerts.json`) so swapping its in-memory mock state
for real API calls is a drop-in change.

## Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication, bcrypt password hashing
- Multer for image uploads (local disk storage)
- Two roles: `resident` and `admin`

## Setup
```bash
pnpm install
pnpm start        # or: pnpm dev (auto-restart on change)
```
Server runs on `http://localhost:4000` by default.

A `.env` is already included with a generated `JWT_SECRET` and `ADMIN_SIGNUP_CODE`.
You only need to fill in `MONGODB_URI` with your real connection string (Atlas
or local — see below).

### Connecting to MongoDB
- **Atlas**: [cloud.mongodb.com](https://cloud.mongodb.com) → get your connection string → paste into `.env` as `MONGODB_URI`, replacing `<username>`, `<password>`, `<your-cluster>`.
- **Local**: install MongoDB Community Server, run `mongod`, use `mongodb://127.0.0.1:27017/safeguard`.
- **Docker**: `docker run -d -p 27017:27017 --name mongo mongo:7`

### Seed data
```bash
pnpm seed
```
Inserts the *exact same* 6 reports and 6 alerts as the frontend's
`data/reports.json` / `data/alerts.json`, plus two demo accounts:

| Role | Email | Password |
|---|---|---|
| Resident | `john.doe@example.com` | `password123` |
| Admin | `officer.johnson@example.com` | `password123` |

> This backend was built and logic/schema-verified in a sandboxed environment
> without outbound access to MongoDB's servers, so it hasn't been run against
> a live database yet. JWT signing, password hashing, and all Mongoose schema
> validation were unit-tested directly, and the app boots cleanly through to
> the connection attempt. Run `pnpm seed` then `pnpm start` with your real
> `MONGODB_URI` for the first live test — flag anything unexpected and I'll
> fix it fast.

## How this maps to the frontend

### `AppContext`'s `Report` type → `POST/GET /api/reports`
The frontend's `Report` type is matched field-for-field:

| Frontend field | Backend field | Notes |
|---|---|---|
| `id` | `id` | Server-generated, e.g. `ER-2026-007` (not client-generated like the mock's `ER-2024-${length+1}`) |
| `category` | `category` | Same 6 values: `Robbery`, `Fire Outbreak`, `Medical Emergency`, `Accident`, `Suspicious Activity`, `Domestic Threat` |
| `title` | `title` | |
| `description` | `description` | |
| `status` | `status` | Same 3 values: `Active`, `Responding`, `Resolved` |
| `reporter` | `reporter` | Snapshotted from the logged-in user's name at submit time (or `"Anonymous"` if `anonymous: true` is sent) |
| `location` | `location` | Free text, exactly as the frontend's form collects it |
| `timeAgo` | *(not stored)* | Backend returns `createdAt` (ISO timestamp) instead — format it client-side the same way `timeAgo` strings were hand-written in the seed data. This is the one field the frontend will need a small tweak for. |
| `severity` | `severity` | Same 4 values |
| `images` | `images` | Array of URLs — see uploads below |

### `AppContext`'s `AlertItem` type → `GET /api/alerts`
Matched field-for-field: `type` (`Emergency`/`Update`/`Announcement`), `title`,
`message`, `unread`. `timeAgo` has the same caveat as above — use `createdAt`.

### Login / Register screens → `/api/auth/*`
The frontend's login screen has a Resident/Admin toggle with no real
validation. Real auth doesn't work that way — role must come from the
account, not a client-side toggle — so:
- `POST /api/auth/register` takes `name`, `email`, `phone`, `estate`,
  `password` (matches the register form's fields exactly, `confirm` is
  frontend-only and never sent).
- `POST /api/auth/login` takes `email`, `password`, returns the account's
  real `role` — the frontend should navigate based on the response's
  `user.role`, not its own toggle, once wired up.
- To create an admin account via the API, pass `adminCode` matching
  `ADMIN_SIGNUP_CODE` in `.env` — the current frontend doesn't send this, so
  for now use the seeded demo admin account or register one directly.

### Report submission's image picker → `POST /api/uploads/images`
`report.tsx` currently attaches local device URIs directly to the in-memory
report. For real upload: send picked images as `multipart/form-data` (field
name `images`, up to 5) to `POST /api/uploads/images` first, get back
`{ urls: string[] }`, then include those URLs in the `POST /api/reports`
body's `images` array.

### Admin `manage.tsx` → `PATCH /api/reports/:id/status`
Admin-only, matches the "Mark as ..." button exactly — send `{ status }`
with one of `Active` / `Responding` / `Resolved`.

### Dashboard stats (`StatCard`s on Home/Dashboard)
These are computed client-side from the reports list in the current
frontend (`reports.filter(r => r.status === "Active").length`, etc.) — no
separate analytics endpoint is needed. `GET /api/reports` returns everything
needed to compute the same counts.

## Full API Reference

### Auth
| Method | Route | Access | Body |
|---|---|---|---|
| POST | `/api/auth/register` | public | `name, email, password, phone?, estate?, adminCode?` |
| POST | `/api/auth/login` | public | `email, password` |

### Users
| Method | Route | Access | Body |
|---|---|---|---|
| GET | `/api/users/me` | authenticated | — |
| PATCH | `/api/users/me` | authenticated | `name?, phone?, estate?` |

### Reports
| Method | Route | Access | Notes |
|---|---|---|---|
| POST | `/api/reports` | authenticated | `category, title, description, location, severity?, images?, anonymous?` |
| GET | `/api/reports` | authenticated | Query: `category?, status?, sort?` (`latest` default or `severity`) |
| GET | `/api/reports/mine` | authenticated | Current user's own reports |
| GET | `/api/reports/:id` | authenticated | `:id` is the public code, e.g. `ER-2026-001` |
| PATCH | `/api/reports/:id/status` | admin only | `{ status }` |

### Alerts
| Method | Route | Access | Notes |
|---|---|---|---|
| GET | `/api/alerts` | authenticated | Full feed, latest first |
| POST | `/api/alerts` | admin only | `type, title, message, relatedReportId?` — not yet wired in the frontend UI, but ready for an announcements screen |
| PATCH | `/api/alerts/:id/read` | authenticated | Marks read (see note in `models/Alert.js` about this being a global flag for now, not per-user) |

### Uploads
| Method | Route | Access | Notes |
|---|---|---|---|
| POST | `/api/uploads/images` | authenticated | `multipart/form-data`, field `images`, up to 5 files, 8MB each. Returns `{ urls: string[] }`. Stored on local disk under `/uploads` for now — swap for S3/Cloudinary at scale, response shape stays the same. |

## Data model (Mongoose collections)
- **User** — name, email (unique, login credential), phone, estate, passwordHash, role
- **Report** — id (public code), category, title, description, status, severity, location, reporter (name snapshot), reporterId (ref), images[], statusHistory[] (audit trail, not yet rendered by the frontend but ready for a detail screen)
- **Alert** — type, title, message, unread, relatedReportId, createdBy
- **Counter** — internal, used to generate sequential `ER-YYYY-NNN` report IDs without race conditions

## Next steps if you want it fully wired
- Swap `AppContext`'s in-memory state for real `fetch`/axios calls to this API (this is the frontend README's own "next steps" list — the API is now ready for it)
- Format `createdAt` into the `timeAgo` strings the UI already expects
- Persist the JWT with `expo-secure-store` or `AsyncStorage` so login survives app restarts
- Wire the image picker through `POST /api/uploads/images` before submitting a report
- Consider per-user alert read-receipts if this becomes multi-resident in production (see note in `models/Alert.js`)
