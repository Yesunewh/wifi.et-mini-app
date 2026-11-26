const api = require("../../utils/api");

const BUDGETS = ["Under ETB 50,000", "ETB 50,000 – 200,000", "ETB 200,000 – 1 million", "Above ETB 1 million", "Not sure yet"];
const AREAS = ["Bole", "Kirkos", "Arada", "Yeka", "Lideta", "All Addis Ababa"];

Page({
  data: { formats: [], areas: AREAS.map((name) => ({ name, on: false })), ways: ["Call", "SMS", "Email"], contactBy: "Call", budget: "", message: "", busy: false, ref: "" },
  onLoad() {
    api.business().then((r) => {
      if (r.business.status !== "verified") { ma.navigateBack(); return; }
      this.setData({ formats: r.formats.map((x) => ({ name: x.name, on: false })) });
    }).catch((e) => ma.showToast({ title: e.message, icon: "none" }));
  },
  flip(key, name) { const o = {}; o[key] = this.data[key].map((x) => (x.name === name ? { name: x.name, on: !x.on } : x)); this.setData(o); },
  toggleFormat(e) { this.flip("formats", e.currentTarget.dataset.n); },
  toggleArea(e) { this.flip("areas", e.currentTarget.dataset.n); },
  setWay(e) { this.setData({ contactBy: e.currentTarget.dataset.n }); },
  pickBudget() { ma.showActionSheet({ itemList: BUDGETS, success: (res) => this.setData({ budget: BUDGETS[res.tapIndex] }) }); },
  onMsg(e) { this.setData({ message: e.detail.value }); },
  back() { ma.navigateBack(); },
  send() {
    if (this.data.busy) return;
    const formats = this.data.formats.filter((x) => x.on).map((x) => x.name);
    if (!formats.length) { ma.showToast({ title: "Choose at least one ad format", icon: "none" }); return; }
    this.setData({ busy: true });
    api.sendLead({ formats, areas: this.data.areas.filter((x) => x.on).map((x) => x.name), budget: this.data.budget, contactBy: this.data.contactBy, message: this.data.message })
      .then((r) => this.setData({ ref: r.ref, busy: false }))
      .catch((e) => { this.setData({ busy: false }); ma.showToast({ title: e.message, icon: "none" }); });
  },
});
