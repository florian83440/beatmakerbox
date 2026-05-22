# vps-ops integration

Contract with the [vps-ops](https://github.com/florian83440/vps-ops) console.
This file describes exactly how this app plugs into `config/apps.json`.

---

## 1. Repo

- [x] GitHub repo reachable over SSH (`git@github.com:<owner>/beatmakerbox.git`)
- [x] Default branch: `main`
- [x] No secrets committed (`.env.example` is versioned, `.env` is not)
- [x] `.gitignore` excludes `.env`, `node_modules/`, `dist/`

## 2. Detected app type

**docker** — `docker-compose.yml` present at the root.

vps-ops will run:
```
docker compose up -d --remove-orphans
```

## 3. Containers

| Container | Role | Image |
|---|---|---|
| `beatmakerbox-web-1` | Vue 3 SPA served by nginx | `beatmakerbox:latest` (local build) |

→ auto-attached via `autoAttachPrefix: "beatmakerbox-"` in `apps.json`.

## 4. Network & Traefik

- External Docker network: `traefik_proxy` (must already exist on the VPS)
- Traefik labels defined directly in `docker-compose.yml` (HTTPS + HTTP→HTTPS redirect + HSTS)
- Domain configured via the `BEATMAKERBOX_DOMAIN` env var
- ACME resolver: `le` (Let's Encrypt — defined in the global Traefik config)

## 5. Healthcheck

- `GET /` → `200` (SPA, the index is also the health page)
- Native Docker healthcheck baked into the `Dockerfile` (`wget -qO- /`)
- No DB / backend call → very fast check

## 6. No database

The app is 100% client-side. No server storage, no backend.

## 7. Environment variables

| Variable | Where | Description |
|---|---|---|
| `BEATMAKERBOX_DOMAIN` | `.env` (root) | Public domain — used in Traefik labels |

The `.env` is read by docker compose at startup (not by the app — the SPA is fully static).

## 8. Suggested `apps.json` block

```json
{
  "id": "beatmakerbox",
  "label": "Beatmakerbox",
  "type": "docker",
  "path": "/opt/apps/beatmakerbox",
  "repo": "git@github.com:<owner>/beatmakerbox.git",
  "branch": "main",
  "autoAttachPrefix": "beatmakerbox-",
  "envFiles": ["/opt/apps/beatmakerbox/.env"],
  "routing": {
    "domains": ["${BEATMAKERBOX_DOMAIN}"],
    "internalPort": 80,
    "container": "beatmakerbox-web-1"
  },
  "healthchecks": [
    {
      "name": "site",
      "url": "https://${BEATMAKERBOX_DOMAIN}/",
      "expectedStatus": [200]
    }
  ],
  "actions": {
    "deploy": {
      "label": "Redeploy beatmakerbox",
      "destructive": false,
      "steps": [
        { "cmd": "git",    "args": ["fetch", "origin", "main"] },
        { "cmd": "git",    "args": ["reset", "--hard", "origin/main"] },
        { "cmd": "docker", "args": ["compose", "build", "web"] },
        { "cmd": "docker", "args": ["compose", "up", "-d", "--remove-orphans"] }
      ],
      "verify": ["site"],
      "verifyRetries": 6,
      "verifyIntervalSec": 5,
      "enableAutoRollback": true,
      "rollback": [
        { "cmd": "git",    "args": ["reset", "--hard", "${PREV_SHA}"] },
        { "cmd": "docker", "args": ["compose", "build", "web"] },
        { "cmd": "docker", "args": ["compose", "up", "-d", "--remove-orphans"] }
      ]
    }
  }
}
```

## 9. Onboarding via the vps-ops UI

1. **Host → Add an app**
2. Git URL: `git@github.com:<owner>/beatmakerbox.git`
3. Slug: `beatmakerbox`
4. Branch: `main`
5. Domain: `<your-domain>` (will be injected into `routing.domains`)
6. Internal port: `80`
7. Follow the SSE trace: clone → build → up → patch `apps.json`
8. **Before the final `up`**: `ssh ubuntu@<vps>` and create `/opt/apps/beatmakerbox/.env` with `BEATMAKERBOX_DOMAIN=...`
9. Tick *Restart vps-ops* at the end

## 10. Pre-onboarding checklist

On the VPS (once):

- [ ] `docker network ls` shows `traefik_proxy`
- [ ] DNS for the domain → VPS IP, propagated
- [ ] `ubuntu`'s SSH key authorized on the GitHub repo

Locally:

- [ ] `pnpm install && pnpm build` passes
- [ ] `docker compose build` passes (optional but recommended)

## 11. Troubleshooting

- **Traefik 404** → check `BEATMAKERBOX_DOMAIN` in `/opt/apps/beatmakerbox/.env`, then `docker compose up -d`
- **Cert not issued** → verify the `le` resolver is set up in the global Traefik config and that port 80 is open for the HTTP-01 challenge
- **Vue Router routes 404 after refresh** → should not happen; the `try_files $uri $uri/ /index.html` in `nginx.conf` handles SPA fallback
- **Build OOM** → add `NODE_OPTIONS=--max-old-space-size=2048` to the Dockerfile (build stage)
