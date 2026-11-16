"use strict";
const https = require("node:https");
const http = require("node:http");

/**
 * POST JSON and parse the JSON reply. Uses node:https so a custom CA can be
 * supplied for the gateway (TELEBIRR_CA_FILE). Certificate checks stay ON.
 */
function postJson(url, body, { headers = {}, ca = null, timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const data = Buffer.from(JSON.stringify(body));
    const req = lib.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        headers: { "Content-Type": "application/json", "Content-Length": data.length, ...headers },
        ...(ca ? { ca } : {}),
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json;
          try { json = JSON.parse(text); } catch {
            return reject(Object.assign(new Error(`Gateway returned non-JSON (HTTP ${res.statusCode})`), { status: res.statusCode, body: text.slice(0, 500) }));
          }
          if (res.statusCode >= 400) {
            return reject(Object.assign(new Error(`Gateway HTTP ${res.statusCode}`), { status: res.statusCode, body: json }));
          }
          resolve(json);
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Gateway request timed out")));
    req.on("error", reject);
    req.end(data);
  });
}

module.exports = { postJson };
