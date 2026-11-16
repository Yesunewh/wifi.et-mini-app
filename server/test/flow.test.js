"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { buildConfig } = require("../src/config");
const { createApp, normMsisdn } = require("../src/app");

const quiet = { info() {}, warn() {}, error() {} };

async function boot(env = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wifiet-test-"));
  const cfg = buildConfig({ TELEBIRR_MODE: "mock", SESSION_SECRET: "x".repeat(40), ADMIN_TOKEN: "a".repeat(32), DATA_DIR: dataDir, SERVE_MINIAPP: "false", ...env });
  const ctx = createApp(cfg, { log: quiet, memoryDb: true });
  const server = await new Promise((r) => { const s = ctx.app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body, token) => {
    const res = await fetch(base + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { ...ctx, call, close: () => server.close() };
}

test("phone numbers are normalised to 2519XXXXXXXX", () => {
  assert.equal(normMsisdn("0912345678"), "251912345678");
  assert.equal(normMsisdn("+251 912 345 678"), "251912345678");
  assert.equal(normMsisdn("712345678"), "251712345678");
  assert.equal(normMsisdn("12345"), null);
});

test("login → order → telebirr pays → one voucher and one SMS", async (t) => {
  const s = await boot();
  t.after(s.close);
  const login = await s.call("POST", "/api/auth/login", { accessToken: "251911223344" });
  assert.equal(login.status, 200);
  const tok = login.body.token;
  assert.equal(login.body.user.msisdn, "251911223344");

  const bad = await s.call("POST", "/api/orders", { packageId: "nope" }, tok);
  assert.equal(bad.status, 400);

  const order = await s.call("POST", "/api/orders", { packageId: "w5", amount: 1 /* ignored */ }, tok);
  assert.equal(order.status, 201);
  assert.equal(order.body.amount, 150, "price comes from the server catalogue");
  assert.match(order.body.rawRequest, /prepay_id=MOCK/);
  const id = order.body.orderId;
  assert.match(id, /^WF\d+$/);

  // Before payment
  let st = await s.call("GET", `/api/orders/${id}`, null, tok);
  assert.equal(st.body.order.status, "PAYING");

  // telebirr checkout (mock) → notification; then a duplicate notification
  const notify = s.telebirr._pay(id);
  await s.call("POST", "/api/payment/notify", notify);
  await s.call("POST", "/api/payment/notify", notify);

  st = await s.call("GET", `/api/orders/${id}`, null, tok);
  assert.equal(st.body.order.status, "FULFILLED");
  assert.match(st.body.order.code, /^WF-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(s.sms.outbox.length, 1, "exactly one SMS");

  const passes = await s.call("GET", "/api/me/passes", null, tok);
  assert.equal(passes.body.active.length, 1);
  assert.equal(passes.body.active[0].code, st.body.order.code);

  const msgs = await s.call("GET", "/api/me/messages", null, tok);
  assert.ok(msgs.body.messages.some((m) => m.title === "Payment successful"));
});

test("a notification is not trusted on its own: the order is confirmed with queryOrder", async (t) => {
  const s = await boot();
  t.after(s.close);
  const tok = (await s.call("POST", "/api/auth/login", { accessToken: "251911000001" })).body.token;
  const id = (await s.call("POST", "/api/orders", { packageId: "d1" }, tok)).body.orderId;
  // Forged "Completed" notification for an order that telebirr says is unpaid
  await s.call("POST", "/api/payment/notify", { merch_order_id: id, trade_status: "Completed", total_amount: "15.00", sign: "x", sign_type: "SHA256WithRSA" });
  const st = await s.call("GET", `/api/orders/${id}`, null, tok);
  assert.equal(st.body.order.status, "PAYING");
  assert.equal(st.body.order.code, null);
});

test("an order whose paid amount differs from the price is not fulfilled", async (t) => {
  const s = await boot();
  t.after(s.close);
  const tok = (await s.call("POST", "/api/auth/login", { accessToken: "251911000002" })).body.token;
  const id = (await s.call("POST", "/api/orders", { packageId: "m10" }, tok)).body.orderId;
  // Tamper with the mock gateway's record so telebirr reports a different amount
  const realQuery = s.telebirr.queryOrder;
  s.telebirr.queryOrder = async (mid) => ({ ...(await realQuery(mid)), status: "PAY_SUCCESS", totalAmount: "1.00" });
  await s.call("POST", "/api/payment/notify", { merch_order_id: id, trade_status: "Completed" });
  const st = await s.call("GET", `/api/orders/${id}`, null, tok);
  assert.notEqual(st.body.order.status, "FULFILLED");
});

test("users cannot see each other's orders", async (t) => {
  const s = await boot();
  t.after(s.close);
  const a = (await s.call("POST", "/api/auth/login", { accessToken: "251911000003" })).body.token;
  const b = (await s.call("POST", "/api/auth/login", { accessToken: "251911000004" })).body.token;
  const id = (await s.call("POST", "/api/orders", { packageId: "d500" }, a)).body.orderId;
  assert.equal((await s.call("GET", `/api/orders/${id}`, null, b)).status, 404);
  assert.equal((await s.call("GET", "/api/me", null, "forged.token")).status, 401);
});

test("hotspot QR connect starts the pass", async (t) => {
  const s = await boot();
  t.after(s.close);
  const tok = (await s.call("POST", "/api/auth/login", { accessToken: "251911000005" })).body.token;
  const id = (await s.call("POST", "/api/orders", { packageId: "d1" }, tok)).body.orderId;
  await s.call("POST", "/api/payment/notify", s.telebirr._pay(id));
  assert.equal((await s.call("POST", `/api/passes/${id}/connect`, { qr: "https://evil.example/x" }, tok)).status, 400);
  const r = await s.call("POST", `/api/passes/${id}/connect`, { qr: "https://wifi.et/h/meskel" }, tok);
  assert.equal(r.status, 200);
  assert.equal(r.body.hotspot.name, "Meskel Square");
  assert.ok(r.body.pass.startedAt);
});

test("business: KYC → admin approval → sales request", async (t) => {
  const s = await boot();
  t.after(s.close);
  const tok = (await s.call("POST", "/api/auth/login", { accessToken: "251911000006" })).body.token;
  const pdf = "data:application/pdf;base64," + Buffer.from("%PDF-1.4 test").toString("base64");

  assert.equal((await s.call("POST", "/api/business/leads", { formats: ["Video ad"] }, tok)).status, 403, "locked before KYC");
  const missing = await s.call("POST", "/api/business/kyc", { legalName: "Abebe Café PLC" }, tok);
  assert.equal(missing.status, 400);
  const bad = await s.call("POST", "/api/business/kyc", {
    legalName: "Abebe Café PLC", businessType: "Private limited company (PLC)", tin: "0012345678", licenseNo: "AA/14/1/0000001/2016",
    contactPerson: "Abebe Kebede", consent: true,
    documents: { license: { name: "l.exe", dataUrl: "data:application/x-msdownload;base64,TVo=" }, tin: { dataUrl: pdf }, id: { dataUrl: pdf } },
  }, tok);
  assert.equal(bad.status, 400, "only PDF/JPG/PNG");
  const ok = await s.call("POST", "/api/business/kyc", {
    legalName: "Abebe Café PLC", businessType: "Private limited company (PLC)", tin: "0012345678", licenseNo: "AA/14/1/0000001/2016",
    contactPerson: "Abebe Kebede", consent: true, documents: { license: { name: "l.pdf", dataUrl: pdf }, tin: { dataUrl: pdf }, id: { dataUrl: pdf } },
  }, tok);
  assert.equal(ok.status, 201);

  const admin = "a".repeat(32);
  assert.equal((await s.call("GET", "/api/admin/businesses", null, tok)).status, 401, "users are not admins");
  const list = await s.call("GET", "/api/admin/businesses", null, admin);
  assert.equal(list.body.businesses.length, 1);
  await s.call("POST", `/api/admin/businesses/${list.body.businesses[0].id}/decision`, { decision: "verified" }, admin);

  const lead = await s.call("POST", "/api/business/leads", { formats: ["Video ad", "Not a format"], areas: ["Bole"], contactBy: "SMS" }, tok);
  assert.equal(lead.status, 201);
  assert.match(lead.body.ref, /^ADV-\d{6}$/);
  const leads = await s.call("GET", "/api/admin/leads", null, admin);
  assert.deepEqual(JSON.parse(leads.body.leads[0].formats), ["Video ad"]);
});
