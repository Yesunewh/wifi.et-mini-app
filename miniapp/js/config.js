/* wifi.et mini app settings. No secrets here: everything in this folder ships to phones. */
window.WIFIET_CONFIG = {
  // Base URL of the wifi.et API. Empty = same origin (when the server also serves this folder).
  // For the packaged mini app, set the public HTTPS address, e.g. "https://api.wifi.et".
  apiBase: "",
  // Merchant app id (appid) used by ma.native("getMiniAppToken"). Not a secret.
  merchantAppId: "1363951498188808",
  // Name of the SuperApp's QR-scan API, once confirmed with the platform team (e.g. "scanCode").
  // While null, customers type the short code printed on the hotspot sticker instead.
  scanMethod: null,
};
