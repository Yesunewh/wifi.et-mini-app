"use strict";
/**
 * Stand-in for the telebirr gateway when TELEBIRR_MODE=mock (local development and tests).
 * Same interface as client.js. Nothing leaves the machine.
 */
const crypto = require("node:crypto");

function createMockTelebirr() {
  const orders = new Map(); // merchOrderId -> { amount, status, paymentOrderId, transId }
  return {
    mode: "mock",
    async getFabricToken() { return "Bearer mock-token"; },
    async authToken(accessToken) {
      // In mock mode the "access token" is a phone number (or anything) chosen by the dev login.
      const msisdn = /^\+?251\d{9}$/.test(accessToken || "") ? accessToken.replace(/^\+/, "") : "251912345678";
      return { openId: "mock-" + crypto.createHash("sha256").update(msisdn).digest("hex").slice(0, 16), msisdn, nickName: "Abebe", identityId: null };
    },
    async preOrder({ merchOrderId, amount }) {
      const prepayId = "MOCK" + crypto.randomBytes(12).toString("hex");
      orders.set(merchOrderId, { amount: String(amount), status: "WAIT_PAY", prepayId });
      return { prepayId };
    },
    buildRawRequest(prepayId) { return `appid=MOCK&merch_code=MOCK&nonce_str=MOCK&prepay_id=${prepayId}&timestamp=${Math.floor(Date.now() / 1000)}&sign=MOCK&sign_type=SHA256WithRSA`; },
    async queryOrder(merchOrderId) {
      const o = orders.get(merchOrderId);
      if (!o) return { status: "ORDER_CLOSED", paymentOrderId: null, transId: null, totalAmount: null, currency: "ETB" };
      return { status: o.status, paymentOrderId: o.paymentOrderId || null, transId: o.transId || null, totalAmount: o.amount, currency: "ETB" };
    },
    async refund({ merchOrderId }) {
      const o = orders.get(merchOrderId);
      if (o) o.status = "REFUND_SUCCESS";
      return { status: "REFUND_SUCCESS", refundOrderId: "MOCKREF" + Date.now(), raw: {} };
    },
    verifyNotification() { return null; },
    /** Test helper: mark an order paid the way telebirr would, returning the notification body. */
    _pay(merchOrderId) {
      const o = orders.get(merchOrderId);
      if (!o) return null;
      o.status = "PAY_SUCCESS";
      o.paymentOrderId = "MOCKPAY" + crypto.randomBytes(8).toString("hex").toUpperCase();
      o.transId = "MOCK" + crypto.randomBytes(5).toString("hex").toUpperCase();
      return {
        appid: "MOCK", merch_code: "MOCK", merch_order_id: merchOrderId, payment_order_id: o.paymentOrderId,
        trans_id: o.transId, total_amount: Number(o.amount).toFixed(2), trans_currency: "ETB", trade_status: "Completed",
        trans_end_time: String(Date.now()), notify_time: String(Date.now()), sign: "MOCK", sign_type: "SHA256WithRSA",
      };
    },
  };
}

module.exports = { createMockTelebirr };
