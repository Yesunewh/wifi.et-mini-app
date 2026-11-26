/* Thin client for the wifi.et API. */
(function () {
  const base = (window.WIFIET_CONFIG.apiBase || "").replace(/\/$/, "");
  let token = null;
  let onAuthLost = null;

  async function request(method, path, body) {
    let res;
    try {
      res = await fetch(base + path, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw Object.assign(new Error("No connection. Check your internet and try again."), { status: 0 });
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token && onAuthLost) { token = null; onAuthLost(); }
    if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong"), { status: res.status, code: data.code });
    return data;
  }

  window.Api = {
    setToken(t) { token = t; },
    onAuthLost(fn) { onAuthLost = fn; },
    health: () => request("GET", "/api/health"),
    login: (accessToken) => request("POST", "/api/auth/login", { accessToken }),
    me: () => request("GET", "/api/me"),
    setMsisdn: (msisdn) => request("PATCH", "/api/me", { msisdn }),
    packages: () => request("GET", "/api/packages"),
    hotspots: () => request("GET", "/api/hotspots"),
    passes: () => request("GET", "/api/me/passes"),
    messages: () => request("GET", "/api/me/messages"),
    readMessages: (ids) => request("POST", "/api/me/messages/read", ids ? { ids } : {}),
    createOrder: (packageId) => request("POST", "/api/orders", { packageId }),
    order: (id) => request("GET", "/api/orders/" + encodeURIComponent(id)),
    connect: (orderId, qr) => request("POST", "/api/passes/" + encodeURIComponent(orderId) + "/connect", { qr }),
    business: () => request("GET", "/api/business"),
    submitKyc: (data) => request("POST", "/api/business/kyc", data),
    sendLead: (data) => request("POST", "/api/business/leads", data),
    devPay: (id) => request("POST", "/api/dev/pay/" + encodeURIComponent(id)),
  };
})();
