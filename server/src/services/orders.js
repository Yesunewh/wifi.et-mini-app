"use strict";
/**
 * Order lifecycle:
 *   CREATED → PAYING (preOrder done, rawRequest handed to the app)
 *           → PAID (telebirr confirmed) → FULFILLING → FULFILLED (voucher issued, SMS sent)
 *           → FAILED (payment failed/closed) | REFUNDED
 *
 * A payment is only accepted after it is confirmed: either the notification carries a
 * valid telebirr signature, or (when telebirr's public key is not configured) the order
 * is re-checked with queryOrder. The amount must match the catalogue price. Each order
 * gets exactly one voucher, however many notifications arrive.
 */
const crypto = require("node:crypto");
const { packageById } = require("../catalog");
const { maskMsisdn } = require("../adapters/sms");

const PAID_STATUSES = new Set(["PAY_SUCCESS", "Completed", "COMPLETED", "SUCCESS"]);
const FAILED_STATUSES = new Set(["PAY_FAILED", "ORDER_CLOSED", "Failure", "Expired", "FAILED", "EXPIRED"]);

function newMerchOrderId() {
  // letters and digits only, <= 64 chars
  return "WF" + Date.now() + String(crypto.randomInt(0, 1e6)).padStart(6, "0");
}

const sameAmount = (a, b) => Math.round(Number(a) * 100) === Math.round(Number(b) * 100);

