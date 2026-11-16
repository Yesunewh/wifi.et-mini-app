const api = require("../../utils/api");
const f = require("../../utils/format");

Page({
  data: { list: [], located: false, loaded: false },
  raw: [], here: null,

  onShow() {
    api.hotspots().then((r) => { this.raw = r.hotspots; this.build(); }).catch((e) => ma.showToast({ title: e.message, icon: "none" }));
  },
  build() {
    const here = this.here;
    let list = this.raw.map((h) => {
      const d = here && h.lat != null ? f.km(here, h) : null;
      const parts = [h.area || ""];
      if (d != null) parts.push(f.distTxt(d));
      parts.push(h.status === "online" ? "Online" : "Offline");
      return Object.assign({}, h, { d, sub: parts.filter(Boolean).join(" · "), hasMap: h.lat != null });
    });
    if (here) list = list.sort((a, b) => a.d - b.d);
    this.setData({ list, located: !!here, loaded: true });
  },
  locate() {
    ma.getLocation({
      success: (res) => { this.here = { lat: res.latitude, lng: res.longitude }; this.build(); },
      fail: () => ma.showToast({ title: "Location is not available", icon: "none" }),
    });
  },
  directions(e) {
    const h = this.raw.filter((x) => x.id === e.currentTarget.dataset.id)[0];
    if (!h) return;
    const url = "https://www.google.com/maps/dir/?api=1&destination=" + h.lat + "," + h.lng;
    if (typeof ma.gotoBrowser === "function") ma.gotoBrowser({ url });
    else ma.setClipboardData({ data: url, success: () => ma.showToast({ title: "Map link copied" }) });
  },
});
