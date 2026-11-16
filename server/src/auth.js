"use strict";
/** Minimal signed session tokens (HMAC-SHA256) for the mini app. */
const crypto = require("node:crypto");

const b64u = (buf) => Buffer.from(buf).toString("base64url");

function createSessions(secret, { ttlSeconds = 7 * 24 * 3600 } = {}) {
  if (!secret) throw new Error("Session secret missing");
  const mac = (s) => crypto.createHmac("sha256", secret).update(s).digest("base64url");
  return {
    issue(userId) {
      const payload = b64u(JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
      return `${payload}.${mac(payload)}`;
    },
    verify(token) {
      if (typeof token !== "string" || !token.includes(".")) return null;
      const [payload, sig] = token.split(".");
      const expect = mac(payload);
      if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
      try {
        const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        if (!data.uid || data.exp < Math.floor(Date.now() / 1000)) return null;
        return data;
      } catch { return null; }
    },
  };
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

module.exports = { createSessions, safeEqual };
