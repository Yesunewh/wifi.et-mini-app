// Client for the wifi.et server, on top of ma.request.
const config = require("./config");

let token = "";

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const header = { "Content-Type": "application/json" };
    if (token) header.Authorization = "Bearer " + token;
    ma.request({
      url: config.apiBase + path,
      method,
      data: data || {},
      dataType: "json",
      header,
      success: (res) => {
        let body = res.data;
        if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
        body = body || {};
        const status = res.statusCode || (body.error ? 400 : 200);
        if (status >= 400) { const err = new Error(body.error || "Something went wrong"); err.status = status; err.code = body.code; reject(err); }
        else resolve(body);
      },
      fail: () => { const err = new Error("No connection. Check your internet and try again."); err.status = 0; reject(err); },
    });
  });
}

module.exports = {
  setToken(t) { token = t || ""; },
  hasToken() { return !!token; },
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
  order: (id) => request("GET", "/api/orders/" + id),
  connect: (orderId, qr) => request("POST", "/api/passes/" + orderId + "/connect", { qr }),
  business: () => request("GET", "/api/business"),
  submitKyc: (data) => request("POST", "/api/business/kyc", data),
  sendLead: (data) => request("POST", "/api/business/leads", data),
  devPay: (id) => request("POST", "/api/dev/pay/" + id),
};
