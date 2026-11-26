// app.js: signs the customer in once and shares the session with every page.
const api = require("./utils/api");
const telebirr = require("./utils/telebirr");
const config = require("./utils/config");

App({
  globalData: { user: null, dev: false, packages: [], loginError: "" },
  _ready: null,

  onLaunch() { this.ready(); },

  // Resolves when the customer is signed in. Pages call getApp().ready().then(...).
  ready() {
    if (!this._ready) {
      this._ready = this._login().catch((e) => { this._ready = null; this.globalData.loginError = e.message; throw e; });
    }
    return this._ready;
  },

  _login() {
    const g = this.globalData;
    return api.health().then((h) => {
      g.dev = h.mode === "mock";
      return telebirr.getAccessToken().catch((e) => {
        // Simulator: telebirr login is not available. Allowed only against a mock-mode server.
        if (g.dev) return config.devMsisdn;
        throw new Error(e && e.unavailable ? "Open wifi.et from the telebirr app." : "Could not sign you in with telebirr. Please try again.");
      });
    }).then((accessToken) => api.login(accessToken)).then((r) => {
      api.setToken(r.token);
      g.user = r.user; g.loginError = "";
      return api.packages();
    }).then((p) => { g.packages = p.packages; return g.user; });
  },

  packageById(id) {
    const list = this.globalData.packages;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  },
});
