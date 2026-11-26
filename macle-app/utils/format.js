const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toDate(s) {
  if (!s) return null;
  const iso = /Z$|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
const money = (n) => String(Number(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const dShort = (s) => { const d = toDate(s); return d ? d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear() : ""; };
const dRel = (s) => { const d = toDate(s); if (!d) return ""; const days = Math.floor((Date.now() - d.getTime()) / 864e5); return days < 1 ? "Today" : days < 2 ? "Yesterday" : MON[d.getMonth()] + " " + d.getDate(); };
const monthOf = (s) => { const d = toDate(s); return d ? MON[d.getMonth()] + " " + d.getFullYear() : ""; };
const prettyMsisdn = (m) => (m ? "+" + String(m).replace(/^(\d{3})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4") : "");
const maskMsisdn = (m) => (m ? "+251 9•• ••• " + String(m).slice(-3) : "");

function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.pow(Math.sin(dLng / 2), 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
const distTxt = (d) => (d == null ? "" : d < 1 ? Math.round(d * 100) * 10 + " m" : d.toFixed(1) + " km");

// Adds display fields to a pass from GET /api/me/passes.
function passView(p) {
  const live = !!p.startedAt, unlimited = /^Unlimited/.test(p.data), d = toDate(p.boughtAt) || new Date();
  return Object.assign({}, p, {
    shortName: p.name.replace("Wi-Fi ", ""), live, badge: live ? "Live" : "Not started",
    ringMain: unlimited ? "∞" : p.data, ringSub: unlimited ? "fair use" : "data",
    validityTxt: p.validity + (live ? "" : " from first login"),
    whenLabel: live ? "Ends" : "Bought", whenTxt: live && p.expiresAt ? dShort(p.expiresAt) : dShort(p.boughtAt),
    priceTxt: money(p.price), day: d.getDate(), mon: MON[d.getMonth()], month: monthOf(p.boughtAt),
    stateTxt: { active: "Active", expired: "Expired", refunded: "Refunded" }[p.state] || p.state,
    firstLogin: p.startedAt ? dShort(p.startedAt) : "",
  });
}

module.exports = { MON, toDate, money, dShort, dRel, monthOf, prettyMsisdn, maskMsisdn, km, distTxt, passView };
