"use strict";
const fs = require("node:fs");
const path = require("node:path");

/** Load KEY=VALUE lines from server/.env into process.env (existing env wins). */
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const ROOT = path.resolve(__dirname, "..");

function readFileIf(p) {
  if (!p) return null;
  const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
}

function buildConfig(env = process.env) {
  const mode = (env.TELEBIRR_MODE || "mock").toLowerCase();
  if (!["mock", "sandbox", "production"].includes(mode)) {
    throw new Error(`TELEBIRR_MODE must be mock, sandbox or production (got "${mode}")`);
  }
  const cfg = {
    port: Number(env.PORT || 3000),
    publicBaseUrl: (env.PUBLIC_BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ""),
    serveMiniapp: String(env.SERVE_MINIAPP || "true") === "true",
    corsOrigins: (env.CORS_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean),
    dataDir: path.resolve(ROOT, env.DATA_DIR || "./data"),
    sessionSecret: env.SESSION_SECRET || "",
    adminToken: env.ADMIN_TOKEN || "",
    telebirr: {
      mode,
      baseUrl: mode === "production" ? env.TELEBIRR_BASE_URL_PRODUCTION : env.TELEBIRR_BASE_URL_SANDBOX,
      fabricAppId: env.TELEBIRR_FABRIC_APP_ID || "",
      appSecret: env.TELEBIRR_APP_SECRET || "",
      merchantAppId: env.TELEBIRR_MERCHANT_APP_ID || (mode === "mock" ? "MOCKAPPID0001" : ""),
      merchantCode: env.TELEBIRR_MERCHANT_CODE || (mode === "mock" ? "100100" : ""),
      privateKey: env.TELEBIRR_PRIVATE_KEY || readFileIf(env.TELEBIRR_PRIVATE_KEY_FILE),
      publicKey: env.TELEBIRR_PUBLIC_KEY || readFileIf(env.TELEBIRR_PUBLIC_KEY_FILE),
      signPadding: (env.TELEBIRR_SIGN_PADDING || "pss").toLowerCase(),
      ca: readFileIf(env.TELEBIRR_CA_FILE),
      orderTimeoutMin: Math.min(120, Math.max(1, Number(env.TELEBIRR_ORDER_TIMEOUT_MIN || 30))),
    },
    wifi: { adapter: env.WIFI_ADAPTER || "mock", url: env.WIFI_API_URL || "", key: env.WIFI_API_KEY || "" },
    sms: { adapter: env.SMS_ADAPTER || "mock", url: env.SMS_API_URL || "", key: env.SMS_API_KEY || "", sender: env.SMS_SENDER || "wifi.et" },
  };
  return cfg;
}

/** Refuse to start with settings that would be unsafe outside local testing. */
function validateConfig(cfg) {
  const errors = [];
  const live = cfg.telebirr.mode !== "mock";
  if (cfg.sessionSecret.length < 32) {
    if (live) errors.push("SESSION_SECRET must be at least 32 characters");
  }
  if (live) {
    const t = cfg.telebirr;
    for (const [k, v] of Object.entries({
      TELEBIRR_BASE_URL: t.baseUrl, TELEBIRR_FABRIC_APP_ID: t.fabricAppId, TELEBIRR_APP_SECRET: t.appSecret,
      TELEBIRR_MERCHANT_APP_ID: t.merchantAppId, TELEBIRR_MERCHANT_CODE: t.merchantCode,
      "TELEBIRR_PRIVATE_KEY(_FILE)": t.privateKey,
    })) if (!v) errors.push(`${k} is required when TELEBIRR_MODE=${t.mode}`);
    if (t.mode === "production" && !/^https:\/\//.test(cfg.publicBaseUrl)) errors.push("PUBLIC_BASE_URL must be https:// in production");
  }
  if (cfg.adminToken && cfg.adminToken.length < 24) errors.push("ADMIN_TOKEN must be at least 24 characters (or empty to disable admin endpoints)");
  return errors;
}

module.exports = { loadDotEnv, buildConfig, validateConfig, ROOT };
