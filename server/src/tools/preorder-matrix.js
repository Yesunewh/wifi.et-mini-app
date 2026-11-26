"use strict";
/**
 * Diagnoses a failing preOrder by trying the request in a few documented variants
 * (signature padding, trade type, optional payee fields, amount). Each attempt only
 * creates an unpaid test order, which expires on its own. Prints no secrets.
 * Run from server/:  npm run matrix
 */
const path = require("node:path");
const { loadDotEnv, buildConfig } = require("../config");
const { postJson } = require("../telebirr/http");
const { signParams, nonceStr, timestamp } = require("../telebirr/sign");
const { createTelebirrClient } = require("../telebirr/client");
const { newMerchOrderId } = require("../services/orders");

loadDotEnv(path.resolve(__dirname, "../../.env"));
const cfg = buildConfig({ ...process.env, TELEBIRR_MODE: process.env.TELEBIRR_MODE === "production" ? "production" : "sandbox" });
const t = cfg.telebirr;

const variants = [];
for (const padding of ["pss", "pkcs1"])
  for (const tradeType of ["InApp", "Checkout"])
    for (const payee of [false, true])
      variants.push({ padding, tradeType, payee });

(async () => {
  const token = await createTelebirrClient(cfg).getFabricToken();
  console.log("fabric token ok\n");
  for (const v of variants) {
    const biz = {
      notify_url: "https://example.com/api/payment/notify",
      redirect_url: "https://example.com/return",
      appid: t.merchantAppId, merch_code: t.merchantCode, merch_order_id: newMerchOrderId(),
      trade_type: v.tradeType, title: "wifiet test", total_amount: "10", trans_currency: "ETB",
      timeout_express: "120m", business_type: "BuyGoods",
    };
    if (v.payee) Object.assign(biz, { payee_identifier: t.merchantCode, payee_identifier_type: "04", payee_type: "5000" });
    const req = { timestamp: timestamp(), nonce_str: nonceStr(), method: "payment.preorder", version: "1.0", biz_content: biz };
    req.sign = signParams(req, t.privateKey, v.padding);
    req.sign_type = "SHA256WithRSA";
    const label = `padding=${v.padding.padEnd(5)} trade_type=${v.tradeType.padEnd(8)} payee_fields=${v.payee ? "yes" : "no "}`;
    try {
      const r = await postJson(t.baseUrl + "/payment/v1/merchant/preOrder", req, { headers: { "X-APP-Key": t.fabricAppId, Authorization: token }, ca: t.ca });
      const ok = r.result === "SUCCESS" && r.biz_content && r.biz_content.prepay_id;
      console.log(`${ok ? "OK  " : "FAIL"} ${label}  ${ok ? "prepay_id received" : `${r.code || r.errorCode} ${r.msg || r.errorMsg}`}`);
    } catch (e) {
      const b = e.body || {};
      console.log(`FAIL ${label}  ${b.errorCode || b.code || e.status || ""} ${b.errorMsg || b.msg || e.message}`);
    }
  }
})().catch((e) => { console.error("FAILED: " + e.message); process.exit(1); });
