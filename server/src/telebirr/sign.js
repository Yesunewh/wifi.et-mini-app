"use strict";
/**
 * telebirr SuperApp request signing.
 *
 * Rule from the developer portal ("RequestSignatureProcess"):
 *  1. take every request parameter except `sign` and `sign_type`;
 *     the fields inside `biz_content` are flattened into the same list;
 *  2. write each as key=value, sort by key (A-z) and join with "&";
 *  3. sign that string with the merchant RSA private key (SHA-256);
 *  4. send the base64 signature as `sign` and "SHA256WithRSA" as `sign_type`.
 *
 * The portal's sample code uses jsrsasign "SHA256withRSAandMGF1", which is RSA-PSS
 * with a salt as long as the hash (32 bytes). That is the default here; set
 * TELEBIRR_SIGN_PADDING=pkcs1 if the gateway expects classic PKCS#1 v1.5.
 */
const crypto = require("node:crypto");

const EXCLUDED = new Set(["sign", "sign_type", "biz_content"]);

function buildSignString(params) {
  const flat = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (EXCLUDED.has(k)) continue;
    flat[k] = v;
  }
  const biz = params && params.biz_content;
  if (biz && typeof biz === "object") {
    for (const [k, v] of Object.entries(biz)) flat[k] = v;
  }
  return Object.keys(flat)
    .filter((k) => flat[k] !== undefined && flat[k] !== null && flat[k] !== "")
    .sort()
    .map((k) => `${k}=${typeof flat[k] === "object" ? JSON.stringify(flat[k]) : flat[k]}`)
    .join("&");
}

/** Accept PEM, or bare base64 as produced by some key tools, for PKCS#8 / PKCS#1 private keys. */
function toPrivateKey(key) {
  if (!key) throw new Error("Merchant private key is not configured");
  if (typeof key === "object") return key;
  const k = key.trim();
  if (k.includes("-----BEGIN")) return crypto.createPrivateKey(k);
  const der = Buffer.from(k.replace(/\s+/g, ""), "base64");
  try { return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" }); }
  catch { return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs1" }); }
}

function toPublicKey(key) {
  if (!key) throw new Error("telebirr public key is not configured");
  if (typeof key === "object") return key;
  const k = key.trim();
  if (k.includes("-----BEGIN")) return crypto.createPublicKey(k);
  const der = Buffer.from(k.replace(/\s+/g, ""), "base64");
  try { return crypto.createPublicKey({ key: der, format: "der", type: "spki" }); }
  catch { return crypto.createPublicKey({ key: der, format: "der", type: "pkcs1" }); }
}

function paddingOpts(padding) {
  return padding === "pkcs1"
    ? { padding: crypto.constants.RSA_PKCS1_PADDING }
    : { padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST };
}

function signString(text, privateKey, padding = "pss") {
  return crypto.sign("sha256", Buffer.from(text, "utf8"), { key: toPrivateKey(privateKey), ...paddingOpts(padding) }).toString("base64");
}

function verifyString(text, signatureB64, publicKey, padding = "pss") {
  if (!signatureB64) return false;
  try {
    return crypto.verify("sha256", Buffer.from(text, "utf8"), { key: toPublicKey(publicKey), ...paddingOpts(padding) }, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

function signParams(params, privateKey, padding) {
  return signString(buildSignString(params), privateKey, padding);
}

/** Verify a signed object from telebirr (notification or API response). */
function verifyParams(params, publicKey, padding) {
  return verifyString(buildSignString(params), params && params.sign, publicKey, padding);
}

/** 32-character nonce: upper-case letters and digits only, as the gateway requires. */
function nonceStr(len = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

/** UTC timestamp in seconds, as a string. */
function timestamp(now = Date.now()) {
  return String(Math.floor(now / 1000));
}

module.exports = { buildSignString, signString, verifyString, signParams, verifyParams, nonceStr, timestamp, toPrivateKey, toPublicKey };
