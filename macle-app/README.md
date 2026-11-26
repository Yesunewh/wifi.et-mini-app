# wifi.et native Macle mini app

Open this folder in VS Code with the Macle extension (DevToolkit 25.9.0).

- `app.json`: pages and the bottom tab bar (Home, Hotspots, My Wi-Fi, Profile)
- `utils/config.js`: server address (`apiBase`) and merchant app id
- `utils/telebirr.js`: `getMiniAppToken` login and `startPay` checkout
- `pages/`: one folder per screen

## Run in the simulator

1. Start the server in mock mode: `cd ../server && npm install && npm start`
2. In VS Code: Macle sidebar → Simulator.

The simulator has no telebirr login or checkout, so against a mock-mode server the app signs in
with `devMsisdn` and simulates the payment. On a real phone it uses telebirr.

## Before packaging

- Set `appid` in `project.config.json` to the App ID from the AppCube Macle Management Console.
- Set `apiBase` to the server's public HTTPS address.
