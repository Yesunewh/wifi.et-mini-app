const api = require("../../utils/api");
const f = require("../../utils/format");
const app = getApp();

const BIZ = { none: "Advertise", review: "In review", verified: "Verified", rejected: "Action needed" };

Page({
  data: { name: "", initials: "", msisdnMasked: "", msisdnTxt: "Add", spentTxt: "0", passes: 0, unread: 0, bizTxt: "Advertise", sheet: "", phone: "", error: "" },

  onShow() { app.ready().then(() => this.load()).catch(() => {}); },
  load() {
    return api.me().then((me) => {
      const u = me.user, name = u.name || "wifi.et user";
      this.setData({
        name, initials: name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase(),
        msisdnMasked: u.msisdn ? f.maskMsisdn(u.msisdn) : "No phone number yet", msisdnTxt: u.msisdn ? f.prettyMsisdn(u.msisdn) : "Add",
        spentTxt: f.money(me.stats.spent), passes: me.stats.passes, unread: me.unread, bizTxt: BIZ[me.business.status] || "Advertise",
      });
    }).catch((e) => ma.showToast({ title: e.message, icon: "none" }));
  },
  goInbox() { ma.navigateTo({ url: "/pages/inbox/index" }); },
  goBusiness() { ma.navigateTo({ url: "/pages/business/index" }); },
  callHelp() { ma.makePhoneCall({ phoneNumber: "994" }); },
  noop() {},
  editPhone() { this.setData({ sheet: "phone", phone: "", error: "" }); },
  closeSheet() { this.setData({ sheet: "", error: "" }); },
  onPhone(e) { this.setData({ phone: e.detail.value }); },
  savePhone() {
    api.setMsisdn(this.data.phone).then(() => { this.setData({ sheet: "" }); ma.showToast({ title: "Number saved" }); this.load(); })
      .catch((e) => this.setData({ error: e.message }));
  },
});
