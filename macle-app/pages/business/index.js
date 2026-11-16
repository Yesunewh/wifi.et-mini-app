const api = require("../../utils/api");
const app = getApp();

Page({
  data: { formats: [], status: "none", legalName: "", tin: "", note: "" },
  onShow() {
    app.ready().then(() => api.business()).then((r) => {
      const b = r.business;
      this.setData({ formats: r.formats, status: b.status, legalName: b.legalName || "your business", tin: b.tin || "",
        note: b.note || "Please check your details and documents, then submit again." });
    }).catch((e) => ma.showToast({ title: e.message, icon: "none" }));
  },
  goKyc() { ma.navigateTo({ url: "/pages/kyc/index" }); },
  goContact() { ma.navigateTo({ url: "/pages/contact/index" }); },
});
