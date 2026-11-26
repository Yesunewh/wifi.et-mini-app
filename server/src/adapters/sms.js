"use strict";
/**
 * SMS adapter. "mock" logs the message. "http" is a template for the ethio telecom
 * SMS gateway; adapt the request once its API is known.
 */
const { postJson } = require("../telebirr/http");

function maskMsisdn(m) {
  const s = String(m || "");
  return s.length > 6 ? s.slice(0, 4) + "•••" + s.slice(-3) : s;
}

function createSmsAdapter(cfg, { log = console } = {}) {
  if (cfg.sms.adapter === "http") {
    if (!cfg.sms.url) throw new Error("SMS_API_URL is required when SMS_ADAPTER=http");
    return {
      // TODO(SMS gateway): confirm endpoint and fields.
      async send(msisdn, text) {
        await postJson(cfg.sms.url, { from: cfg.sms.sender, to: msisdn, text }, { headers: { Authorization: `Bearer ${cfg.sms.key}` } });
        return true;
      },
    };
  }
  const outbox = [];
  return {
    outbox,
    async send(msisdn, text) {
      outbox.push({ msisdn, text, at: new Date().toISOString() });
      log.info(`[sms:mock] to ${maskMsisdn(msisdn)}: ${text}`);
      return true;
    },
  };
}

module.exports = { createSmsAdapter, maskMsisdn };
