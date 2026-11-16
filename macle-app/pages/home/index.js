const api = require("../../utils/api");
const telebirr = require("../../utils/telebirr");
const f = require("../../utils/format");
const app = getApp();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Page({
  data: {
    state: "loading", error: "", dev: false, groups: ["Daily", "Weekly", "Monthly"], tab: "Daily",
    packages: [], shown: [], hotspots: [], pass: null, msisdn: "", msisdnTxt: "",
    sheet: "", sel: null, busy: false, busyText: "", phone: "",
  },

  onLoad() { this.start(); },
  onShow() { if (this.data.state === "ok") this.refresh(); },
  onPullDownRefresh() { this.refresh().then(() => ma.stopPullDownRefresh()); },

  start() {
    this.setData({ state: "loading", error: "" });
    app.ready().then(() => {
      const packages = app.globalData.packages.map((p) => Object.assign({}, p, { priceTxt: f.money(p.price) }));
      this.setData({ dev: app.globalData.dev, packages, state: "ok" });
      this.filter();
      return this.refresh();
    }).then(() => { if (!this.data.msisdn) this.setData({ sheet: "phone" }); })
      .catch((e) => this.setData({ state: "error", error: e.message }));
  },
  retry() { this.start(); },

  refresh() {
    return Promise.all([api.me(), api.passes(), api.hotspots()]).then(([me, passes, hs]) => {
      const m = me.user.msisdn || "";
      this.setData({
        msisdn: m, msisdnTxt: m ? f.prettyMsisdn(m) : "Add a number",
        pass: passes.active.length ? f.passView(passes.active[0]) : null,
        hotspots: hs.hotspots.slice(0, 3).map((h) => Object.assign({}, h, { sub: (h.area || "") + " · " + (h.status === "online" ? "Online" : "Offline") })),
      });
    }).catch(() => {});
  },

  filter() { this.setData({ shown: this.data.packages.filter((p) => p.group === this.data.tab) }); },
  setTab(e) { this.setData({ tab: e.currentTarget.dataset.g }); this.filter(); },
  goMine() { ma.switchTab({ url: "/pages/mine/index" }); },
  goHotspots() { ma.switchTab({ url: "/pages/hotspots/index" }); },
  goBusiness() { ma.navigateTo({ url: "/pages/business/index" }); },
  noop() {},
  closeSheet() { if (!this.data.busy) this.setData({ sheet: "", error: "" }); },

  buy(e) {
    const id = e.currentTarget.dataset.id;
    const sel = this.data.packages.filter((p) => p.id === id)[0];
    this.setData({ sel, sheet: this.data.msisdn ? "confirm" : "phone", error: "" });
  },

  onPhone(e) { this.setData({ phone: e.detail.value }); },
  savePhone() {
    api.setMsisdn(this.data.phone).then((r) => {
      const m = r.user.msisdn;
      this.setData({ msisdn: m, msisdnTxt: f.prettyMsisdn(m), error: "", sheet: this.data.sel ? "confirm" : "" });
      ma.showToast({ title: "Number saved" });
    }).catch((e) => this.setData({ error: e.message }));
  },

  pay() {
    if (this.data.busy) return;
    this.setData({ busy: true, busyText: "Opening telebirr…" });
    let orderId = "";
    api.createOrder(this.data.sel.id).then((o) => {
      orderId = o.orderId;
      return telebirr.startPay(o.rawRequest).catch((e) => {
        // Simulator against a mock-mode server: simulate telebirr's checkout.
        if (e && e.unavailable && this.data.dev) return api.devPay(orderId).then((r) => ({ paid: r.resultCode === "1" }));
        throw new Error("Open wifi.et from the telebirr app to pay.");
      });
    }).then((result) => {
      this.setData({ busyText: "Confirming payment…" });
      return this.waitForCode(orderId, result.paid ? 20 : 3).then((order) => ({ order, paid: result.paid }));
    }).then(({ order, paid }) => {
      this.setData({ busy: false, sheet: "" });
      if (order && (order.status === "FULFILLED" || order.status === "PAID")) {
        ma.navigateTo({ url: "/pages/success/index?id=" + order.orderId });
      } else {
        ma.showModal({
          title: paid ? "Confirming your payment" : "Payment not completed",
          content: paid ? "Your Wi-Fi code will appear in My Wi-Fi and arrive by SMS shortly." : "You have not been charged.",
          showCancel: false,
        });
      }
    }).catch((e) => {
      this.setData({ busy: false });
      ma.showToast({ title: e.message, icon: "none" });
    });
  },

  // The server confirms the payment with telebirr; poll until the code is issued.
  waitForCode(orderId, tries) {
    const step = (i) => api.order(orderId).then((r) => r.order, () => null).then((o) => {
      if (o && (o.status === "FULFILLED" || o.status === "FAILED")) return o;
      if (i + 1 >= tries) return o;
      return sleep(1500).then(() => step(i + 1));
    });
    return step(0);
  },
});
