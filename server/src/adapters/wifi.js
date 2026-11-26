"use strict";
/**
 * Wi-Fi platform adapter: issues the voucher code after payment, and logs a pass in
 * when the customer scans a hotspot QR code.
 *
 * "mock" generates codes locally. "http" is a template for the real platform
 * (hotspot controller / RADIUS / captive portal). Its API is not known yet, so the
 * request shape below must be adapted once the platform team shares it.
 */
const crypto = require("node:crypto");
const { postJson } = require("../telebirr/http");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreads
function code(n) {
  const b = crypto.randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

function createWifiAdapter(cfg, { log = console } = {}) {
  if (cfg.wifi.adapter === "http") {
    if (!cfg.wifi.url) throw new Error("WIFI_API_URL is required when WIFI_ADAPTER=http");
    const headers = { Authorization: `Bearer ${cfg.wifi.key}` };
    return {
      // TODO(platform team): confirm endpoint names and fields.
      async issueVoucher({ orderRef, msisdn, pkg }) {
        const r = await postJson(`${cfg.wifi.url}/vouchers`, {
          external_ref: orderRef, msisdn, data_mb: Math.round(pkg.gb * 1000), validity_hours: pkg.validityHours, plan: pkg.id,
        }, { headers });
        return { code: r.code, ref: r.id };
      },
      async connect({ voucherCode, hotspotId, msisdn }) {
        const r = await postJson(`${cfg.wifi.url}/sessions`, { code: voucherCode, hotspot_id: hotspotId, msisdn }, { headers });
        return { ok: !!r.ok, hotspotId, message: r.message || null };
      },
    };
  }
  return {
    async issueVoucher({ orderRef }) {
      const c = `WF-${code(4)}-${code(4)}`;
      log.info(`[wifi:mock] voucher ${c} for ${orderRef}`);
      return { code: c, ref: "mock-" + orderRef };
    },
    async connect({ hotspotId }) { return { ok: true, hotspotId, message: null }; },
  };
}

module.exports = { createWifiAdapter };
