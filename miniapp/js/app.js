/* wifi.et mini app: screens, state and actions. Design follows the approved demo (Option B). */
(function () {
  "use strict";
  const LOGO = "./img/wifiet.png";

  /* ---------- state ---------- */
  const S = {
    screen: "loading", sheet: null, toast: null, dev: false, error: null,
    user: null, me: null, packages: [], hotspots: [], here: null, passes: { active: [], history: [] }, msgs: [],
    sel: null, order: null, last: null, bTab: "Daily", hFilter: "Active", hOpen: null, mFilter: "All", mOpen: null,
    connectFor: null, sticker: "", connected: null, phone: "",
    biz: { status: "none" }, formats: [], f: { city: "Addis Ababa" }, docs: {}, consent: false, fmts: [], areas: [], cby: "Call", bizRef: null, busy: false,
  };

  /* ---------- helpers ---------- */
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Number(n).toLocaleString("en-US");
  const pk = (id) => S.packages.find((p) => p.id === id);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const toDate = (s) => (s ? new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z") : null);
  const dShort = (s) => { const d = toDate(s); return d ? `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` : ""; };
  const dRel = (s) => { const d = toDate(s); if (!d) return ""; const days = Math.floor((Date.now() - d) / 864e5); return days < 1 ? "Today" : days < 2 ? "Yesterday" : `${MON[d.getMonth()]} ${d.getDate()}`; };
  const prettyMsisdn = (m) => (m ? "+" + m.replace(/^(\d{3})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4") : "");
  const maskMsisdn = (m) => (m ? "+251 9•• ••• " + m.slice(-3) : "");
  const km = (a, b) => { const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const distTxt = (d) => (d == null ? "" : d < 1 ? Math.round(d * 1000 / 10) * 10 + " m" : d.toFixed(1) + " km");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- icons (from the demo) ---------- */
  const I = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19.2" r="1.2" fill="currentColor"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    check: '<path d="M5 12.5 10 17l9-10"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    sms: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    play: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    banner: '<rect x="4" y="3" width="16" height="18" rx="2"/><rect x="7" y="6" width="10" height="6" rx="1"/><path d="M7 15h10M7 18h6"/>',
    store: '<path d="M4 9 5.5 4h13L20 9M4 9h16v2a3 3 0 0 1-5.3 2 3 3 0 0 1-5.4 0A3 3 0 0 1 4 11zM5 13.5V20h14v-6.5"/><path d="M10 20v-4h4v4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.3-2.4 3.8M12 17h.01"/>',
    wallet: '<path d="M4 7a2 2 0 0 1 2-2h12v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 13.5h2"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
    gift: '<rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M12 9v12M3 13h18M12 9C10 4 6 5 7.5 7.5 8.4 9 12 9 12 9zm0 0c2-5 6-4 4.5-1.5C15.6 9 12 9 12 9z"/>',
    send: '<path d="M4 12h12M12 6l6 6-6 6"/><rect x="2" y="3" width="20" height="18" rx="3" opacity=".35"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  };
  const ic = (n, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${I[n] || I.bell}</svg>`;
  const chev = ic("back", 'style="width:18px;height:18px;transform:rotate(180deg);color:#5E8F22"');

  /* ---------- shell ---------- */
  function mHead() {
    const unread = S.me ? S.me.unread : 0;
    return `${S.dev ? '<div class="devbar">Development mode: payments are simulated</div>' : ""}
      <div class="mhead"><div class="t"><img src="${LOGO}" alt="wifi.et"></div>
      <button class="iconbtn bell" data-act="go:msgs" aria-label="Inbox${unread ? `, ${unread} unread` : ""}">${ic("bell")}${unread ? '<span class="dot"></span>' : ""}</button></div>`;
  }
  const PROF = ["profile", "msgs", "biz", "kyc", "contact", "bizok"];
  function mNav(on) {
    const b = (sc, i, l) => `<button class="${on === sc || (sc === "profile" && PROF.includes(on)) ? "on" : ""}" data-act="go:${sc}">${ic(i)}${l}</button>`;
    return `<nav class="mnav">${b("home", "home", "Home")}${b("hotspots", "pin", "Hotspots")}${b("mine", "wifi", "My Wi-Fi")}${b("profile", "user", "Profile")}</nav>`;
  }
  const titlebar = (title, back) => `<div class="titlebar" style="background:#fff"><button class="iconbtn" data-act="go:${back}" aria-label="Back">${ic("back")}</button><h2>${title}</h2><span style="width:34px"></span></div>`;

  /* ---------- screens ---------- */
  function loading() { return `<div class="center"><img src="${LOGO}" alt="wifi.et"><div class="spin" style="margin:6px auto"></div></div>`; }

  function blocked() {
    return `<div class="center"><img src="${LOGO}" alt="wifi.et"><h3>Open wifi.et from telebirr</h3>
      <p>${esc(S.error || "This app runs inside telebirr. Open telebirr, go to Apps and tap wifi.et.")}</p>
      <button class="cta" style="max-width:260px" data-act="retry">Try again</button></div>`;
  }

  function devLogin() {
    return `<div class="center"><img src="${LOGO}" alt="wifi.et"><h3>Development sign-in</h3>
      <p>Outside telebirr, sign in with any Ethiopian mobile number. Payments are simulated.</p>
      <div class="fld" style="width:100%;max-width:300px"><input id="devphone" inputmode="tel" placeholder="0912 345 678" value="${esc(S.phone)}"></div>
      <button class="cta" style="max-width:300px" data-act="devlogin">Continue</button>${S.error ? `<div class="err">${esc(S.error)}</div>` : ""}</div>`;
  }

  function bars(on) { return `<span class="bars">${[5, 8, 11, 14].map((h, i) => `<i class="${on && i < 4 ? "" : "off"}" style="height:${h - 2}px"></i>`).join("")}</span>`; }

  function sortedHotspots() {
    const list = S.hotspots.map((h) => ({ ...h, d: S.here && h.lat != null ? km(S.here, h) : null }));
    return S.here ? list.sort((a, b) => a.d - b.d) : list;
  }

  function pass(p) {
    const live = !!p.startedAt;
    const unlimited = /^Unlimited/.test(p.data);
    return `<div class="pass"><div class="ptop"><div><small>wifi.et pass</small><b>${esc(p.name.replace("Wi-Fi ", ""))}</b></div><span class="live ${live ? "" : "wait"}">${live ? "Live" : "Not started"}</span></div>
      <div class="mid"><div class="ring2" style="--p:100%"><div>${unlimited ? "∞" : esc(p.data)}<small>${unlimited ? "fair use" : "data"}</small></div></div>
        <div class="facts"><div><span>Validity </span>${esc(p.validity)}${live ? "" : " from first login"}</div>
        <div><span>Where </span>All wifi.et hotspots</div>
        <div><span>${live ? "Ends " : "Bought "}</span>${live && p.expiresAt ? dShort(p.expiresAt) : dShort(p.boughtAt)}</div></div></div>
      <div class="tear"></div>
      <div class="cd"><div><small>Wi-Fi code</small><code>${esc(p.code)}</code></div></div>
      <div class="pacts"><button data-act="connect:${esc(p.orderId)}">Connect</button><button class="alt" data-act="copy:${esc(p.code)}">Copy code</button></div></div>`;
  }

  function home() {
    const act = S.passes.active[0];
    return mHead() + `<div class="body"><div class="mbody">
      <div class="mhero"><img src="${LOGO}" alt="wifi.et"><b>Fast Wi-Fi at hotspots near you</b><small>Pay with telebirr. Get your code instantly.</small></div>
      ${act ? `<div class="sect"><h3>Your Wi-Fi pass</h3><button data-act="go:mine">My Wi-Fi</button></div>${pass(act)}` : ""}
      <div class="sect"><h3>${S.here ? "Nearby hotspots" : "Hotspots"}</h3><button data-act="go:hotspots">See all</button></div>
      <div class="hs-row">${sortedHotspots().slice(0, 3).map((h) => `<div class="hs"><b>${esc(h.name)}</b><span>${esc(h.area || "")}</span><span class="d">${distTxt(h.d)} ${bars(h.status === "online")}</span></div>`).join("")}</div>
      <div class="sect"><h3>Buy a package</h3></div>
      <div class="pillseg">${["Daily", "Weekly", "Monthly"].map((g) => `<button class="${S.bTab === g ? "on" : ""}" data-act="btab:${g}">${g}</button>`).join("")}</div>
      <div class="plist">${S.packages.filter((p) => p.group === S.bTab).map((p) => {
        const [main, fair] = p.data.split(" (");
        return `<div class="prow"><div class="ring">${ic("wifi")}</div><div class="info"><b>${esc(main)}${fair ? `<br><small style="font-size:11px;font-weight:400">(${esc(fair)}</small>` : ""}</b><small>${esc(p.validity)} · all wifi.et hotspots</small></div>
          <button class="buy" data-act="buy:${p.id}">${fmt(p.price)} ETB</button></div>`; }).join("")}</div>
      <button class="adcta" data-act="go:biz"><span class="ring">${ic("store")}</span><span style="flex:1"><b>Own a business? Advertise on wifi.et</b><small>Reach people when they connect at hotspots</small></span>${chev}</button>
    </div></div>${mNav("home")}`;
  }

  function hotspots() {
    const list = sortedHotspots();
    return mHead() + `<div class="body"><div class="mbody">
      <div class="mytitle"><h2>Hotspots</h2>${S.here ? "" : `<button class="lnk" data-act="locate">Use my location</button>`}</div>
      <div class="hlist">${list.map((h) => `<div class="hrow"><div class="ring" style="width:40px;height:40px;border-radius:12px;background:#EEF6E2;color:#5E8F22;display:grid;place-items:center">${ic("pin", 'style="width:22px;height:22px"')}</div>
        <div class="info"><b>${esc(h.name)}</b><small>${esc(h.area || "")}${h.d != null ? " · " + distTxt(h.d) : ""} · ${h.status === "online" ? "Online" : "Offline"} ${bars(h.status === "online")}</small></div>
        ${h.lat != null ? `<a class="go" href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}" target="_blank" rel="noopener">Go</a>` : ""}</div>`).join("")}</div>
      ${list.length ? "" : `<div class="empty">${ic("pin")}<div>No hotspots listed yet.</div></div>`}
    </div></div>${mNav("hotspots")}`;
  }

  function mine() {
    const tab = S.hFilter;
    let body = "";
    if (tab === "Active") {
      body = S.passes.active.length ? S.passes.active.map(pass).join("")
        : `<div class="empty">${ic("wifi")}<div>No active Wi-Fi pass.</div><button class="cta" style="margin-top:14px" data-act="go:home">Buy a package</button></div>`;
      body += `<div class="howto" style="margin-top:4px"><b>How to connect</b><ol><li>At any hotspot, tap Connect and scan the wifi.et QR sticker.</li><li>Or join the wifi.et network and enter your code.</li><li>Your pass starts at first login.</li></ol></div>`;
    } else {
      const h = S.passes.history;
      const spent = h.filter((x) => x.state !== "refunded").reduce((a, x) => a + x.price, 0);
      const months = [...new Set(h.map((x) => { const d = toDate(x.boughtAt); return `${MON[d.getMonth()]} ${d.getFullYear()}`; }))];
      const lbl = { active: "Active", expired: "Expired", refunded: "Refunded" };
      body = `<div class="sumstrip"><div><b>${fmt(spent)}</b><small>ETB spent</small></div><div><b>${h.length}</b><small>passes</small></div><div><b>${S.passes.active.length}</b><small>active</small></div></div>`
        + (h.length ? months.map((m) => `<div class="month">${m}</div>` + h.filter((x) => { const d = toDate(x.boughtAt); return `${MON[d.getMonth()]} ${d.getFullYear()}` === m; }).map((x) => {
          const d = toDate(x.boughtAt), open = S.hOpen === x.orderId;
          return `<div class="hrow2"><button class="hh" data-act="hopen:${esc(x.orderId)}"><span class="datebadge"><b>${d.getDate()}</b><small>${MON[d.getMonth()]}</small></span>
            <span class="info"><b>${esc(x.name.replace("Wi-Fi ", ""))}</b><small>${esc(x.data)} · ${esc(x.validity)}</small></span>
            <span class="amt"><b>${fmt(x.price)} ETB</b><small class="st-${x.state === "active" ? "active" : x.state === "expired" ? "expired" : "used"}">${lbl[x.state]}</small></span></button>
            ${open ? `<div class="hdet"><div class="kv"><span>Order ID</span><b>${esc(x.orderId)}</b></div>${x.transId ? `<div class="kv"><span>telebirr transaction</span><b>${esc(x.transId)}</b></div>` : ""}
              <div class="kv"><span>Wi-Fi code</span><code>${esc(x.code)}</code></div>${x.startedAt ? `<div class="kv"><span>First login</span><b>${dShort(x.startedAt)}</b></div>` : ""}
              <div class="actsmall"><button data-act="buy:${esc(x.packageId)}">Buy again</button></div></div>` : ""}</div>`; }).join("")).join("")
          : `<div class="empty" style="margin-top:14px">${ic("clock")}<div>Your purchases will appear here.</div></div>`);
    }
    return mHead() + `<div class="body"><div class="mbody">
      <div class="mytitle"><h2>My Wi-Fi</h2></div>
      <div class="utabs"><button class="${tab === "Active" ? "on" : ""}" data-act="hf:Active">Active</button><button class="${tab === "History" ? "on" : ""}" data-act="hf:History">History</button></div>
      ${body}</div></div>${mNav("mine")}`;
  }

  function profile() {
    const u = S.me ? S.me.user : S.user || {};
    const st = S.me ? S.me.stats : { spent: 0, passes: 0 };
    const unread = S.me ? S.me.unread : 0;
    const initials = (u.name || "wifi").split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
    const row = (icon, label, right, act) => `<button class="gi" data-act="${act}">${ic(icon, 'class="l"')}${label}<span class="r">${right || ""}${ic("back", 'class="chev2"')}</span></button>`;
    const bs = S.biz.status;
    return mHead() + `<div class="body"><div class="mbody">
      <div class="prof"><div class="av2">${esc(initials)}</div><div><b>${esc(u.name || "wifi.et user")}</b><small>${u.msisdn ? maskMsisdn(u.msisdn) : "No phone number yet"}</small>${u.since ? `<small>wifi.et user since ${MON[toDate(u.since).getMonth()]} ${toDate(u.since).getFullYear()}</small>` : ""}</div></div>
      <div class="sumstrip" style="margin-top:16px"><div><b>${fmt(st.spent)}</b><small>ETB spent</small></div><div><b>${st.passes}</b><small>passes bought</small></div><div><b>${S.passes.active.length}</b><small>active</small></div></div>
      <div class="group"><div class="gt">Account</div><div class="glist">
        ${row("chat", "Inbox", unread ? `<span class="cnt">${unread}</span>` : "", "go:msgs")}
        ${row("phone", "Number for Wi-Fi codes", u.msisdn ? prettyMsisdn(u.msisdn) : "Add", "sheet:phone")}
        ${row("wallet", "Payment method", '<span class="okt">telebirr wallet</span>', "toast:Payments are made from your telebirr wallet")}
        ${row("pin", "Hotspots", String(S.hotspots.length), "go:hotspots")}
      </div></div>
      <div class="group"><div class="gt">Business</div><div class="glist">
        ${row("store", "wifi.et for Business", bs === "verified" ? '<span class="okt">Verified</span>' : bs === "review" ? "In review" : bs === "rejected" ? "Action needed" : "Advertise", "go:biz")}
      </div></div>
      <div class="group"><div class="gt">Support</div><div class="glist">
        ${row("help", "Help &amp; support", "994", "toast:Call 994 for help with wifi.et")}
      </div></div>
    </div></div>${mNav("profile")}`;
  }

  const MSG_STYLE = { Offer: ["#FFF4D6", "#9A6B00"], Package: ["#EEF6E2", "#2E5A12"], Usage: ["#EEF0EC", "#4A5246"], Hotspot: ["#E6F0FB", "#2D5A9B"], Business: ["#F1E9FA", "#6C3FA0"], Info: ["#EEF0EC", "#4A5246"] };
  const MSG_ACT = { Package: ["Buy a package", "go:home"], Usage: ["Buy a package", "go:home"], Hotspot: ["See hotspots", "go:hotspots"], Offer: ["View packages", "go:home"], Business: ["Open Business", "go:biz"] };
  function msgs() {
    const F = S.mFilter, unread = S.msgs.filter((m) => !m.read).length;
    const match = (m) => F === "All" || (F === "Packages" && (m.tag === "Package" || m.tag === "Usage")) || (F === "Offers" && m.tag === "Offer") || (F === "Business" && m.tag === "Business");
    const list = S.msgs.filter(match);
    const grp = (title, items) => items.length ? `<div class="month">${title}</div>` + items.map((m) => {
      const [bg, fg] = MSG_STYLE[m.tag] || MSG_STYLE.Info, open = S.mOpen === m.id, a = MSG_ACT[m.tag];
      return `<div class="mi2 ${m.read ? "" : "unread"}"><button class="mh" data-act="msg:${m.id}"><span class="mic" style="background:${bg};color:${fg}">${ic(m.icon)}</span>
        <span class="tx"><b>${esc(m.title)}</b>${open ? "" : `<span class="pv">${esc(m.body)}</span>`}</span><span class="tm">${dRel(m.at)}</span></button>
        ${open ? `<div class="mx">${esc(m.body)}${a ? `<div><button class="small-btn" data-act="${a[1]}">${a[0]}</button></div>` : ""}</div>` : ""}</div>`; }).join("") : "";
    const today = list.filter((m) => dRel(m.at) === "Today");
    return mHead() + `<div class="body"><div class="mbody">
      <div class="inbox-h"><button class="iconbtn" data-act="go:profile" aria-label="Back" style="margin-left:-8px">${ic("back")}</button><h2>Inbox</h2>${unread ? `<span class="unc">${unread} new</span>` : ""}${unread ? '<button class="lnk" data-act="readall">Mark all read</button>' : ""}</div>
      <div class="chips2">${["All", "Packages", "Offers", "Business"].map((f) => `<button class="${F === f ? "on" : ""}" data-act="mf:${f}">${f}</button>`).join("")}</div>
      ${list.length ? grp("Today", today) + grp("Earlier", list.filter((m) => !today.includes(m))) : `<div class="empty" style="margin-top:14px">${ic("bell")}<div>Nothing here yet.</div></div>`}
    </div></div>${mNav("msgs")}`;
  }

  /* ---------- business ---------- */
  const AREAS = ["Bole", "Kirkos", "Arada", "Yeka", "Lideta", "All Addis Ababa"];
  const fv = (k) => esc(S.f[k] || "");
  const opts = (list, k) => `<option value="">Select…</option>` + list.map((o) => `<option ${S.f[k] === o ? "selected" : ""}>${esc(o)}</option>`).join("");
  function kycCard() {
    const b = S.biz;
    if (b.status === "none" || b.status === "rejected") return `<div class="kyccard none"><div class="h">${ic("shield")}${b.status === "rejected" ? "Verification not approved" : "Step 1: Verify your business"}</div>
      <span>${b.status === "rejected" ? esc(b.note || "Please check your details and documents, then submit again.") : "ethio telecom checks every advertiser against official business records (KYC) before ads can run."}</span>
      <button class="small-btn" data-act="go:kyc">${b.status === "rejected" ? "Correct and resubmit" : "Start verification"}</button></div>`;
    if (b.status === "review") return `<div class="kyccard review"><div class="h">${ic("clock")}Verification under review</div>
      <span>We are checking <b>${esc(b.legalName || "your business")}</b>. You'll get a message in your inbox when it's reviewed.</span></div>`;
    return `<div class="kyccard ok"><div class="h">${ic("check")}Verified business</div><span><b>${esc(b.legalName)}</b> · TIN ${esc(b.tin)}</span>
      ${S.bizRef ? `<span>Request <b>${esc(S.bizRef)}</b> sent. Our team will contact you.</span>` : ""}
      <button class="small-btn" data-act="go:contact">${S.bizRef ? "Send another request" : "Contact our sales team"}</button></div>`;
  }
  function biz() {
    return mHead() + `<div class="body"><div class="mbody">
      <div class="bhero"><div class="k">wifi.et for business</div><b>Advertise to people as they connect</b><small>Put your brand in front of Wi-Fi users at the hotspots you choose.</small></div>
      <div class="sect"><h3>Ad formats</h3></div>
      <div class="stack">${S.formats.map((f) => `<div class="fmt"><span class="ring">${ic(f.icon)}</span><span class="info"><b>${esc(f.name)}</b><small>${esc(f.description)}</small><span class="p">${esc(f.price)}</span></span></div>`).join("")}</div>
      <div class="sect"><h3>How it works</h3></div>
      <div class="how3"><div><i>1</i>Verify your business (KYC)</div><div><i>2</i>Tell us about your campaign</div><div><i>3</i>Our wifi.et business team contacts you</div></div>
      <div class="sect"><h3>Get started</h3></div>
      ${kycCard()}
      ${S.biz.status !== "verified" ? `<div class="lockbox" style="margin-top:10px">${ic("lock")}Contacting the sales team unlocks after your business is verified.</div>` : ""}
    </div></div>${mNav("biz")}`;
  }
  function docBtn(k, label, hint) {
    const d = S.docs[k];
    return `<label class="doc ${d ? "done" : ""}">${ic(d ? "check" : "doc")}<span class="info"><b>${label}</b><small style="color:#6B7368;font-size:11px">${d ? esc(d.name) + " · attached" : hint}</small></span><span class="st">${d ? "Change" : "Attach"}</span>
      <input type="file" accept="application/pdf,image/jpeg,image/png" data-doc="${k}" style="display:none"></label>`;
  }
  function kyc() {
    return titlebar("Business verification", "biz") + `<div class="body"><div class="mbody">
      <div class="note" style="margin:0 0 14px">${ic("shield")}Required before advertising. Details are checked against official business records.</div>
      <div class="form">
        <div class="fld"><label>Legal business name <em>*</em></label><input data-f="legalName" value="${fv("legalName")}" placeholder="As on trade license" maxlength="200"></div>
        <div class="fld"><label>Business type <em>*</em></label><select data-f="businessType">${opts(["Sole proprietor", "Private limited company (PLC)", "Share company", "NGO / association", "Government institution"], "businessType")}</select></div>
        <div class="fld"><label>Sector</label><select data-f="sector">${opts(["Retail", "Hotel and hospitality", "Banking and finance", "Education", "Health", "Real estate", "Other"], "sector")}</select></div>
        <div class="fld"><label>TIN <em>*</em></label><input data-f="tin" value="${fv("tin")}" inputmode="numeric" maxlength="10" placeholder="10 digits"><span class="hint">Tax Identification Number</span></div>
        <div class="fld"><label>Trade license number <em>*</em></label><input data-f="licenseNo" value="${fv("licenseNo")}" placeholder="e.g. AA/14/1/0000000/2016" maxlength="60"></div>
        <div class="fld"><label>City</label><select data-f="city">${opts(["Addis Ababa", "Adama", "Bahir Dar", "Hawassa", "Mekelle", "Dire Dawa", "Other"], "city")}</select></div>
        <div class="fld"><label>Contact person <em>*</em></label><input data-f="contactPerson" value="${fv("contactPerson")}" placeholder="Full name" maxlength="120"></div>
        <div class="fld"><label>Contact phone</label><input data-f="phone" value="${fv("phone")}" inputmode="tel" maxlength="20"></div>
        <div class="fld"><label>Email</label><input data-f="email" value="${fv("email")}" inputmode="email" placeholder="name@company.et" maxlength="120"></div>
        <div class="flabel">Documents <em style="color:#C0392B;font-style:normal">*</em></div>
        ${docBtn("license", "Trade license", "PDF, JPG or PNG, up to 5 MB")}
        ${docBtn("tin", "TIN certificate", "PDF, JPG or PNG, up to 5 MB")}
        ${docBtn("id", "Representative's ID", "Fayda digital ID, kebele ID or passport")}
        <button class="consent" data-act="consent"><span class="box2 ${S.consent ? "on" : ""}">${S.consent ? ic("check") : ""}</span><span>I confirm this information is accurate and agree that ethio telecom may verify it and process it under its advertising terms and privacy policy.</span></button>
      </div></div></div>
      <div class="foot"><button class="cta" data-act="kycsubmit" ${S.busy ? "disabled" : ""}>${S.busy ? "Submitting…" : "Submit for verification"}</button></div>`;
  }
  function contact() {
    return titlebar("Contact sales", "biz") + `<div class="body"><div class="mbody">
      <span class="verified">${ic("check")}Verified · ${esc(S.biz.legalName)}</span>
      <div class="form" style="margin-top:14px">
        <div class="flabel">Ad formats you're interested in <em style="color:#C0392B;font-style:normal">*</em></div>
        <div class="chips2">${S.formats.map((f) => `<button class="${S.fmts.includes(f.name) ? "on" : ""}" data-act="fmt:${esc(f.name)}">${esc(f.name)}</button>`).join("")}</div>
        <div class="flabel">Where</div>
        <div class="chips2">${AREAS.map((a) => `<button class="${S.areas.includes(a) ? "on" : ""}" data-act="area:${a}">${a}</button>`).join("")}</div>
        <div class="fld"><label>Monthly budget</label><select data-f="budget">${opts(["Under ETB 50,000", "ETB 50,000 – 200,000", "ETB 200,000 – 1 million", "Above ETB 1 million", "Not sure yet"], "budget")}</select></div>
        <div class="fld"><label>Preferred start date</label><input type="date" data-f="startDate" value="${fv("startDate")}"></div>
        <div class="flabel">How should we contact you?</div>
        <div class="chips2">${["Call", "SMS", "Email"].map((c) => `<button class="${S.cby === c ? "on" : ""}" data-act="cby:${c}">${c}</button>`).join("")}</div>
        <div class="fld"><label>Message</label><textarea data-f="message" placeholder="Tell us about your campaign" maxlength="2000">${fv("message")}</textarea></div>
      </div></div></div>
      <div class="foot"><button class="cta" data-act="leadsubmit" ${S.busy ? "disabled" : ""}>Send request</button></div>`;
  }
  function bizok() {
    return `<div class="body"><div class="ok">
      <div class="okc">${ic("check")}</div><h3>Request sent</h3>
      <div style="color:#6B7368;font-size:13px;margin-top:4px">Reference <b style="color:#1B1F1A">${esc(S.bizRef)}</b></div>
      <div class="howto" style="margin-top:16px"><b>What happens next</b><ol>
        <li>Our wifi.et business team reviews your request.</li>
        <li>We ${S.cby === "Call" ? "call" : S.cby === "SMS" ? "send an SMS to" : "email"} ${esc(S.f.contactPerson || "you")} to discuss it.</li>
        <li>We agree the campaign, hotspots and price, then your ads go live.</li></ol></div>
      <div class="rows" style="margin-top:14px;text-align:left"><div><span>Business</span><b>${esc(S.biz.legalName)}</b></div><div><span>Formats</span><b>${esc(S.fmts.join(", "))}</b></div><div><span>Where</span><b>${esc(S.areas.join(", ") || "Not specified")}</b></div><div><span>Budget</span><b>${esc(S.f.budget || "Not specified")}</b></div></div>
      <button class="cta" data-act="go:biz">Back to Business</button></div></div>`;
  }

  /* ---------- purchase result ---------- */
  function success() {
    const o = S.last, p = pk(o.packageId);
    return `<div class="body"><div class="ok">
      <div class="okc">${ic("check")}</div><h3>Payment successful</h3>
      <div class="big">${fmt(o.amount)}.00 ETB</div>
      <div style="color:#6B7368;font-size:13px">Paid to wifi.et${o.transId ? ` · Transaction ${esc(o.transId)}` : ""}</div>
      ${o.code ? `<div class="voucher"><img src="${LOGO}" alt="wifi.et"><div class="lbl">Your Wi-Fi code</div><div class="code">${esc(o.code)}</div>
        <div class="vrow"><span>${esc(p.name.replace("Wi-Fi ", ""))}</span><span>Valid ${esc(p.validity)}</span></div></div>`
      : `<div class="howto" style="margin:14px 0"><b>Your code is on its way</b>Payment received. Your Wi-Fi code will appear in My Wi-Fi and arrive by SMS in a moment.</div>`}
      <div class="howto"><b>How to connect</b><ol><li>At any hotspot, tap Connect in My Wi-Fi and scan the wifi.et sticker.</li><li>Or join the wifi.et network and enter the code on the login page.</li></ol></div>
      <div class="sms">${ic("sms")}<span>Code also sent by SMS to ${prettyMsisdn(o.to)}. Your package starts at first login.</span></div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
        <button class="cta" data-act="go:mine">View in My Wi-Fi</button><button class="cta ghost" data-act="go:home">Back to wifi.et</button></div>
    </div></div>`;
  }

  /* ---------- sheets ---------- */
  function sheet() {
    if (!S.sheet) return "";
    const wrap = (inner, dismiss = true, center = false) => `<div class="scrim" ${dismiss ? 'data-act="scrim"' : ""}><div class="sheet" data-stop ${center ? 'style="text-align:center"' : ""}>${inner}</div></div>`;
    const spinner = (t, sub) => wrap(`<div class="spin"></div><h4>${t}</h4><div class="sub">${sub}</div>`, false, true);
    if (S.sheet === "confirm") {
      const p = pk(S.sel), to = S.me && S.me.user.msisdn;
      return wrap(`<div class="grab"></div><h4>Confirm purchase</h4><div class="sub">Wi-Fi package</div>
        <div class="amt">${fmt(p.price)}.00 <small>ETB</small></div>
        <div class="rows"><div><span>Package</span><b>${esc(p.name)}</b></div><div><span>Data</span><b>${esc(p.data)}</b></div><div><span>Validity</span><b>${esc(p.validity)} from first login</b></div>
          <div><span>Where</span><b>All wifi.et hotspots</b></div><div><span>Code sent to</span><b>${to ? prettyMsisdn(to) : "—"}</b></div><div><span>Pay with</span><b>telebirr</b></div></div>
        <button class="cta" data-act="pay">Pay with telebirr</button><button class="cta ghost" style="margin-top:10px" data-act="close">Cancel</button>`);
    }
    if (S.sheet === "paying") return spinner("Opening telebirr…", "Confirm the payment and enter your PIN in telebirr");
    if (S.sheet === "confirming") return spinner("Confirming payment…", "This takes a few seconds");
    if (S.sheet === "phone") {
      return wrap(`<div class="grab"></div><h4>Number for Wi-Fi codes</h4><div class="sub">We send your Wi-Fi code to this number by SMS.</div>
        <div class="fld"><input id="msisdn" inputmode="tel" placeholder="0912 345 678" value="${esc(S.phone)}"></div>
        ${S.error ? `<div class="err">${esc(S.error)}</div>` : ""}
        <button class="cta" style="margin-top:14px" data-act="savephone">Save</button><button class="cta ghost" style="margin-top:10px" data-act="close">Cancel</button>`);
    }
    if (S.sheet === "connect") {
      return wrap(`<div class="grab"></div><h4>Connect to a hotspot</h4>
        <div class="sub">${window.WIFIET_CONFIG.scanMethod && Bridge.inSuperApp() ? "Scan the wifi.et sticker at the hotspot, or type the code printed under it." : "Type the hotspot code printed on the wifi.et sticker."}</div>
        ${window.WIFIET_CONFIG.scanMethod && Bridge.inSuperApp() ? `<button class="cta" data-act="scan">Scan QR code</button><div class="sub" style="margin:12px 0 6px">or</div>` : ""}
        <div class="fld"><input id="sticker" placeholder="Hotspot code, e.g. MESKEL" value="${esc(S.sticker)}" autocapitalize="characters"></div>
        ${S.error ? `<div class="err">${esc(S.error)}</div>` : ""}
        <button class="cta" style="margin-top:12px" data-act="stickergo">Connect</button><button class="cta ghost" style="margin-top:10px" data-act="close">Cancel</button>`, true, true);
    }
    if (S.sheet === "connecting") return spinner("Connecting…", "Logging you in at the hotspot");
    if (S.sheet === "connected") {
      return wrap(`<div class="okc">${ic("check")}</div><h4>Connected to wifi.et</h4><div class="sub">${esc(S.connected.hotspot.name)} · using ${esc(S.connected.pass.code)}<br>Your ${esc(S.connected.pass.validity)} package has started.</div><button class="cta" data-act="close">Done</button>`, true, true);
    }
    return "";
  }

  /* ---------- render ---------- */
  const SCREENS = { loading, blocked, devlogin: devLogin, home, hotspots, mine, profile, msgs, biz, kyc, contact, bizok, success };
  function render() {
    const scr = document.getElementById("screen");
    const keep = scr.querySelector(".body") ? scr.querySelector(".body").scrollTop : 0;
    const same = scr.dataset.s === S.screen;
    scr.innerHTML = SCREENS[S.screen]() + sheet() + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");
    scr.dataset.s = S.screen;
    if (same) { const b = scr.querySelector(".body"); if (b) b.scrollTop = keep; }
  }
  let toastT;
  function toast(m) { S.toast = m; render(); clearTimeout(toastT); toastT = setTimeout(() => { S.toast = null; render(); }, 2400); }

  /* ---------- data ---------- */
  async function loadAll() {
    const [me, passes, m, b] = await Promise.all([Api.me(), Api.passes(), Api.messages(), Api.business()]);
    S.me = me; S.passes = passes; S.msgs = m.messages; S.biz = b.business; S.formats = b.formats;
  }
  async function refreshMe() { try { await loadAll(); render(); } catch { /* keep current view */ } }

  async function boot() {
    S.screen = "loading"; S.error = null; render();
    try {
      const [h, p, hs] = await Promise.all([Api.health(), Api.packages(), Api.hotspots()]);
      S.packages = p.packages; S.hotspots = hs.hotspots; S.dev = h.mode === "mock";
      if (Bridge.inSuperApp()) {
        const token = await Bridge.getAccessToken();
        await finishLogin(await Api.login(token));
      } else if (S.dev) {
        S.screen = "devlogin"; render(); return;
      } else {
        S.screen = "blocked"; render(); return;
      }
    } catch (e) {
      S.error = e.message === "not-in-superapp" ? null : e.message; S.screen = "blocked"; render(); return;
    }
    Bridge.getLocation().then((loc) => { if (loc) { S.here = loc; render(); } });
  }
  async function finishLogin(r) {
    Api.setToken(r.token); S.user = r.user;
    await loadAll();
    S.screen = "home"; render();
    if (!S.me.user.msisdn) { S.sheet = "phone"; render(); }
  }
  Api.onAuthLost(() => { toast("Your session ended. Reopening…"); setTimeout(boot, 800); });

  /* ---------- purchase ---------- */
  async function pay() {
    if (!S.me.user.msisdn) { S.sheet = "phone"; render(); return; }
    S.sheet = "paying"; render();
    let order;
    try { order = await Api.createOrder(S.sel); }
    catch (e) { S.sheet = null; toast(e.message); return; }
    let result;
    if (Bridge.inSuperApp()) result = await Bridge.startPay(order.rawRequest);
    else if (S.dev) { await sleep(700); result = { paid: (await Api.devPay(order.orderId)).resultCode === "1" }; }
    S.sheet = "confirming"; render();
    // The server confirms with telebirr; poll until the code is issued.
    const tries = result && result.paid ? 20 : 3;
    for (let i = 0; i < tries; i++) {
      let o;
      try { o = (await Api.order(order.orderId)).order; } catch { o = null; }
      if (o && o.status === "FULFILLED") return done(o);
      if (o && o.status === "FAILED") break;
      if (o && o.status === "PAID" && i >= tries - 1) return done(o);
      await sleep(1500);
    }
    S.sheet = null;
    toast(result && result.paid ? "We're confirming your payment. Your code will arrive by SMS." : "Payment not completed. You have not been charged.");
    refreshMe();
  }
  async function done(o) {
    S.last = o; S.sheet = null; S.screen = "success"; render();
    refreshMe();
  }

  /* ---------- connect ---------- */
  async function connectWith(qrText) {
    S.sheet = "connecting"; S.error = null; render();
    try {
      S.connected = await Api.connect(S.connectFor, qrText);
      S.sheet = "connected"; render(); refreshMe();
    } catch (e) { S.sheet = "connect"; S.error = e.message; render(); }
  }

  /* ---------- KYC ---------- */
  function readDoc(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) { toast("Use a PDF, JPG or PNG file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast("The file must be under 5 MB"); return; }
    const r = new FileReader();
    r.onload = () => { S.docs[input.dataset.doc] = { name: file.name, dataUrl: r.result }; render(); };
    r.onerror = () => toast("Could not read the file");
    r.readAsDataURL(file);
  }
  async function submitKyc() {
    const f = S.f, miss = [];
    if (!f.legalName) miss.push("business name"); if (!f.businessType) miss.push("business type");
    if (!/^\d{10}$/.test(f.tin || "")) miss.push("10-digit TIN"); if (!f.licenseNo) miss.push("trade license no."); if (!f.contactPerson) miss.push("contact person");
    if (!(S.docs.license && S.docs.tin && S.docs.id)) miss.push("all 3 documents"); if (!S.consent) miss.push("consent");
    if (miss.length) { toast("Missing: " + miss.join(", ")); return; }
    S.busy = true; render();
    try {
      const r = await Api.submitKyc({ ...f, consent: true, documents: S.docs });
      S.biz = r.business; S.docs = {}; S.screen = "biz"; toast("Submitted for verification"); refreshMe();
    } catch (e) { toast(e.message); }
    finally { S.busy = false; render(); }
  }
  async function submitLead() {
    if (!S.fmts.length) { toast("Choose at least one ad format"); return; }
    S.busy = true; render();
    try {
      const r = await Api.sendLead({ formats: S.fmts, areas: S.areas, budget: S.f.budget, startDate: S.f.startDate, contactBy: S.cby, message: S.f.message });
      S.bizRef = r.ref; S.screen = "bizok";
    } catch (e) { toast(e.message); }
    finally { S.busy = false; render(); }
  }

  /* ---------- events ---------- */
  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    if (e.target.closest("[data-stop]") && el.dataset.act === "scrim") return;
    const [a, v] = el.dataset.act.split(/:(.*)/s);
    switch (a) {
      case "go": S.screen = v; S.sheet = null; S.error = null; render(); if (["mine", "msgs", "profile", "biz"].includes(v)) refreshMe(); break;
      case "btab": S.bTab = v; render(); break;
      case "buy": S.sel = v; S.screen = S.screen === "mine" ? "mine" : S.screen; S.sheet = "confirm"; render(); break;
      case "pay": pay(); break;
      case "close": case "scrim": S.sheet = null; S.error = null; render(); break;
      case "toast": toast(v); break;
      case "copy": try { await navigator.clipboard.writeText(v); toast("Code copied"); } catch { toast(`Your code: ${v}`); } break;
      case "hf": S.hFilter = v; render(); break;
      case "hopen": S.hOpen = S.hOpen === v ? null : v; render(); break;
      case "mf": S.mFilter = v; render(); break;
      case "msg": { const id = Number(v), m = S.msgs.find((x) => x.id === id); S.mOpen = S.mOpen === id ? null : id;
        if (m && !m.read) { m.read = true; if (S.me) S.me.unread = Math.max(0, S.me.unread - 1); Api.readMessages([id]).catch(() => {}); } render(); break; }
      case "readall": S.msgs.forEach((m) => (m.read = true)); if (S.me) S.me.unread = 0; render(); Api.readMessages().catch(() => {}); break;
      case "locate": { const loc = await Bridge.getLocation(); if (loc) { S.here = loc; render(); } else toast("Location is not available"); break; }
      case "connect": S.connectFor = v; S.sticker = ""; S.error = null; S.sheet = "connect"; render(); break;
      case "scan": { const t = await Bridge.scanQR(); if (t) connectWith(t); else toast("Could not scan. Type the code instead."); break; }
      case "stickergo": { const c = (document.getElementById("sticker").value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (!c) { S.error = "Enter the hotspot code"; render(); break; } connectWith(`wifiet://hotspot/${c}`); break; }
      case "sheet": S.sheet = v; S.error = null; S.phone = ""; render(); break;
      case "savephone": {
        S.phone = document.getElementById("msisdn").value;
        try { const r = await Api.setMsisdn(S.phone); S.me.user = r.user; S.sheet = S.sel && S.screen !== "profile" ? "confirm" : null; S.error = null; render(); toast("Number saved"); }
        catch (err) { S.error = err.message; render(); }
        break; }
      case "devlogin": {
        S.phone = document.getElementById("devphone").value;
        const d = S.phone.replace(/\D/g, ""); const n = d.startsWith("0") ? "251" + d.slice(1) : d.length === 9 ? "251" + d : d;
        if (!/^251[79]\d{8}$/.test(n)) { S.error = "Enter a valid Ethiopian mobile number"; render(); break; }
        try { await finishLogin(await Api.login(n)); Bridge.getLocation().then((loc) => { if (loc) { S.here = loc; render(); } }); }
        catch (err) { S.error = err.message; render(); }
        break; }
      case "retry": boot(); break;
      case "consent": S.consent = !S.consent; render(); break;
      case "kycsubmit": submitKyc(); break;
      case "fmt": S.fmts = S.fmts.includes(v) ? S.fmts.filter((x) => x !== v) : [...S.fmts, v]; render(); break;
      case "area": S.areas = S.areas.includes(v) ? S.areas.filter((x) => x !== v) : [...S.areas, v]; render(); break;
      case "cby": S.cby = v; render(); break;
      case "leadsubmit": submitLead(); break;
    }
  });
  const onField = (e) => { const k = e.target.dataset && e.target.dataset.f; if (k) S.f[k] = e.target.value; };
  document.addEventListener("input", onField);
  document.addEventListener("change", (e) => { onField(e); if (e.target.dataset && e.target.dataset.doc) readDoc(e.target); });

  boot();
})();
