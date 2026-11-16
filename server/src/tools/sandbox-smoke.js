"use strict";
/**
 * Checks the telebirr credentials and request signing against the sandbox, without the app:
 *   1. fabric token   2. preOrder for 1 ETB   3. queryOrder for that order
 * Run from server/:  npm run smoke
 * Prints no secrets. Needs network access to the sandbox gateway (it may only accept
 * connections from whitelisted / Ethiopian networks).
 */
const path = require("node:path");
const { loadDotEnv, buildConfig } = require("../config");
const { createTelebirrClient } = require("../telebirr/client");
const { newMerchOrderId } = require("../services/orders");

loadDotEnv(path.resolve(__dirname, "../../.env"));
const cfg = buildConfig();
if (cfg.telebirr.mode === "mock") { console.error("Set TELEBIRR_MODE=sandbox in server/.env first."); process.exit(1); }

(async () => {
  const tb = createTelebirrClient(cfg);
  const step = (n, s) => console.log(`${n}. ${s}`);
  try {
    step(1, `fabric token from ${cfg.telebirr.baseUrl} …`);
    const token = await tb.getFabricToken();
    console.log(`   ok (${token.slice(0, 12)}…)`);

    const id = newMerchOrderId();
    step(2, `preOrder ${id} for 1 ETB …`);
    const { prepayId } = await tb.preOrder({ merchOrderId: id, title: "wifiet smoke test", amount: 1, notifyUrl: `${cfg.publicBaseUrl}/api/payment/notify` });
    console.log(`   ok prepay_id=${prepayId}`);
    console.log(`   rawRequest built (${tb.buildRawRequest(prepayId).length} chars)`);

    step(3, "queryOrder …");
    const r = await tb.queryOrder(id);
    console.log(`   ok status=${r.status}`);
    console.log("\nCredentials and signing work. The order above will expire unpaid.");
  } catch (e) {
    console.error(`   FAILED: ${e.message}`);
    if (e.details) console.error("   gateway said:", JSON.stringify({ code: e.details.code, msg: e.details.msg, errorCode: e.details.errorCode, errorMsg: e.details.errorMsg }));
    if (e.body) console.error("   body:", typeof e.body === "string" ? e.body : JSON.stringify(e.body).slice(0, 400));
    if (/sign/i.test(String(e.details && (e.details.msg || e.details.errorMsg) || ""))) {
      console.error("   Hint: try TELEBIRR_SIGN_PADDING=pkcs1, and check telebirr has the matching public key.");
    }
    process.exit(1);
  }
})();
