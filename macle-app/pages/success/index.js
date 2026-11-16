const api = require("../../utils/api");
const f = require("../../utils/format");
const app = getApp();

Page({
  data: { order: null, amountTxt: "", pkgName: "", pkgValidity: "", toTxt: "", error: "" },
  onLoad(options) {
    api.order(options.id).then((r) => {
      const o = r.order, p = app.packageById(o.packageId) || {};
      this.setData({ order: o, amountTxt: f.money(o.amount), pkgName: (p.name || "").replace("Wi-Fi ", ""), pkgValidity: p.validity || "", toTxt: f.prettyMsisdn(o.to) });
    }).catch((e) => this.setData({ error: e.message }));
  },
  goMine() { ma.switchTab({ url: "/pages/mine/index" }); },
  goHome() { ma.switchTab({ url: "/pages/home/index" }); },
});
