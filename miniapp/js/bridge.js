/* Bridge to the telebirr SuperApp (window.ma from js-sdk.min.js). */
(function () {
  const cfg = window.WIFIET_CONFIG;
  const hasMa = () => !!(window.ma && typeof window.ma.native === "function");

  window.Bridge = {
    inSuperApp: hasMa,

    /** Developer portal: "MiniAPP Get Access Token" → ma.native("getMiniAppToken", { appId }). */
    async getAccessToken() {
      if (!hasMa()) throw new Error("not-in-superapp");
      const r = await window.ma.native("getMiniAppToken", { appId: cfg.merchantAppId });
      const token = r && (r.token || r.access_token || (r.data && r.data.token));
      if (!token) throw new Error("No access token from telebirr");
      return token;
    },

    /**
     * Developer portal: "Start Pay Order" → ma.native("startPay", { rawRequest, bussinessType: "BuyGoods" }).
     * Resolves to { paid: boolean, resultCode }. The server still confirms the payment with telebirr.
     */
    async startPay(rawRequest) {
      if (!hasMa()) throw new Error("not-in-superapp");
      try {
        const r = await window.ma.native("startPay", { rawRequest, bussinessType: "BuyGoods" });
        return { paid: !!r && String(r.resultCode) === "1", resultCode: r && r.resultCode };
      } catch (e) {
        return { paid: false, resultCode: "error", error: e };
      }
    },

    /** QR scan through the SuperApp, if its API name is configured. Returns the scanned text or null. */
    async scanQR() {
      if (!hasMa() || !cfg.scanMethod) return null;
      try {
        const r = await window.ma.native(cfg.scanMethod, {});
        return (r && (r.result || r.code || r.text || r.data)) || null;
      } catch { return null; }
    },

    /** Device location via the web API (works in most webviews if the SuperApp allows it). */
    getLocation(timeoutMs = 6000) {
      return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        const t = setTimeout(() => resolve(null), timeoutMs + 500);
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(t); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
          () => { clearTimeout(t); resolve(null); },
          { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300000 }
        );
      });
    },
  };
})();
