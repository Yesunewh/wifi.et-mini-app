"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");

const { openDb, tx } = require("./db");
const { PACKAGES, AD_FORMATS, SAMPLE_HOTSPOTS, packageById } = require("./catalog");
const { createSessions, safeEqual } = require("./auth");
const { createTelebirrClient } = require("./telebirr/client");
const { createMockTelebirr } = require("./telebirr/mock");
const { createWifiAdapter } = require("./adapters/wifi");
const { createSmsAdapter } = require("./adapters/sms");
const { createOrderService } = require("./services/orders");

const MSISDN_RE = /^251[79]\d{8}$/;
const normMsisdn = (s) => {
  const d = String(s || "").replace(/[^\d]/g, "");
  const n = d.startsWith("0") && d.length === 10 ? "251" + d.slice(1) : d.length === 9 ? "251" + d : d;
  return MSISDN_RE.test(n) ? n : null;
};
const httpError = (status, message, code) => Object.assign(new Error(message), { status, code });
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const DOC_KINDS = ["license", "tin", "id"];
const DOC_TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const MAX_DOC_BYTES = 5 * 1024 * 1024;

function createApp(cfg, { log = console, memoryDb = false, telebirr: tbOverride } = {}) {
  const db = openDb(cfg.dataDir, { memory: memoryDb });
  const sessions = createSessions(cfg.sessionSecret || crypto.randomBytes(32).toString("hex"));
  const telebirr = tbOverride || (cfg.telebirr.mode === "mock" ? createMockTelebirr() : createTelebirrClient(cfg, { log }));
  const wifi = createWifiAdapter(cfg, { log });
  const sms = createSmsAdapter(cfg, { log });
  const orders = createOrderService({ db, cfg, telebirr, wifi, sms, log });
  const uploadDir = path.join(cfg.dataDir, "uploads");

  // Seed sample hotspots once (replace with the platform's site list).
  if (db.prepare("SELECT COUNT(*) AS n FROM hotspots").get().n === 0) {
    const ins = db.prepare("INSERT INTO hotspots (id, name, area, lat, lng) VALUES (?, ?, ?, ?, ?)");
    for (const h of SAMPLE_HOTSPOTS) ins.run(h.id, h.name, h.area, h.lat, h.lng);
  }

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // CORS: the API uses bearer tokens, never cookies.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowAll = cfg.corsOrigins.includes("*");
    if (origin && (allowAll || cfg.corsOrigins.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", allowAll ? "*" : origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use((req, res, next) => { res.setHeader("X-Content-Type-Options", "nosniff"); next(); });

  const smallJson = express.json({ limit: "64kb" });
  const bigJson = express.json({ limit: "24mb" });

  // ---------- helpers ----------
  const q = {
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    userByOpenId: db.prepare("SELECT * FROM users WHERE open_id = ?"),
    insertUser: db.prepare("INSERT INTO users (open_id, msisdn, name) VALUES (?, ?, ?)"),
    updateUser: db.prepare("UPDATE users SET msisdn = COALESCE(?, msisdn), name = COALESCE(?, name) WHERE id = ?"),
    ordersOf: db.prepare("SELECT * FROM orders WHERE user_id = ? AND status IN ('FULFILLED','REFUNDED') ORDER BY created_at DESC, id DESC LIMIT 200"),
    messagesOf: db.prepare("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100"),
    unread: db.prepare("SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND read = 0"),
    businessOf: db.prepare("SELECT * FROM businesses WHERE user_id = ?"),
    hotspots: db.prepare("SELECT * FROM hotspots ORDER BY name"),
    hotspot: db.prepare("SELECT * FROM hotspots WHERE id = ?"),
    msg: db.prepare("INSERT INTO messages (user_id, title, body, tag, icon) VALUES (?, ?, ?, ?, ?)"),
  };

  function requireUser(req, _res, next) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    const s = m && sessions.verify(m[1]);
    const user = s && q.userById.get(s.uid);
    if (!user) return next(httpError(401, "Please open wifi.et from telebirr again", "AUTH"));
    req.user = user;
    next();
  }
  function requireAdmin(req, _res, next) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!cfg.adminToken || !m || !safeEqual(m[1], cfg.adminToken)) return next(httpError(401, "Admin token required"));
    next();
  }

  const publicUser = (u) => ({ name: u.name, msisdn: u.msisdn, since: u.created_at });

  function passView(o) {
    const pkg = packageById(o.package_id);
    let state = o.status === "REFUNDED" ? "refunded" : "active";
    let expiresAt = null;
    if (o.started_at) {
      expiresAt = new Date(Date.parse(o.started_at.replace(" ", "T") + "Z") + pkg.validityHours * 3600e3).toISOString();
      if (Date.parse(expiresAt) < Date.now() && state === "active") state = "expired";
    }
    return {
      orderId: o.merch_order_id, packageId: o.package_id, name: pkg.name, data: pkg.data, validity: pkg.validity, price: pkg.price,
      code: o.voucher_code, transId: o.trans_id, boughtAt: o.paid_at || o.created_at, startedAt: o.started_at, expiresAt, state,
      dataUsedGb: null, // filled in once the Wi-Fi platform exposes usage
    };
  }

  function orderView(o) {
    return { orderId: o.merch_order_id, status: o.status, packageId: o.package_id, amount: Number(o.amount), code: o.voucher_code || null,
      transId: o.trans_id || null, to: o.recipient_msisdn, paidAt: o.paid_at, failed: o.status === "FAILED" };
  }

  // ---------- public ----------
  app.get("/api/health", (_req, res) => res.json({ ok: true, mode: telebirr.mode }));
  app.get("/api/packages", (_req, res) => res.json({ packages: PACKAGES }));
  app.get("/api/hotspots", (_req, res) => res.json({ hotspots: q.hotspots.all() }));
  app.get("/api/ad-formats", (_req, res) => res.json({ formats: AD_FORMATS }));

  // ---------- auth ----------
  app.post("/api/auth/login", smallJson, asyncH(async (req, res) => {
    const accessToken = String((req.body && req.body.accessToken) || "");
    if (!accessToken || accessToken.length > 512) throw httpError(400, "accessToken is required");
    let who;
    try { who = await telebirr.authToken(accessToken); }
    catch (e) { log.error(`[auth] authToken failed: ${e.message}`); throw httpError(502, "Could not sign you in with telebirr. Please try again."); }
    if (!who.openId) throw httpError(502, "telebirr did not return an account id");
    const msisdn = normMsisdn(who.msisdn);
    let user = q.userByOpenId.get(who.openId);
    if (!user) {
      const { lastInsertRowid } = q.insertUser.run(who.openId, msisdn, who.nickName || null);
      user = q.userById.get(lastInsertRowid);
      q.msg.run(user.id, "Welcome to wifi.et", "Find hotspots near you and pay with telebirr.", "Info", "bell");
    } else {
      q.updateUser.run(msisdn, who.nickName || null, user.id);
      user = q.userById.get(user.id);
    }
    res.json({ token: sessions.issue(user.id), user: publicUser(user) });
  }));

  // ---------- me ----------
  app.get("/api/me", requireUser, (req, res) => {
    const all = q.ordersOf.all(req.user.id);
    const biz = q.businessOf.get(req.user.id);
    res.json({
      user: publicUser(req.user),
      stats: { spent: all.filter((o) => o.status === "FULFILLED").reduce((a, o) => a + Number(o.amount), 0), passes: all.length,
        hotspots: 0 /* from the Wi-Fi platform's session history */ },
      unread: q.unread.get(req.user.id).n,
      business: biz ? { status: biz.status, legalName: biz.legal_name, tin: biz.tin, note: biz.review_note } : { status: "none" },
    });
  });
  app.patch("/api/me", requireUser, smallJson, (req, res) => {
    const msisdn = normMsisdn(req.body && req.body.msisdn);
    if (!msisdn) throw httpError(400, "Enter a valid Ethiopian mobile number");
    q.updateUser.run(msisdn, null, req.user.id);
    res.json({ user: publicUser(q.userById.get(req.user.id)) });
  });
  app.get("/api/me/passes", requireUser, (req, res) => {
    const list = q.ordersOf.all(req.user.id).map(passView);
    res.json({ active: list.filter((p) => p.state === "active"), history: list });
  });
  app.get("/api/me/messages", requireUser, (req, res) => {
    res.json({ messages: q.messagesOf.all(req.user.id).map((m) => ({ id: m.id, title: m.title, body: m.body, tag: m.tag, icon: m.icon, read: !!m.read, at: m.created_at })) });
  });
  app.post("/api/me/messages/read", requireUser, smallJson, (req, res) => {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(Number).filter(Number.isInteger).slice(0, 200) : null;
    if (ids) { const st = db.prepare("UPDATE messages SET read = 1 WHERE user_id = ? AND id = ?"); for (const id of ids) st.run(req.user.id, id); }
    else db.prepare("UPDATE messages SET read = 1 WHERE user_id = ?").run(req.user.id);
    res.json({ unread: q.unread.get(req.user.id).n });
  });

  // ---------- orders & payment ----------
  app.post("/api/orders", requireUser, smallJson, asyncH(async (req, res) => {
    const packageId = String((req.body && req.body.packageId) || "");
    let recipient = null;
    if (req.body && req.body.recipientMsisdn) {
      recipient = normMsisdn(req.body.recipientMsisdn);
      if (!recipient) throw httpError(400, "Enter a valid Ethiopian mobile number");
    }
    const r = await orders.createOrder(req.user, packageId, { recipientMsisdn: recipient });
    res.status(201).json(r);
  }));
  app.get("/api/orders/:id", requireUser, asyncH(async (req, res) => {
    let o = orders.getByMerchId(req.params.id);
    if (!o || o.user_id !== req.user.id) throw httpError(404, "Order not found");
    o = await orders.refresh(o);
    res.json({ order: orderView(o) });
  }));

  // telebirr → us. Must be reachable at PUBLIC_BASE_URL/api/payment/notify and whitelisted by telebirr.
  app.post("/api/payment/notify", express.json({ limit: "64kb", type: () => true }), asyncH(async (req, res) => {
    const r = await orders.handleNotify(req.body || {});
    if (!r.ok) log.warn(`[notify] ${req.body && req.body.merch_order_id}: ${r.reason}`);
    // Always acknowledge so telebirr does not retry forever; problems are logged for follow-up.
    res.json({ code: "0", msg: "success" });
  }));

  // ---------- connect at a hotspot ----------
  app.post("/api/passes/:id/connect", requireUser, smallJson, asyncH(async (req, res) => {
    const o = orders.getByMerchId(req.params.id);
    if (!o || o.user_id !== req.user.id || o.status !== "FULFILLED") throw httpError(404, "Pass not found");
    const p = passView(o);
    if (p.state !== "active") throw httpError(409, "This pass has expired");
    const raw = String((req.body && req.body.qr) || "");
    // Expected sticker content: https://wifi.et/h/<hotspotId> or wifiet://hotspot/<hotspotId>
    const m = /(?:\/h\/|hotspot\/)([a-z0-9-]{2,64})/i.exec(raw);
    const hotspot = m && q.hotspot.get(m[1].toLowerCase());
    if (!hotspot) throw httpError(400, "This is not a wifi.et hotspot code");
    const r = await wifi.connect({ voucherCode: o.voucher_code, hotspotId: hotspot.id, msisdn: o.recipient_msisdn });
    if (!r.ok) throw httpError(502, r.message || "Could not log you in at this hotspot");
    if (!o.started_at) db.prepare("UPDATE orders SET started_at = datetime('now') WHERE id = ? AND started_at IS NULL").run(o.id);
    res.json({ ok: true, hotspot: { id: hotspot.id, name: hotspot.name }, pass: passView(orders.getByMerchId(o.merch_order_id)) });
  }));

  // ---------- business (advertisers) ----------
  app.get("/api/business", requireUser, (req, res) => {
    const b = q.businessOf.get(req.user.id);
    res.json({ formats: AD_FORMATS, business: b ? { status: b.status, legalName: b.legal_name, tin: b.tin, note: b.review_note } : { status: "none" } });
  });

  app.post("/api/business/kyc", requireUser, bigJson, (req, res) => {
    const b = req.body || {};
    const existing = q.businessOf.get(req.user.id);
    if (existing && existing.status !== "rejected") throw httpError(409, "Your business has already been submitted");
    const s = (v, max = 200) => String(v == null ? "" : v).trim().slice(0, max);
    const f = {
      legalName: s(b.legalName), businessType: s(b.businessType, 80), sector: s(b.sector, 80), tin: s(b.tin, 10), licenseNo: s(b.licenseNo, 60),
      city: s(b.city, 80), contactPerson: s(b.contactPerson, 120), phone: s(b.phone, 20), email: s(b.email, 120),
    };
    const missing = [];
    if (!f.legalName) missing.push("business name");
    if (!f.businessType) missing.push("business type");
    if (!/^\d{10}$/.test(f.tin)) missing.push("10-digit TIN");
    if (!f.licenseNo) missing.push("trade license number");
    if (!f.contactPerson) missing.push("contact person");
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) missing.push("valid email");
    if (b.consent !== true) missing.push("consent");
    const docs = b.documents || {};
    for (const k of DOC_KINDS) if (!docs[k] || !docs[k].dataUrl) missing.push(`${k} document`);
    if (missing.length) throw httpError(400, "Missing: " + missing.join(", "));

    // Decode and store documents with random names outside the web root.
    fs.mkdirSync(uploadDir, { recursive: true });
    const stored = {};
    for (const k of DOC_KINDS) {
      const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(docs[k].dataUrl);
      const ext = m && DOC_TYPES[m[1]];
      if (!ext) throw httpError(400, `The ${k} document must be a PDF, JPG or PNG`);
      const buf = Buffer.from(m[2], "base64");
      if (!buf.length || buf.length > MAX_DOC_BYTES) throw httpError(400, `The ${k} document must be under 5 MB`);
      const name = `${crypto.randomUUID()}.${ext}`;
      fs.writeFileSync(path.join(uploadDir, name), buf, { mode: 0o600 });
      stored[k] = { file: name, original: s(docs[k].name, 120), type: m[1], bytes: buf.length };
    }
    tx(db, () => {
      if (existing) db.prepare("DELETE FROM businesses WHERE id = ?").run(existing.id);
      db.prepare(`INSERT INTO businesses (user_id, legal_name, business_type, sector, tin, license_no, city, contact_person, phone, email, documents, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'review')`).run(req.user.id, f.legalName, f.businessType, f.sector || null, f.tin, f.licenseNo,
        f.city || null, f.contactPerson, f.phone || null, f.email || null, JSON.stringify(stored));
      q.msg.run(req.user.id, "Verification submitted", `We are checking ${f.legalName}. You'll get a message when it's reviewed.`, "Business", "shield");
    });
    res.status(201).json({ business: { status: "review", legalName: f.legalName, tin: f.tin } });
  });

  app.post("/api/business/leads", requireUser, smallJson, (req, res) => {
    const biz = q.businessOf.get(req.user.id);
    if (!biz || biz.status !== "verified") throw httpError(403, "Verify your business first");
    const b = req.body || {};
    const names = new Set(AD_FORMATS.map((x) => x.name));
    const formats = (Array.isArray(b.formats) ? b.formats : []).filter((x) => names.has(x));
    if (!formats.length) throw httpError(400, "Choose at least one ad format");
    const areas = (Array.isArray(b.areas) ? b.areas : []).map((x) => String(x).slice(0, 60)).slice(0, 20);
    const contactBy = ["Call", "SMS", "Email"].includes(b.contactBy) ? b.contactBy : "Call";
    const ref = "ADV-" + String(crypto.randomInt(0, 1e6)).padStart(6, "0");
    db.prepare("INSERT INTO leads (ref, business_id, formats, areas, budget, start_date, contact_by, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(ref, biz.id, JSON.stringify(formats), JSON.stringify(areas), String(b.budget || "").slice(0, 60) || null,
        /^\d{4}-\d{2}-\d{2}$/.test(b.startDate || "") ? b.startDate : null, contactBy, String(b.message || "").slice(0, 2000) || null);
    res.status(201).json({ ref });
  });

  // ---------- admin (KYC review, refunds) ----------
  app.get("/api/admin/businesses", requireAdmin, (req, res) => {
    const st = ["review", "verified", "rejected"].includes(req.query.status) ? req.query.status : "review";
    const rows = db.prepare("SELECT b.*, u.msisdn FROM businesses b JOIN users u ON u.id = b.user_id WHERE b.status = ? ORDER BY submitted_at").all(st);
    res.json({ businesses: rows.map((r) => ({ ...r, documents: JSON.parse(r.documents) })) });
  });
  app.get("/api/admin/businesses/:id/documents/:kind", requireAdmin, (req, res) => {
    const b = db.prepare("SELECT documents FROM businesses WHERE id = ?").get(Number(req.params.id));
    const d = b && JSON.parse(b.documents)[req.params.kind];
    if (!d) throw httpError(404, "Not found");
    res.setHeader("Content-Type", d.type);
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.kind}-${req.params.id}.${d.file.split(".").pop()}"`);
    res.sendFile(path.join(uploadDir, path.basename(d.file)));
  });
  app.post("/api/admin/businesses/:id/decision", requireAdmin, smallJson, (req, res) => {
    const decision = req.body && req.body.decision;
    if (!["verified", "rejected"].includes(decision)) throw httpError(400, "decision must be verified or rejected");
    const b = db.prepare("SELECT * FROM businesses WHERE id = ?").get(Number(req.params.id));
    if (!b) throw httpError(404, "Not found");
    const note = String((req.body && req.body.note) || "").slice(0, 500) || null;
    db.prepare("UPDATE businesses SET status = ?, review_note = ?, reviewed_at = datetime('now') WHERE id = ?").run(decision, note, b.id);
    q.msg.run(b.user_id, decision === "verified" ? "Business verified" : "Verification not approved",
      decision === "verified" ? `${b.legal_name} is verified. You can now contact our sales team.` : `${b.legal_name} could not be verified${note ? ": " + note : ""}. You can correct and resubmit.`,
      "Business", "shield");
    res.json({ ok: true });
  });
  app.get("/api/admin/leads", requireAdmin, (_req, res) => {
    res.json({ leads: db.prepare("SELECT l.*, b.legal_name, b.contact_person, b.phone, b.email FROM leads l JOIN businesses b ON b.id = l.business_id ORDER BY l.created_at DESC").all() });
  });
  app.post("/api/admin/orders/:id/refund", requireAdmin, smallJson, asyncH(async (req, res) => {
    const o = orders.getByMerchId(req.params.id);
    if (!o) throw httpError(404, "Order not found");
    res.json(await orders.refund(o, { amount: req.body && req.body.amount, reason: req.body && req.body.reason }));
  }));
  app.post("/api/admin/orders/:id/reconcile", requireAdmin, asyncH(async (req, res) => {
    const o = orders.getByMerchId(req.params.id);
    if (!o) throw httpError(404, "Order not found");
    const r = await orders.reconcile(o);
    res.json({ ok: r.ok, reason: r.reason || null, order: r.order ? orderView(r.order) : null });
  }));

  // ---------- local development only ----------
  if (telebirr.mode === "mock") {
    // Stands in for telebirr's checkout: marks the order paid and sends the notification.
    app.post("/api/dev/pay/:id", requireUser, asyncH(async (req, res) => {
      const o = orders.getByMerchId(req.params.id);
      if (!o || o.user_id !== req.user.id) throw httpError(404, "Order not found");
      const body = telebirr._pay(o.merch_order_id);
      await orders.handleNotify(body);
      res.json({ resultCode: "1" });
    }));
  }

  if (cfg.serveMiniapp) {
    app.use(express.static(path.resolve(__dirname, "../../miniapp"), { index: "index.html" }));
  }

  app.use("/api", (_req, _res, next) => next(httpError(404, "Not found")));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === "entity.too.large" ? 413 : err.type === "entity.parse.failed" ? 400 : 500);
    if (status >= 500) log.error(err.stack || err.message);
    res.status(status).json({ error: status >= 500 && !err.status ? "Something went wrong" : err.message, code: err.code || null });
  });

  return { app, db, telebirr, sms, orders };
}

module.exports = { createApp, normMsisdn };
