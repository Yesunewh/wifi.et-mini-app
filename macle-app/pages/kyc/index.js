const api = require("../../utils/api");

const OPTIONS = {
  businessType: ["Sole proprietor", "Private limited company (PLC)", "Share company", "NGO / association", "Government institution"],
  sector: ["Retail", "Hotel and hospitality", "Banking and finance", "Education", "Health", "Real estate", "Other"],
  city: ["Addis Ababa", "Adama", "Bahir Dar", "Hawassa", "Mekelle", "Dire Dawa", "Other"],
};
const DOCS = [
  { key: "license", label: "Trade license", hint: "Take or choose a clear photo" },
  { key: "tin", label: "TIN certificate", hint: "Take or choose a clear photo" },
  { key: "id", label: "Representative's ID", hint: "Fayda digital ID, kebele ID or passport" },
];

// Reads a chosen photo as base64 so it can be sent to the server as JSON.
function readBase64(filePath) {
  return new Promise((resolve, reject) => {
    const fs = ma.getFileSystemManager && ma.getFileSystemManager();
    if (!fs || !fs.readFile) { reject(new Error("This phone cannot attach photos here")); return; }
    fs.readFile({ filePath, encoding: "base64", success: (r) => resolve(r.data), fail: () => reject(new Error("Could not read the photo")) });
  });
}

Page({
  data: { f: { city: "Addis Ababa" }, docList: DOCS.map((d) => Object.assign({ done: false }, d)), consent: false, busy: false },
  docs: {},

  onInput(e) { const f = this.data.f; f[e.currentTarget.dataset.f] = e.detail.value; this.setData({ f }); },
  pick(e) {
    const k = e.currentTarget.dataset.f, list = OPTIONS[k];
    ma.showActionSheet({ itemList: list, success: (res) => { const f = this.data.f; f[k] = list[res.tapIndex]; this.setData({ f }); } });
  },
  toggleConsent() { this.setData({ consent: !this.data.consent }); },

  attach(e) {
    const k = e.currentTarget.dataset.k;
    ma.chooseImage({
      count: 1, sizeType: ["compressed"],
      success: (res) => {
        const path = (res.tempFilePaths && res.tempFilePaths[0]) || (res.tempFiles && res.tempFiles[0] && res.tempFiles[0].path);
        if (!path) return;
        const png = /\.png$/i.test(path);
        readBase64(path).then((b64) => {
          if (b64.length > 6.6e6) { ma.showToast({ title: "The photo must be under 5 MB", icon: "none" }); return; }
          this.docs[k] = { name: k + (png ? ".png" : ".jpg"), dataUrl: "data:image/" + (png ? "png" : "jpeg") + ";base64," + b64 };
          this.setData({ docList: this.data.docList.map((d) => (d.key === k ? Object.assign({}, d, { done: true }) : d)) });
        }).catch((err) => ma.showToast({ title: err.message, icon: "none" }));
      },
    });
  },

  submit() {
    if (this.data.busy) return;
    const f = this.data.f, miss = [];
    if (!f.legalName) miss.push("business name");
    if (!f.businessType) miss.push("business type");
    if (!/^\d{10}$/.test(f.tin || "")) miss.push("10-digit TIN");
    if (!f.licenseNo) miss.push("trade license no.");
    if (!f.contactPerson) miss.push("contact person");
    if (!(this.docs.license && this.docs.tin && this.docs.id)) miss.push("all 3 documents");
    if (!this.data.consent) miss.push("consent");
    if (miss.length) { ma.showModal({ title: "Please complete", content: "Missing: " + miss.join(", "), showCancel: false }); return; }
    this.setData({ busy: true });
    api.submitKyc(Object.assign({}, f, { consent: true, documents: this.docs })).then(() => {
      ma.showToast({ title: "Submitted for verification" });
      ma.navigateBack();
    }).catch((e) => { this.setData({ busy: false }); ma.showModal({ title: "Could not submit", content: e.message, showCancel: false }); });
  },
});
