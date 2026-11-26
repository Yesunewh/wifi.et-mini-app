const api = require("../../utils/api");
const f = require("../../utils/format");
const app = getApp();

Page({
  data: { tab: "Active", active: [], history: [], spentTxt: "0", open: "", loaded: false, sheet: "", sticker: "", error: "" },
  connectFor: "",

  onShow() { app.ready().then(() => this.load()).catch(() => {}); },
  onPullDownRefresh() { this.load().then(() => ma.stopPullDownRefresh()); },

  load() {
    return api.passes().then((r) => {
      let last = "";
      const history = r.history.map(f.passView).map((p) => { const showMonth = p.month !== last; last = p.month; return Object.assign(p, { showMonth }); });
      const spent = r.history.filter((p) => p.state !== "refunded").reduce((a, p) => a + p.price, 0);
      this.setData({ active: r.active.map(f.passView), history, spentTxt: f.money(spent), loaded: true });
    }).catch((e) => ma.showToast({ title: e.message, icon: "none" }));
  },

  setTab(e) { this.setData({ tab: e.currentTarget.dataset.t }); },
  toggle(e) { const id = e.currentTarget.dataset.id; this.setData({ open: this.data.open === id ? "" : id }); },
  goHome() { ma.switchTab({ url: "/pages/home/index" }); },
  copy(e) { ma.setClipboardData({ data: e.currentTarget.dataset.code, success: () => ma.showToast({ title: "Code copied" }) }); },
  noop() {},
  closeSheet() { this.setData({ sheet: "", error: "" }); },

  connect(e) { this.connectFor = e.currentTarget.dataset.id; this.setData({ sheet: "connect", sticker: "", error: "" }); },
  onSticker(e) { this.setData({ sticker: e.detail.value }); },
  scan() {
    ma.scanCode({
      success: (res) => { const text = res && (res.result || res.code || res.text); if (text) this.doConnect(text); else this.setData({ error: "Could not read the code. Type it instead." }); },
      fail: () => this.setData({ error: "Could not scan. Type the code instead." }),
    });
  },
  connectTyped() {
    const c = (this.data.sticker || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!c) { this.setData({ error: "Enter the hotspot code" }); return; }
    this.doConnect("wifiet://hotspot/" + c);
  },
  doConnect(qr) {
    ma.showLoading({ title: "Connecting…" });
    api.connect(this.connectFor, qr).then((r) => {
      ma.hideLoading();
      this.setData({ sheet: "", error: "" });
      ma.showModal({ title: "Connected to wifi.et", content: r.hotspot.name + ". Your " + r.pass.validity + " package has started.", showCancel: false });
      this.load();
    }).catch((e) => { ma.hideLoading(); this.setData({ error: e.message }); });
  },
});
