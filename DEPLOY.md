# Deployment (VPS)

Live test instance: **https://mini-app-test.wifi.et** (telebirr `mock` mode until credentials arrive).

| What | Where |
|---|---|
| Checkout | `/home/haile/projects/wifi-et` (branch `feature/macle-native`) |
| Container | `wifiet-server`, Node 24 alpine, `127.0.0.1:3100` only |
| Settings / secrets | `server/.env` (chmod 600, not in git), keys in `server/keys/` (mounted read-only) |
| Data | `server/data/` (SQLite `wifiet.db` + KYC uploads), bind-mounted |
| Reverse proxy / TLS | Caddy (system service), `/etc/caddy/Caddyfile`, Let's Encrypt auto-renew, logs in `/var/log/caddy/` |
| Firewall | ufw allows 80/tcp, 443/tcp, 443/udp for Caddy |
| Backups | `scripts/backup.sh` daily 03:17 (haile crontab) → `~/backups/wifi-et/`, newest 14 kept |

## Update

```bash
cd ~/projects/wifi-et
git pull
docker compose up -d --build
curl -s https://mini-app-test.wifi.et/api/health
```

## Switch to the telebirr sandbox

1. Put the private key in `server/keys/merchant_private.pem` (and `telebirr_public.pem` when received), readable by haile.
2. In `server/.env`: `TELEBIRR_MODE=sandbox` and the Fabric App ID, App Secret, Merchant App ID, merchant code.
3. `docker compose up -d` then `docker exec wifiet-server npm run smoke`.
4. Ask telebirr to whitelist `https://mini-app-test.wifi.et/api/payment/notify`.

## Logs and restore

```bash
docker logs -f wifiet-server
sudo tail -f /var/log/caddy/mini-app-test.wifi.et.log
# restore: stop the container, extract a backup into server/data, rename snapshot.db to wifiet.db, start again
```