function createOrderService({ db, cfg, telebirr, wifi, sms, log = console }) {
  const q = {
    insert: db.prepare("INSERT INTO orders (merch_order_id, user_id, package_id, amount, recipient_msisdn, status) VALUES (?, ?, ?, ?, ?, 'CREATED')"),
    byMerch: db.prepare("SELECT * FROM orders WHERE merch_order_id = ?"),
    setPaying: db.prepare("UPDATE orders SET status='PAYING', prepay_id=?, updated_at=datetime('now') WHERE id=?"),
    setFailed: db.prepare("UPDATE orders SET status='FAILED', error=?, updated_at=datetime('now') WHERE id=? AND status IN ('CREATED','PAYING')"),
    markPaid: db.prepare("UPDATE orders SET status='PAID', payment_order_id=?, trans_id=?, paid_at=datetime('now'), error=NULL, updated_at=datetime('now') WHERE id=? AND status IN ('CREATED','PAYING','FAILED')"),
    claim: db.prepare("UPDATE orders SET status='FULFILLING', updated_at=datetime('now') WHERE id=? AND status='PAID'"),
    fulfilled: db.prepare("UPDATE orders SET status='FULFILLED', voucher_code=?, voucher_ref=?, fulfilled_at=datetime('now'), error=NULL, updated_at=datetime('now') WHERE id=?"),
    unclaim: db.prepare("UPDATE orders SET status='PAID', error=?, updated_at=datetime('now') WHERE id=? AND status='FULFILLING'"),
    event: db.prepare("INSERT INTO payment_events (merch_order_id, source, signature_valid, body) VALUES (?, ?, ?, ?)"),
    user: db.prepare("SELECT * FROM users WHERE id = ?"),
    msg: db.prepare("INSERT INTO messages (user_id, title, body, tag, icon) VALUES (?, ?, ?, ?, ?)"),
  };

  async function createOrder(user, packageId, { recipientMsisdn } = {}) {
    const pkg = packageById(packageId);
    if (!pkg) throw Object.assign(new Error("Unknown package"), { status: 400 });
    const to = recipientMsisdn || user.msisdn;
    if (!to) throw Object.assign(new Error("A phone number is needed to send the Wi-Fi code"), { status: 400, code: "MSISDN_REQUIRED" });
    const merchOrderId = newMerchOrderId();
    const { lastInsertRowid } = q.insert.run(merchOrderId, user.id, pkg.id, String(pkg.price), to);
    try {
      const { prepayId } = await telebirr.preOrder({
        merchOrderId, title: `wifiet ${pkg.name.replace("Wi-Fi ", "")}`, amount: pkg.price,
        notifyUrl: `${cfg.publicBaseUrl}/api/payment/notify`,
      });
      q.setPaying.run(prepayId, lastInsertRowid);
      return { orderId: merchOrderId, rawRequest: telebirr.buildRawRequest(prepayId), amount: pkg.price, package: pkg };
    } catch (e) {
      q.setFailed.run(String(e.message).slice(0, 300), lastInsertRowid);
      log.error(`[orders] preOrder failed for ${merchOrderId}: ${e.message}`);
      throw Object.assign(new Error("Could not start the payment. Please try again."), { status: 502 });
    }
  }

  async function fulfil(order) {
    if (q.claim.run(order.id).changes !== 1) return q.byMerch.get(order.merch_order_id); // someone else has it, or already done
    const pkg = packageById(order.package_id);
    try {
      const v = await wifi.issueVoucher({ orderRef: order.merch_order_id, msisdn: order.recipient_msisdn, pkg });
      q.fulfilled.run(v.code, v.ref || null, order.id);
      q.msg.run(order.user_id, "Payment successful", `${pkg.name} bought for ${pkg.price} ETB. Your Wi-Fi code is ${v.code}.`, "Package", "check");
      try {
        await sms.send(order.recipient_msisdn, `wifi.et: your ${pkg.name} code is ${v.code}. Valid ${pkg.validity} from first login at any wifi.et hotspot.`);
      } catch (e) { log.error(`[orders] SMS to ${maskMsisdn(order.recipient_msisdn)} failed: ${e.message}`); }
    } catch (e) {
      q.unclaim.run(`voucher: ${String(e.message).slice(0, 250)}`, order.id);
      log.error(`[orders] voucher for ${order.merch_order_id} failed: ${e.message}`);
    }
    return q.byMerch.get(order.merch_order_id);
  }

  /** Accept a confirmed payment for an order and fulfil it. */
  async function acceptPayment(order, { paymentOrderId, transId, amount }) {
    if (!sameAmount(amount, order.amount)) {
      log.error(`[orders] amount mismatch on ${order.merch_order_id}: paid ${amount}, expected ${order.amount}`);
      return { ok: false, reason: "amount_mismatch" };
    }
    q.markPaid.run(paymentOrderId || null, transId || null, order.id);
    const updated = q.byMerch.get(order.merch_order_id);
    if (updated.status === "PAID") return { ok: true, order: await fulfil(updated) };
    return { ok: true, order: updated };
  }

  /** Handle telebirr's payment notification (POST to notify_url). */
  async function handleNotify(body) {
    const merchOrderId = body && body.merch_order_id;
    const sig = telebirr.verifyNotification(body);
    q.event.run(merchOrderId || null, "notify", sig === null ? null : sig ? 1 : 0, JSON.stringify(body || {}));
    if (!merchOrderId) return { ok: false, reason: "missing_order_id" };
    if (sig === false) { log.warn(`[orders] notify for ${merchOrderId}: invalid signature, ignored`); return { ok: false, reason: "bad_signature" }; }
    const order = q.byMerch.get(merchOrderId);
    if (!order) return { ok: false, reason: "unknown_order" };
    if (["FULFILLED", "FULFILLING", "REFUNDED"].includes(order.status)) return { ok: true, order };

    if (sig === true && body.appid === cfg.telebirr.merchantAppId && PAID_STATUSES.has(body.trade_status)) {
      return acceptPayment(order, { paymentOrderId: body.payment_order_id, transId: body.trans_id, amount: body.total_amount });
    }
    // No signature check possible (or status not final): confirm with telebirr directly.
    return reconcile(order);
  }

  /** Ask telebirr for the order status and act on it. */
  async function reconcile(order) {
    let r;
    try { r = await telebirr.queryOrder(order.merch_order_id); }
    catch (e) { log.error(`[orders] queryOrder ${order.merch_order_id}: ${e.message}`); return { ok: false, reason: "query_failed", order }; }
    q.event.run(order.merch_order_id, "query", null, JSON.stringify(r));
    if (PAID_STATUSES.has(r.status)) {
      return acceptPayment(order, { paymentOrderId: r.paymentOrderId, transId: r.transId, amount: r.totalAmount ?? order.amount });
    }
    if (FAILED_STATUSES.has(r.status)) q.setFailed.run(`telebirr: ${r.status}`, order.id);
    return { ok: true, order: q.byMerch.get(order.merch_order_id) };
  }

  /** Called when the app polls an order: settles it if the notification has not arrived. */
  async function refresh(order) {
    if (order.status === "PAID") return fulfil(order);
    if (order.status === "PAYING") {
      const ageS = (Date.now() - Date.parse(order.created_at.replace(" ", "T") + "Z")) / 1000;
      if (ageS >= 3) return (await reconcile(order)).order || q.byMerch.get(order.merch_order_id);
    }
    return order;
  }

  async function refund(order, { amount, reason }) {
    if (!["FULFILLED", "PAID"].includes(order.status)) throw Object.assign(new Error(`Order is ${order.status}`), { status: 409 });
    const r = await telebirr.refund({ merchOrderId: order.merch_order_id, refundRequestNo: order.trans_id || ("R" + order.merch_order_id), amount: amount || order.amount, reason });
    if (r.status === "REFUND_SUCCESS" || r.status === "REFUNDING") {
      db.prepare("UPDATE orders SET status='REFUNDED', updated_at=datetime('now') WHERE id=?").run(order.id);
    }
    return r;
  }

  return { createOrder, handleNotify, reconcile, refresh, refund, getByMerchId: (id) => q.byMerch.get(id) };
}

module.exports = { createOrderService, newMerchOrderId, sameAmount };
