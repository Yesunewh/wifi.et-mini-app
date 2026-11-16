"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { buildSignString, signParams, verifyParams, signString, verifyString, nonceStr, toPrivateKey } = require("../src/telebirr/sign");
const { createTelebirrClient, safeTitle, amountStr } = require("../src/telebirr/client");

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" },
});

test("sign string matches the developer portal example exactly", () => {
  // Example from developer.ethiotelecom.et → RequestSignatureProcess
  const req = {
    timestamp: "1755866911", nonce_str: "H5QN4M6EAB2TXXVFK8SVV0RW6UFASICS", method: "payment.preorder", version: "1.0",
    biz_content: {
      notify_url: "https://www.google.com", appid: "1227484825753601", merch_code: "101011", merch_order_id: "1755866910890",
      trade_type: "Checkout", title: "diamond_1.5", total_amount: "1.5", trans_currency: "ETB", timeout_express: "120m",
    },
    sign: "ignored", sign_type: "SHA256WithRSA",
  };
  assert.equal(buildSignString(req),
    "appid=1227484825753601&merch_code=101011&merch_order_id=1755866910890&method=payment.preorder&nonce_str=H5QN4M6EAB2TXXVFK8SVV0RW6UFASICS&notify_url=https://www.google.com&timeout_express=120m&timestamp=1755866911&title=diamond_1.5&total_amount=1.5&trade_type=Checkout&trans_currency=ETB&version=1.0");
});

test("sign/verify round trip (PSS and PKCS#1)", () => {
  for (const pad of ["pss", "pkcs1"]) {
    const p = { a: "1", b: "2", biz_content: { c: "3" } };
    p.sign = signParams(p, privateKey, pad);
    assert.ok(verifyParams(p, publicKey, pad), pad);
    assert.ok(!verifyParams({ ...p, a: "9" }, publicKey, pad), `${pad} tamper`);
  }
});

test("accepts a bare base64 PKCS#8 private key (as pasted from the portal)", () => {
  const bare = privateKey.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const sig = signString("x=1", bare, "pss");
  assert.ok(verifyString("x=1", sig, publicKey, "pss"));
  assert.equal(toPrivateKey(bare).asymmetricKeyType, "rsa");
});

test("nonce is 32 upper-case alphanumerics", () => {
  assert.match(nonceStr(), /^[A-Z0-9]{32}$/);
});

test("rawRequest has the documented field order and a valid signature", () => {
  const cfg = { telebirr: { baseUrl: "https://x", merchantAppId: "1000000000000001", merchantCode: "100100", privateKey, publicKey, signPadding: "pss" } };
  const tb = createTelebirrClient(cfg, { log: { warn() {}, error() {} } });
  const raw = tb.buildRawRequest("PREPAY123");
  const parts = raw.split("&").map((s) => s.split("=")[0]);
  assert.deepEqual(parts, ["appid", "merch_code", "nonce_str", "prepay_id", "timestamp", "sign", "sign_type"]);
  const kv = Object.fromEntries(raw.split("&").map((s) => { const i = s.indexOf("="); return [s.slice(0, i), s.slice(i + 1)]; }));
  const toSign = `appid=${kv.appid}&merch_code=${kv.merch_code}&nonce_str=${kv.nonce_str}&prepay_id=${kv.prepay_id}&timestamp=${kv.timestamp}`;
  assert.ok(verifyString(toSign, kv.sign, publicKey, "pss"));
});

test("titles and amounts are made gateway-safe", () => {
  assert.equal(safeTitle("wifiet Weekly-5GB (promo)!"), "wifiet Weekly 5GB promo");
  assert.equal(amountStr(75), "75");
  assert.equal(amountStr(2.3), "2.30");
  assert.throws(() => amountStr(0));
});
