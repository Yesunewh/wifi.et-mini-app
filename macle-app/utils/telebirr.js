// Calls into the telebirr SuperApp.
const config = require("./config");

// SuperApp-specific APIs (getMiniAppToken, startPay) are exposed either directly on `ma`
// or through ma.native / ma.callNativeAPI, depending on the SuperApp version.
function callSuperApp(name, params) {
  return new Promise((resolve, reject) => {
    if (typeof ma[name] === "function") {
      ma[name](Object.assign({}, params, { success: resolve, fail: (e) => reject(e || new Error(name + " failed")) }));
    } else if (typeof ma.native === "function") {
      ma.native(name, params).then(resolve).catch(reject);
    } else if (typeof ma.callNativeAPI === "function") {
      ma.callNativeAPI(name, params, resolve, reject);
    } else {
      const err = new Error(name + " is not available here");
      err.unavailable = true;
      reject(err);
    }
  });
}

module.exports = {
  // Access token for /payment/v1/auth/authToken (developer portal: "MiniAPP Get Access Token").
  getAccessToken() {
    return callSuperApp("getMiniAppToken", { appId: config.merchantAppId }).then((r) => {
      const t = r && (r.token || r.access_token || (r.data && r.data.token));
      if (!t) throw new Error("telebirr did not return an access token");
      return t;
    });
  },
  // Opens the telebirr checkout (developer portal: "Start Pay Order"). Resolves { paid }.
  startPay(rawRequest) {
    return callSuperApp("startPay", { rawRequest: String(rawRequest).trim(), bussinessType: "BuyGoods" })
      .then((r) => ({ paid: !!r && String(r.resultCode) === "1", resultCode: r && r.resultCode }))
      .catch((e) => { if (e && e.unavailable) throw e; return { paid: false }; });
  },
};
