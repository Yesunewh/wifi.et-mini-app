"use strict";
/**
 * telebirr SuperApp payment gateway client (Mini App integration).
 * Endpoints and fields follow developer.ethiotelecom.et "Mini App Integration".
 */
const { postJson } = require("./http");
const { signParams, verifyParams, signString, buildSignString, nonceStr, timestamp } = require("./sign");

const PATHS = {
  token: "/payment/v1/token",
  authToken: "/payment/v1/auth/authToken",
  preOrder: "/payment/v1/merchant/preOrder",
  queryOrder: "/payment/v1/merchant/queryOrder",
  refund: "/payment/v1/merchant/refund",
};

/** Titles may not contain ~`!#$%^*()-+= and similar characters. */
function safeTitle(s) {
  return String(s).replace(/[~`!#$%^&*()\-+=|{}[\]:;"'<>,?/\\@]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function amountStr(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) throw new Error("Invalid amount");
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** "yyyyMMddHHmmss" → epoch ms (treated as UTC; only used with a safety margin). */
function parseGatewayDate(s) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s || "");
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

class GatewayError extends Error {
  constructor(message, details) { super(message); this.name = "GatewayError"; this.details = details; }
}

function createTelebirrClient(cfg, { log = console } = {}) {
  const t = cfg.telebirr;
  let cached = null; // { token, expiresAt }

  async function call(path, body, extraHeaders = {}) {
    return postJson(t.baseUrl + path, body, { headers: { "X-APP-Key": t.fabricAppId, ...extraHeaders }, ca: t.ca });
  }

  function checkResult(res, what) {
    if (!res || res.result !== "SUCCESS" || String(res.code) !== "0") {
      throw new GatewayError(`${what} failed: ${res && (res.msg || res.errorMsg || res.code) || "no response"}`, res);
    }
    // Response signatures are checked when telebirr's public key is configured.
    if (t.publicKey && res.sign && !verifyParams(res, t.publicKey, t.signPadding)) {
      log.warn(`[telebirr] ${what}: response signature did not verify`);
    }
    return res;
  }

  /** Step 1: fabric token, cached until shortly before it expires (max 50 min). */
  async function getFabricToken() {
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    const res = await call(PATHS.token, { appSecret: t.appSecret });
    if (!res || !res.token) throw new GatewayError("Fabric token request failed", res);
    const exp = parseGatewayDate(res.expirationDate);
    const cap = Date.now() + 50 * 60 * 1000;
    cached = { token: res.token, expiresAt: Math.min(cap, exp ? exp - 5 * 60 * 1000 : cap) };
    if (cached.expiresAt <= Date.now()) cached.expiresAt = Date.now() + 5 * 60 * 1000;
    return cached.token;
  }

  function signed(method, biz) {
    const req = { timestamp: timestamp(), nonce_str: nonceStr(), method, version: "1.0", biz_content: biz };
    req.sign = signParams(req, t.privateKey, t.signPadding);
    req.sign_type = "SHA256WithRSA";
    return req;
  }

  async function authed(path, method, biz, what) {
    const token = await getFabricToken();
    const res = await call(path, signed(method, biz), { Authorization: token });
    return checkResult(res, what);
  }

  return {
    mode: t.mode,

    getFabricToken,

    /** Step 2: exchange the mini app access_token (from ma.native("getMiniAppToken")) for the customer's identity. */
    async authToken(accessToken) {
      const res = await authed(PATHS.authToken, "payment.authtoken", {
        access_token: accessToken, trade_type: "InApp", appid: t.merchantAppId, resource_type: "OpenId",
      }, "authToken");
      const b = res.biz_content || {};
      return {
        openId: b.open_id || null,
        msisdn: b.identifier || null, // only returned when the merchant code is whitelisted
        nickName: b.nickName || null,
        identityId: b.identityId || null,
      };
    },

    /** Step 3: create the prepaid order. Returns prepay_id. */
    async preOrder({ merchOrderId, title, amount, notifyUrl, redirectUrl }) {
      const biz = {
        notify_url: notifyUrl,
        appid: t.merchantAppId,
        merch_code: t.merchantCode,
        merch_order_id: merchOrderId,
        trade_type: "InApp",
        title: safeTitle(title),
        total_amount: amountStr(amount),
        trans_currency: "ETB",
        timeout_express: `${t.orderTimeoutMin}m`,
        business_type: "BuyGoods",
        // Required in practice: without these the sandbox answers 60000005.
        payee_identifier: t.merchantCode,
        payee_identifier_type: "04", // paid to a short code
        payee_type: "5000",
      };
      if (redirectUrl) biz.redirect_url = redirectUrl;
      const res = await authed(PATHS.preOrder, "payment.preorder", biz, "preOrder");
      const prepayId = res.biz_content && res.biz_content.prepay_id;
      if (!prepayId) throw new GatewayError("preOrder returned no prepay_id", res);
      return { prepayId };
    },

    /** The signed string the mini app passes to ma.native("startPay", { rawRequest }). */
    buildRawRequest(prepayId) {
      const map = { appid: t.merchantAppId, merch_code: t.merchantCode, nonce_str: nonceStr(), prepay_id: prepayId, timestamp: timestamp() };
      const sign = signString(buildSignString(map), t.privateKey, t.signPadding);
      return [
        `appid=${map.appid}`, `merch_code=${map.merch_code}`, `nonce_str=${map.nonce_str}`,
        `prepay_id=${map.prepay_id}`, `timestamp=${map.timestamp}`, `sign=${sign}`, "sign_type=SHA256WithRSA",
      ].join("&");
    },

    /** Step 5: ask telebirr for the order's status. */
    async queryOrder(merchOrderId) {
      const res = await authed(PATHS.queryOrder, "payment.queryorder", {
        appid: t.merchantAppId, merch_code: t.merchantCode, merch_order_id: merchOrderId,
      }, "queryOrder");
      const b = res.biz_content || {};
      return {
        status: b.order_status || b.trade_status || null, // PAY_SUCCESS, WAIT_PAY, PAYING, PAY_FAILED, ORDER_CLOSED, ...
        paymentOrderId: b.payment_order_id || null,
        transId: b.trans_id || null,
        totalAmount: b.total_amount || null,
        currency: b.trans_currency || null,
      };
    },

    /** Step 8: refund (full or partial). */
    async refund({ merchOrderId, refundRequestNo, amount, reason }) {
      const res = await authed(PATHS.refund, "payment.refund", {
        appid: t.merchantAppId, merch_code: t.merchantCode, merch_order_id: merchOrderId,
        refund_request_no: refundRequestNo, refund_reason: reason || "Customer refund",
        actual_amount: amountStr(amount), trans_currency: "ETB",
      }, "refund");
      const b = res.biz_content || {};
      return { status: b.refund_status || null, refundOrderId: b.refund_order_id || null, raw: b };
    },

    /** Verify the signature on a payment notification (only possible with telebirr's public key). */
    verifyNotification(body) {
      if (!t.publicKey) return null; // unknown: caller must confirm with queryOrder
      return verifyParams(body, t.publicKey, t.signPadding);
    },
  };
}

module.exports = { createTelebirrClient, GatewayError, safeTitle, amountStr, parseGatewayDate, PATHS };
