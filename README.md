# wifi.et mini app

wifi.et sells Wi-Fi packages for ethio telecom hotspots through the **telebirr** SuperApp.

| Folder | What it is |
|---|---|
| `macle-app/` | **The mini app** as a native Macle project (maml/mass/js), same format as telebirr's sample. Open in VS Code with the Macle extension. |
| `miniapp/` | Earlier web (H5) version of the same screens; handy for testing in a browser. |
| `server/` | The merchant back end (Node 22, Express, SQLite). Talks to the telebirr payment gateway, issues Wi-Fi codes, sends SMS, stores business KYC and sales requests. |
| `demo/` | The original clickable demo (Option A and Option B) used for presentations. |
| `docs/INTEGRATION.md` | Setup, telebirr flow, go-live checklist and open items. |

## Run locally (no telebirr needed)

```bash
cd server
npm install
cp .env.example .env        # TELEBIRR_MODE=mock by default
npm start                   # http://localhost:3000
```

Open http://localhost:3000, sign in with any Ethiopian mobile number and buy a package. In mock mode payments are simulated, Wi-Fi codes are generated locally and SMS messages are printed in the server log.

```bash
npm test                    # signing, payment flow, KYC
```

## Connect to the telebirr sandbox

1. Put the credentials in `server/.env` (`TELEBIRR_MODE=sandbox`, Fabric App ID, App Secret, Merchant App ID, short code).
2. Save the RSA private key as `server/keys/merchant_private.pem`. `.env`, `keys/` and `data/` are git-ignored; never commit them.
3. `npm run smoke` checks the token, a 1 ETB pre-order and an order query.

See `docs/INTEGRATION.md` for the rest.
