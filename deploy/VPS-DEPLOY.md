# Deploying to the Hostinger VPS

This is the manual runbook for the first deployment and every update after it. These steps run
**on the VPS itself** (over SSH) — nothing here can be run remotely by an assistant without SSH
access to the box.

## One-time prerequisites

1. **DNS**: in your domain registrar (or Hostinger's DNS panel), create an A record pointing your
   domain/subdomain (e.g. `app.yourdomain.com`) at the VPS's public IP address. Caddy needs this
   to already resolve correctly before it can issue a Let's Encrypt certificate — do this first
   and give it a few minutes to propagate.
2. **SSH into the VPS** as a user with sudo access.
3. **Get the code onto the VPS** at `/opt/flexshoes`:
   ```bash
   sudo mkdir -p /opt/flexshoes
   sudo chown $USER /opt/flexshoes
   git clone <your-repo-url> /opt/flexshoes
   # or: rsync the repo up from your machine if there's no git remote reachable from the VPS
   ```
4. **Create `.env.prod`** with real secrets:
   ```bash
   cd /opt/flexshoes
   cp .env.prod.example .env.prod
   nano .env.prod   # fill in DOMAIN, CORS_ALLOWED_ORIGIN, JWT_SECRET, DB_PASSWORD, SYNC_API_KEY
   ```
   `JWT_SECRET` and `SYNC_API_KEY` must exactly match the values already generated into the local
   desktop's `deploy/.env` (see that file's comments) — everything else here is VPS-only and
   independent.
5. **Run first-time setup** (installs Docker, configures the firewall, builds and starts the
   stack, registers the nightly backup cron job):
   ```bash
   sudo ./deploy/vps-setup.sh
   ```
6. **Verify**:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   curl https://your-domain.com/api/health
   ```
   You should see all three containers (`postgres`, `api`, `caddy`) healthy/running, and the
   health check should return `{"status":"healthy",...}`. Then log into the app in a real browser
   at `https://your-domain.com` and confirm no mixed-content warnings and a valid certificate.

## Every subsequent deploy

```bash
cd /opt/flexshoes
./deploy/vps-update.sh
```

Pulls the latest code, rebuilds the `api` image (which bakes in a fresh frontend build too), and
restarts — waits up to 60s for the health check to go green before reporting success.

## What's exposed vs. what isn't

- **Public (via Caddy, ports 80/443 only)**: the whole app — SPA, REST API, SignalR hub — all
  through one HTTPS origin.
- **Never public**: Postgres. `docker-compose.prod.yml` deliberately never publishes its port; it's
  only reachable from the `api` container over the internal Docker network. The firewall rules in
  `vps-setup.sh` also explicitly avoid opening 5432 or 8080 to the internet.

## Backups

Nightly `pg_dump -Fc` backups run via cron (registered by `vps-setup.sh`) into
`/opt/flexshoes/backups/{daily,monthly}` — 30 days of dailies plus one permanent dump per
calendar month, same retention policy as the Windows desktop's `tools/backup-db.ps1`. Check
`/var/log/flexshoes-backup.log` if a backup seems to be missing.

## Rotating the default seeded accounts

Before this is reachable from the internet, log in once with each of the three seeded accounts
(`admin`/`admin123`, `cashier`/`cashier123`, `stock_manager`/`stock123`) and set a real password —
each is flagged `mustChangePassword` so this is enforced on first login, but do it before anyone
else can reach the login page.
