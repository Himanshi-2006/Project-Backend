# Urban Road & Traffic Monitoring: Node.js Backend

Express + PostgreSQL/PostGIS API for the React GIS dashboard. **The backend does not detect anything itself.**
A separate AI module (e.g. YOLO + OpenCV, not built yet) will send detections over HTTP.

## Architecture / request flow
`route` (URL + validation) -> `controller` (HTTP in/out) -> `service` (business rules, fusion, transactions) -> `repository` (SQL) -> PostgreSQL/PostGIS.
Errors from every layer reach one `errorHandler`, which returns `{ "error": { code, message, details } }` and never leaks stack traces or credentials.

## Prerequisites
Node.js 20 LTS (18.18+), Docker Desktop. Check: `node -v; npm -v; docker -v`.
(No Docker? Install PostgreSQL 16 with the PostGIS bundle from Stack Builder, create DBs `urban_db` and `urban_test`, then use their URLs in `.env`. Don't mix both approaches.)

## Setup (PowerShell, backend terminal, inside the `backend` folder)
```powershell
cd node-backend              # folder containing package.json
npm install                  # installs dependencies
Copy-Item .env.example .env  # then edit values if you wish
docker compose up -d         # PostgreSQL+PostGIS on 127.0.0.1:5432; creates urban_db and urban_test
npm run migrate              # applies src/db/migrations/*.sql (enables PostGIS, creates tables)
npm run dev                  # API on http://localhost:5000  (npm start for no auto-reload)
```
Check: open http://localhost:5000/api/health -> `{"status":"ok","database":"up"}`.

Submit a sample detection (the same JSON an AI module would send):
```powershell
$b = @{event_type="pothole";latitude=30.7333;longitude=76.7794;timestamp="2026-10-14T10:00:00Z";bus_id="BUS_101";confidence=0.92} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/incidents -ContentType "application/json" -Body $b
```
Send it again with `bus_id` BUS_102 and latitude 30.73335: the response has `"created": false` and the same incident ID.
In Postman use POST `http://localhost:5000/api/incidents` with a raw JSON body.

## Frontend (frontend terminal, inside the dashboard folder)
Create `.env` with `VITE_API_BASE_URL=http://localhost:5000` and `VITE_USE_MOCK=false`, then `npm install; npm run dev` (http://localhost:5173).
`FRONTEND_ORIGIN` in the backend `.env` must equal the dashboard origin (CORS). For deployment change both values.
Frontend files changed: `services/api.js` (PATCH status call), `components/Filters.jsx` + `data/mockIncidents.js` (status names now open/investigating/resolved/false_positive),
`components/IncidentDetail.jsx`, `App.jsx`, `pages/Incidents.jsx` (status dropdown, shown only in backend mode). The UI is otherwise unchanged.
The dashboard calculates its cards/charts from the fetched incident list so they always match the active filters;
the `/api/analytics/*` endpoints are available (and tested) but the dashboard does not call them yet.
A failed request shows an error screen; mock data is never used silently.

## Environment variables
`PORT`, `DATABASE_URL`, `TEST_DATABASE_URL`, `FRONTEND_ORIGIN` (comma-separated allowed), `MATCH_DISTANCE_M` (default 30), `POSTGRES_PASSWORD` (docker). Validated at startup with Zod. `.env` is git-ignored.

## Database schema (src/db/migrations/001_init.sql)
- `buses(id PK, name, is_active, created_at)`: auto-registered the first time a bus reports.
- `incidents(id, event_type, latitude, longitude, location geography, first_observed_at, last_observed_at, confidence, status, observation_count, created_at, updated_at)`: status in open / investigating / resolved / false_positive; GIST index on location.
- `observations(id, incident_id FK, bus_id FK, event_type, lat, lon, location, detected_at, confidence, metadata jsonb)`: every detection is kept.
Migrations are tracked in `schema_migrations`; add new numbered `.sql` files for future changes.

## API
| Endpoint | Purpose |
|---|---|
| GET /api/health | API + DB status (503 if DB down) |
| POST /api/incidents | body: event_type, latitude, longitude, timestamp (timezone required), bus_id, confidence 0-1; optional vehicle_count, metadata. 201 created / 200 merged. Returns `{incident_id, observation_id, created, incident}` |
| GET /api/incidents | filters: event_type, status, bus_id, from, to, bbox=minLng,minLat,maxLng,maxLat; limit (default 500, max 1000), offset. Returns `{incidents,total,limit,offset}` |
| GET /api/incidents/nearby | latitude, longitude, radius_m (max 5000), event_type, limit |
| GET /api/incidents/:id | incident + `observations[]` |
| PATCH /api/incidents/:id | `{"status": ...}` only |
| GET /api/analytics/summary | total/open/investigating/resolved/false_positive, by_type |
| GET /api/analytics/traffic | incidents_by_day, congestion_by_day (vehicle_count only if the AI sent it) |
| GET /api/analytics/hotspots | ~500 m grid cells with >= min_incidents (default 3) |
| GET /api/buses, /api/buses/:id | bus info, observation count, last observation time, recent observations |

Incident JSON: `id` ("INC000001"), event_type, latitude, longitude, `timestamp` (first observed), last_observed_at, confidence, status, observation_count, bus_id (first reporting bus), vehicle_count (latest, if any), created_at, updated_at.

## Fusion rules (src/config/fusionRules.js, src/services/incident.service.js)
A detection merges into an incident only if: same type, incident is open/investigating (resolved ones are never reopened), within the distance rule (30 m; congestion 100 m) and the time window
(30 days for potholes/road damage/signs/lights; **30 minutes for accidents**; 15 minutes for congestion). Closest match wins; otherwise a new incident is created. Confidence = running mean of all observation confidences.
Concurrency: one transaction per detection + `pg_advisory_xact_lock` per event type + `SELECT ... FOR UPDATE`.
Limitations: GPS error (5-15 m, more in cities) can split one problem or merge two neighbours; no lane, direction or image matching; repeat reports from the same bus count as extra observations; same-type writes are serialised.

## Tests
```powershell
npm test      # uses TEST_DATABASE_URL (urban_test); refuses any DB not named *_test; truncates only that DB
```
Covers: health, DB-down 503 (no secrets leaked), create, invalid lat/lon/confidence/timestamps/JSON, UTC normalisation, retrieval, filters, bbox, pagination, status update, nearby, multi-bus merge with observation history, simultaneous reports -> one incident, separate incidents (distance/type/time window), resolved not reopened, analytics, buses.

## Common errors
- `ECONNREFUSED` / 503: run `docker compose up -d`, check `DATABASE_URL` port.
- `extension "postgis" is not available`: you are not using the PostGIS image / installer bundle.
- CORS error in the browser: `FRONTEND_ORIGIN` must exactly match the dashboard URL.
- `password authentication failed`: `.env` password differs from the one the DB volume was created with (`docker compose down -v` resets local data).
- Port 5000 busy: change `PORT` and `VITE_API_BASE_URL`.

## Connecting the future AI module
The Python YOLO/OpenCV pipeline POSTs each detection (JSON above) to `/api/incidents` using `requests.post(...)`; it must send the GPS fix and a timezone-aware timestamp. The backend does the fusion; the AI side never touches the database.

## Limitations / before real deployment
No authentication or authorization (anyone who can reach the API can post or PATCH). Needed: API key or JWT for the AI module, user login/roles for the dashboard, HTTPS, rate limiting, a managed database not exposed publicly, backups.
Future: Alembic-style tooling is not needed (SQL migrations exist); add WebSocket/live updates, image evidence storage, smarter matching, clustering on the map.
