# wifi.et × telebirr: integration guide

Source: developer.ethiotelecom.et → *Mini App Development Guide* and *Mini App Integration*.

## How a purchase works

1. The mini app opens in telebirr and calls `ma.native("getMiniAppToken", { appId })`.
2. `POST /api/auth/login` → the server exchanges that token at `/payment/v1/auth/authToken` for the customer's `open_id` (and phone number and first name, if our merchant code is whitelisted).
3. The customer picks a package. `POST /api/orders { packageId }` → the server looks up the price, calls `/payment/v1/merchant/preOrder` and returns a signed `rawRequest`.
4. The mini app calls `ma.native("startPay", { rawRequest, bussinessType: "BuyGoods" })`. telebirr shows its own checkout and PIN screen.
5. telebirr POSTs the result to `PUBLIC_BASE_URL/api/payment/notify`.
6. The server confirms the payment, issues the Wi-Fi code from the Wi-Fi platform, sends the SMS and adds an inbox message. The app polls `GET /api/orders/:id` until the code is ready.

### Payment safety rules in the server

- Prices come only from `server/src/catalog.js`. The app sends a package id, never an amount.
- A notification is accepted only if its signature verifies against telebirr's public key. Without that key, the server confirms every payment with `queryOrder` before issuing a code.
- The paid amount must equal the catalogue price.
- One order gets exactly one code, even if telebirr notifies several times.
- If no notification arrives, the app's polling triggers `queryOrder`.

## Settings (`server/.env`)

See `.env.example`. Still needed from the telebirr team:

| Item | Why |
|---|---|
| telebirr **public key** | Verify notification signatures (`TELEBIRR_PUBLIC_KEY_FILE`). |
| `notify_url` whitelisting | telebirr only calls whitelisted URLs. Needs a public HTTPS address. |
| Merchant code whitelisting for `identifier` | So login returns the customer's phone number. Until then the app asks for it once. |
| Signature padding | The portal sample uses `SHA256withRSAandMGF1` (PSS), our default. If the gateway rejects signatures, set `TELEBIRR_SIGN_PADDING=pkcs1`. |
| JS SDK (`js-sdk.min.js`) | Download from the portal into `miniapp/vendor/`. |
| QR scan API name | Set `scanMethod` in `miniapp/js/config.js`. Until then customers type the hotspot code on the sticker. |

## Adapters to finish

- `server/src/adapters/wifi.js`: `issueVoucher` and `connect` are templates. Replace with the real hotspot platform API (captive portal / RADIUS).
- `server/src/adapters/sms.js`: template for the SMS gateway.
- Hotspots are seeded from `catalog.js`; load the real site list into the `hotspots` table. QR stickers should encode `https://wifi.et/h/<hotspot id>`.
- Data usage and "hotspots visited" need the Wi-Fi platform's session data.

## Admin endpoints (Bearer `ADMIN_TOKEN`)

- `GET /api/admin/businesses?status=review` and `GET /api/admin/businesses/:id/documents/:kind`
- `POST /api/admin/businesses/:id/decision { decision: "verified" | "rejected", note }`
- `GET /api/admin/leads`
- `POST /api/admin/orders/:id/reconcile`, `POST /api/admin/orders/:id/refund { amount, reason }`

These are an API only; a review screen for the KYC team is still to be built.

## Packaging the mini app (Macle)

1. Install Macle DevToolkit 25.9.0 and its VS Code extension.
2. Set `apiBase` in `miniapp/js/config.js` to the server's public HTTPS address.
3. Open `miniapp/` in VS Code → Macle → **Converter** → project type *H5 application*, not a build project, home page `index.html`, App ID from the AppCube Macle Management Console.
4. Test in the simulator (mock `getMiniAppToken` and `startPay` with *Custom API*), then **Package**.
5. Upload in AppCube (sandbox) → set as trial version → scan the QR with the sandbox telebirr app → submit for approval.
6. For production: switch `TELEBIRR_MODE=production` with production credentials, repeat upload and approval.

## Before go-live

- Production credentials and a new key pair generated on the production server (`npm run keys`).
- HTTPS, backups for `server/data/` (orders and KYC documents), log retention.
- Move from SQLite to a managed database if volumes require it.
- Rate limiting at the reverse proxy; restrict `CORS_ORIGINS` if the mini app is served from a fixed origin.
- Confirm validity periods (24 h / 7 d / 30 d) and advertising prices with the business owner.
