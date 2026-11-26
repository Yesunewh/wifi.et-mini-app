// wifi.et mini app settings. No secrets here: this file ships to phones.
module.exports = {
  // Address of the wifi.et server (the server/ folder of the repository).
  // Simulator on this computer: http://localhost:3100 (deployed test server below)
  // Real phones: the public HTTPS address, e.g. https://api.wifi.et
  apiBase: "https://mini-app-test.wifi.et",
  // Merchant app id (appid) used to get the telebirr access token. Not a secret.
  merchantAppId: "1363951498188808",
  // Used only when the server runs in mock mode and telebirr login is not available (simulator).
  devMsisdn: "251912345678",
};
