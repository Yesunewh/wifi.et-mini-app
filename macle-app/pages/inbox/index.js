const api = require("../../utils/api");
const f = require("../../utils/format");
const app = getApp();

const ICONS = ["check", "bell", "shield", "wifi", "pin", "clock", "sms"];

Page({
  data: { list: [], unread: 0, openId: 0, loaded: false },
  onShow() { app.ready().then(() => this.load()).catch(() => {}); },
  load() {
    return api.messages().then((r) => {
      const list = r.messages.map((m) => Object.assign({}, m, {
        when: f.dRel(m.at), preview: m.body.length > 60 ? m.body.slice(0, 60) + "…" : m.body,
        iconFile: (ICONS.indexOf(m.icon) >= 0 ? m.icon : "bell") + "-green.png",
      }));
      this.setData({ list, unread: list.filter((m) => !m.read).length, loaded: true });
    }).catch((e) => ma.showToast({ title: e.message, icon: "none" }));
  },
  open(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.list.map((m) => (m.id === id ? Object.assign({}, m, { read: true }) : m));
    const wasUnread = this.data.list.some((m) => m.id === id && !m.read);
    this.setData({ list, openId: this.data.openId === id ? 0 : id, unread: list.filter((m) => !m.read).length });
    if (wasUnread) api.readMessages([id]).catch(() => {});
  },
  readAll() {
    this.setData({ list: this.data.list.map((m) => Object.assign({}, m, { read: true })), unread: 0 });
    api.readMessages().catch(() => {});
  },
});
