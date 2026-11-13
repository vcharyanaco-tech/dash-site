# Session export - 2026-11-13

## 1. Aadhaar dashboard 429 outage fix — keep-alive runs 24/7, never retries 429

Root cause confirmed: Render's free tier refused to wake the hibernated
instance (429 + `x-render-routing: hibernate-rate-limited`) from 06:00 IST
Nov 12 to ~13:20 IST Nov 13. The night skip (21:00-06:00 IST) put the
service on the wake path every morning, and the 4x retry on 429 amplified
the block.

`aadhar-dashboard/keepalive-worker/`, deployed to the dedicated Cloudflare
account `606780bc6c3ecd48289472c73d27a982` (NOT reachable from this
machine's `CLOUDFLARE_API_TOKEN` — must be deployed manually; see Pending).

- Removed the 21:00-06:00 IST night skip. Instance stays warm 24/7:
  ~720h (30-day) / ~744h (31-day) of the 750h monthly free allowance in its
  own Render workspace. A warm instance never takes the hibernation wake path.
- A 429 is never retried. It is recorded and the cron backs off 30 min, then
  60 min, skipping ticks until `throttledUntil`. Only 5xx and transport
  errors are retried briefly (cold start / deploy).
- `ticksToday` resets at midnight IST (tracked via `ticksDate`) instead of
  growing without bound. `/ping` updates `lastSuccessAt` like the cron.
- New last-failure fields (`lastFailureAt`/`lastFailureStatus`/`lastFailureError`)
  and `throttledUntil`/`throttleCount`/`lastThrottledAt`/`lastThrottleRouting`.
- `/status` reports `throttled: true` while backed off, so `healthy` is false
  during the backoff. `ticksToday` resets at midnight IST.
- `wrangler.toml` cron comment updated to document 24/7 operation.

Verified locally with a harness (fake KV + mocked fetch): 10/10 pass
(success tick, 429 no-retry + 30m backoff, throttled-tick skip, second 429
60m backoff, success clears throttle, daily tick reset, 5xx retry recovers,
manual /ping, /status healthy, /status throttled).

Cannot deploy: keep-alive lives in Cloudflare account `606780bc...`; the
available `CLOUDFLARE_API_TOKEN` only accesses `a01eb877733d755cb57e25827a9c52fe`.
No Render API access (`RENDER_API_KEY` unset, `.render.local` missing).

## 2. dash-site Worker — edge-cache immutable Streamlit assets; convert hibernate 429 to 503

`dashv1-proxy` deployed to Cloudflare account `a01eb877733d755cb57e25827a9c52fe`
(route `dashboardharyana.site/*`), version `d2cf569c-7e5e-4aef-9432-a9cad7372aa6`.

- Static assets under `/aadhar-dashboard/static/*` (GET only) are now cached
  at the edge via the zone Cache API (cross-zone fetch to Render, which is
  itself Cloudflare-fronted, so `cf.cacheEverything` is ignored). Keyed by
  path + normalized Accept-Encoding; TTL 1y. Origin already sends
  `Cache-Control: public, immutable, max-age=31536000`. Verified live:
  `CF-Cache-Status: HIT` on repeat asset requests (Age accumulates), ~0.63 MB
  compressed per fresh session saved.
- HTML (`/aadhar-dashboard/`) and `_stcore` API stay `CF-Cache-Status: DYNAMIC`
  (never cached). WebSocket upgrades bypass cache.
- Render hibernate 429 (`x-render-routing: hibernate-rate-limited`) is
  converted to `503` + `Retry-After: 60` instead of passing the 429 through
  (which invites clients to hammer the block). Cloudflare-challenge 429s
  (no `x-render-routing` header) pass through unchanged.
- Removed the duplicate Aadhaar health ping from the `scheduled` handler: the
  Aadhaar service runs 24/7 under its own `aadhar-keepalive` Worker; this cron
  still sleeps 21:00-06:00 IST for the Node backend.

## 3. Commits

| Repo | SHA | Subject |
|---|---|---|
| dash-site | `9149af6` | fix: edge-cache immutable Aadhar assets; convert hibernate 429 to 503 |
| aadhar-dashboard | `a3d75ad` | fix: keep-alive runs 24/7, never retries 429, throttle backoff |

Both pushed to `origin/main`.

## Pending tasks (carry forward)

1. **Deploy `aadhar-keepalive` manually** in Cloudflare account
   `606780bc6c3ecd48289472c73d27a982`:

   ```
   cd D:\VS tools\aadhar-dashboard\keepalive-worker
   # Authenticate into the dedicated account (token must have access there):
   npx wrangler login   # interactive, or set CLOUDFLARE_API_TOKEN for that account
   npx wrangler secret put AADHAR_ORIGIN  # https://aadhar-dashboard-9ljo.onrender.com
   npx wrangler deploy
   curl https://aadhar-keepalive.aadhar-haryana.workers.dev/status
   ```

   `wrangler.toml` already points at account `606780bc6c3ecd48289472c73d27a982`,
   KV namespace `5ec6604fe3d5402e8d4d9d4394445f9c`, cron `*/10 * * * *`.

2. **Render billing confirmation unavailable**: `RENDER_API_KEY` unset and
   `.render.local` missing, so 750h free-instance usage and the 5 GB/month
   Hobby bandwidth suspension cannot be verified via API. Monitor
   `https://aadhar-keepalive.aadhar-haryana.workers.dev/status` for
   `throttled: true`.

3. **dash-site Worker `scheduled` still sleeps 21:00-06:00 IST** for the Node
   backend (intentional, unchanged). The Aadhaar service is now covered by
   `aadhar-keepalive` 24/7 instead.

4. **Credential hygiene**: never commit `.env.local`, `.cloudflare.local`,
   `.render.local`, the bridge token, or Cloudflare/Render API tokens.
