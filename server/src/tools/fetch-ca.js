"use strict";
/**
 * Fixes "unable to verify the first certificate" for the telebirr gateway.
 *
 * That error means the gateway sends its own certificate without the intermediate
 * certificate that links it to a trusted root. This tool reads the gateway's
 * certificate, downloads the missing intermediate from the address the certificate
 * itself names (its "CA Issuers" link), checks that it really signed the gateway
 * certificate, and saves it to keys/telebirr_ca.pem. Certificate checks stay ON:
 * the server then verifies the full chain against the normal trusted roots.
 *
 * Run from server/:  npm run fetch-ca            (sandbox)
 *                    npm run fetch-ca -- production
 */
const tls = require("node:tls");
const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { loadDotEnv, buildConfig } = require("../config");

loadDotEnv(path.resolve(__dirname, "../../.env"));
const which = process.argv[2] === "production" ? "production" : "sandbox";
const cfg = buildConfig({ ...process.env, TELEBIRR_MODE: which });
const u = new URL(cfg.telebirr.baseUrl);
const out = path.resolve(__dirname, "../../keys/telebirr_ca.pem");

function peerCert() {
  return new Promise((resolve, reject) => {
    // Only reads the certificate the server presents; nothing is sent over this connection.
    const s = tls.connect({ host: u.hostname, port: Number(u.port || 443), servername: u.hostname, rejectUnauthorized: false }, () => {
      const c = s.getPeerCertificate(true); s.end(); resolve(c);
    });
    s.setTimeout(15000, () => s.destroy(new Error("timeout")));
    s.on("error", reject);
  });
}

function download(url, depth = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && depth < 3) return resolve(download(new URL(res.headers.location, url).href, depth + 1));
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

const toPem = (buf) => {
  const t = buf.toString("latin1");
  if (t.includes("-----BEGIN CERTIFICATE-----")) return t.trim() + "\n";
  return "-----BEGIN CERTIFICATE-----\n" + buf.toString("base64").match(/.{1,64}/g).join("\n") + "\n-----END CERTIFICATE-----\n";
};

(async () => {
  console.log(`Gateway: ${u.hostname}:${u.port}`);
  const leaf = await peerCert();
  console.log(`  certificate for: ${leaf.subject && leaf.subject.CN}`);
  console.log(`  issued by:       ${leaf.issuer && (leaf.issuer.CN || leaf.issuer.O)}`);
  const leafX = new crypto.X509Certificate(leaf.raw);
  const aia = (leaf.infoAccess && leaf.infoAccess["CA Issuers - URI"]) || [];
  if (!aia.length) throw new Error("The certificate does not say where its issuer can be downloaded. Ask the telebirr team for their intermediate CA certificate and save it as keys/telebirr_ca.pem.");

  const pems = [];
  let child = leafX, url = aia[0];
  for (let i = 0; i < 3 && url; i++) {
    console.log(`  downloading issuer: ${url}`);
    const issuer = new crypto.X509Certificate(toPem(await download(url)));
    if (!child.verify(issuer.publicKey)) throw new Error("Downloaded certificate did not sign the gateway's certificate; not saving it.");
    pems.push(issuer.toString());
    console.log(`  verified: ${issuer.subject.split("\n").find((l) => l.startsWith("CN=")) || issuer.subject}`);
    // Stop once the chain reaches a certificate the system already trusts.
    const trusted = tls.rootCertificates.some((r) => { try { return issuer.verify(new crypto.X509Certificate(r).publicKey); } catch { return false; } });
    if (trusted) break;
    const next = (issuer.infoAccess || "").match(/CA Issuers - URI:(\S+)/);
    child = issuer; url = next && next[1];
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, pems.join(""));
  console.log(`\nSaved ${pems.length} certificate(s) to keys/telebirr_ca.pem.`);
  console.log("Add this line to server/.env (if it is not there):  TELEBIRR_CA_FILE=./keys/telebirr_ca.pem");
})().catch((e) => { console.error("FAILED: " + e.message); process.exit(1); });
