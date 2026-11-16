"use strict";
/**
 * Generates a new 2048-bit RSA key pair for request signing:
 *   keys/merchant_private.pem  (keep secret, never commit)
 *   keys/merchant_public.pem   (give to ethio telecom / telebirr)
 * Refuses to overwrite an existing private key.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const dir = path.resolve(__dirname, "../../keys");
const priv = path.join(dir, "merchant_private.pem");
if (fs.existsSync(priv)) { console.error(`${priv} already exists; move it away first.`); process.exit(1); }
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
fs.writeFileSync(priv, privateKey, { mode: 0o600 });
fs.writeFileSync(path.join(dir, "merchant_public.pem"), publicKey);
console.log("Wrote keys/merchant_private.pem (secret) and keys/merchant_public.pem (share with telebirr).");
