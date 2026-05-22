# vps-ops integration — beatmakerbox-aggregator

Backend service that aggregates free sample packs from public sources
(Reddit, Freesound, RSS blogs, YouTube) and exposes them via `/api/packs`.

---

## 1. Repo & build context

- [x] Lives inside the **monorepo** `beatmakerbox` (root) → `apps/aggregator/`
- [x] Docker build context is **the monorepo root** (the compose file uses
      `context: ../..`) so the image can copy `packages/dsp` and the
      workspace lockfile
- [x] No secrets committed

## 2. Detected app type

**docker** — `docker-compose.yml` present in `apps/aggregator/`.

vps-ops will run from `/opt/apps/beatmakerbox-aggregator/`:
```
docker compose up -d --remove-orphans
```

If you want vps-ops to clone the **whole monorepo** at `/opt/apps/beatmakerbox-aggregator/`
and then `docker compose up` from the `apps/aggregator/` subdirectory,
override the deploy steps in `apps.json` (see §8 below).

## 3. Containers

| Container | Role | Image |
|---|---|---|
| `beatmakerbox-aggregator-1` | Fastify API + cron | `beatmakerbox-aggregator:latest` (local build) |

→ auto-attached via `autoAttachPrefix: "beatmakerbox-aggregator-"`.

## 4. Persistent volume

- Host: `./data/` (relative to compose file)
- Container: `/app/data/`
- Contains the SQLite database. **Back this up.**

## 5. Network & Traefik

- External network: `traefik_proxy` (same one as the web app)
- Labels in `docker-compose.yml` (HTTPS + HTTP→HTTPS redirect)
- Domain via `AGGREGATOR_DOMAIN` env var (e.g. `api.beatmakerbox.com`)
- Internal port: **3002**

## 6. Healthcheck

- `GET /api/healthz` → `200 {"status":"ok","uptimeSec":...}`
- Native Docker healthcheck baked into the Dockerfile (`wget /api/healthz`)

## 7. Environment variables (`.env` at `/opt/apps/beatmakerbox-aggregator/.env`)

| Variable | Required | Description |
|---|---|---|
| `AGGREGATOR_DOMAIN` | yes | Public domain — used in Traefik labels (e.g. `api.beatmakerbox.com`) |
| `CORS_ORIGINS` | yes | Comma-separated list, must include the web app domain |
| `REDDIT_SUBS` | optional | Default: `Drumkits,freedrums,WeAreTheMusicMakers` |
| `REDDIT_USER_AGENT` | recommended | Required by Reddit's TOS |
| `AGGREGATE_CRON` | optional | Default: `17 3 * * *` (3:17 AM UTC) |
| `AGGREGATE_ON_BOOT` | optional | Default: `false` — set `true` on first deploy |
| `DB_PATH` | optional | Default: `/app/data/aggregator.db` |

See `.env.example` for the full list.

## 8. Suggested `apps.json` block

```json
{
  "id": "beatmakerbox-aggregator",
  "label": "Beatmakerbox · Aggregator",
  "type": "docker",
  "path": "/opt/apps/beatmakerbox-aggregator",
  "repo": "git@github.com:<owner>/beatmakerbox.git",
  "branch": "main",
  "autoAttachPrefix": "beatmakerbox-aggregator-",
  "envFiles": ["/opt/apps/beatmakerbox-aggregator/.env"],
  "routing": {
    "domains": ["${AGGREGATOR_DOMAIN}"],
    "internalPort": 3002,
    "container": "beatmakerbox-aggregator-1"
  },
  "healthchecks": [
    {
      "name": "api",
      "url": "https://${AGGREGATOR_DOMAIN}/api/healthz",
      "expectedStatus": [200]
    }
  ],
  "actions": {
    "deploy": {
      "label": "Redeploy aggregator",
      "destructive": false,
      "steps": [
        { "cmd": "git",    "args": ["fetch", "origin", "main"] },
        { "cmd": "git",    "args": ["reset", "--hard", "origin/main"] },
        { "cmd": "docker", "args": ["compose", "-f", "apps/aggregator/docker-compose.yml", "build", "api"] },
        { "cmd": "docker", "args": ["compose", "-f", "apps/aggregator/docker-compose.yml", "up", "-d", "--remove-orphans"] }
      ],
      "verify": ["api"],
      "verifyRetries": 8,
      "verifyIntervalSec": 5,
      "enableAutoRollback": true,
      "rollback": [
        { "cmd": "git", "args": ["reset", "--hard", "${PREV_SHA}"] },
        { "cmd": "docker", "args": ["compose", "-f", "apps/aggregator/docker-compose.yml", "up", "-d", "--remove-orphans"] }
      ]
    }
  }
}
```

## 9. First-deploy checklist

On the VPS:
- [ ] `docker network ls` shows `traefik_proxy`
- [ ] DNS `api.beatmakerbox.com` → VPS IP, propagated
- [ ] Created `/opt/apps/beatmakerbox-aggregator/.env` with the vars above
- [ ] First deploy with `AGGREGATE_ON_BOOT=true` (so packs appear immediately) — then flip to `false`

## 10. API endpoints

```
GET  /api/healthz                 → {status: "ok", uptimeSec}
GET  /api/sources                 → {sources: [{id, label, count}]}
GET  /api/packs?source=&q=&page=  → {total, page, limit, pages, packs[]}
GET  /api/packs/:slug             → {pack}
```

## 11. Triggering a manual aggregation

Inside the container:
```bash
docker exec -it beatmakerbox-aggregator-1 node dist/jobs/aggregate.js
```

Or curl the cron entrypoint (none exposed by default — keep it that way to avoid public abuse).

## 12. Troubleshooting

- **CORS errors from the web app** → `CORS_ORIGINS` env var. Restart the container after editing.
- **`/api/packs` returns `total: 0`** → no aggregation has run yet. Set `AGGREGATE_ON_BOOT=true` and restart, or `docker exec` the manual command above.
- **Reddit 429 / 403** → bad or missing `REDDIT_USER_AGENT`. Use a unique UA.
- **SQLite locked** → confirm only one container instance; WAL mode is on so concurrent reads are safe but a second writer will block.
