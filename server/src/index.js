"use strict";
const path = require("node:path");
const { loadDotEnv, buildConfig, validateConfig } = require("./config");

loadDotEnv(path.resolve(__dirname, "../.env"));
const cfg = buildConfig();
const errors = validateConfig(cfg);
if (errors.length) {
  console.error("Configuration problems:\n - " + errors.join("\n - "));
  process.exit(1);
}

const { createApp } = require("./app");
const { app } = createApp(cfg);
app.listen(cfg.port, cfg.host, () => {
  console.log(`wifi.et server on ${cfg.host}:${cfg.port} · telebirr ${cfg.telebirr.mode} · wifi ${cfg.wifi.adapter} · sms ${cfg.sms.adapter}`);
  console.log(`notify_url = ${cfg.publicBaseUrl}/api/payment/notify`);
  if (cfg.telebirr.mode !== "mock" && !cfg.telebirr.publicKey) {
    console.log("telebirr public key not set: payments are confirmed with queryOrder before a code is issued.");
  }
});
