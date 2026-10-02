(() => {
  if (globalThis.__mimitoysNetworkInstalled) return;
  globalThis.__mimitoysNetworkInstalled = true;
  function publish(body, requestUrl) {
    const ids =
      location.pathname.match(/-i\.(\d+)\.(\d+)\/?$/) ||
      location.pathname.match(/\/product\/(\d+)\/(\d+)\/?$/);
    if (!ids || !body?.data) return;
    const request = new URL(requestUrl, location.href);
    const itemId =
      request.searchParams.get("item_id") || request.searchParams.get("itemid");
    const shopId =
      request.searchParams.get("shop_id") || request.searchParams.get("shopid");
    if ((itemId && itemId !== ids[2]) || (shopId && shopId !== ids[1])) return;
    const queue = [body.data];
    let visited = 0;
    while (queue.length && visited++ < 5000) {
      const node = queue.shift();
      if (!node || typeof node !== "object") continue;
      const item = node.item_id ?? node.itemid;
      const shop = node.shop_id ?? node.shopid;
      if (
        String(item) === ids[2] &&
        (shop == null || String(shop) === ids[1]) &&
        Array.isArray(node.images)
      ) {
        const images = node.images
          .map((image) => {
            const value =
              typeof image === "string"
                ? image
                : image?.image_id || image?.image_url || image?.url;
            if (typeof value !== "string") return null;
            if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{5,200}$/.test(value))
              return `https://down-vn.img.susercontent.com/file/${value}`;
            try {
              const url = new URL(value);
              return url.protocol === "https:" &&
                url.hostname.endsWith(".img.susercontent.com") &&
                url.pathname.startsWith("/file/")
                ? url.href
                : null;
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        if (
          images.length &&
          images.length === node.images.length &&
          images.length <= 200
        ) {
          const gallery = {
            sourceUrl: location.href,
            title: typeof node.name === "string" ? node.name : undefined,
            images: [...new Set(images)],
            complete: true,
            method: "product-data",
          };
          const current = globalThis.__mimitoysProductGallery;
          if (
            !current ||
            current.sourceUrl !== gallery.sourceUrl ||
            gallery.images.length >= current.images.length
          ) {
            globalThis.__mimitoysProductGallery = gallery;
            window.postMessage(
              { channel: "mimitoys-product-gallery-v2", gallery },
              location.origin,
            );
          }
        }
      }
      for (const value of Object.values(node))
        if (value && typeof value === "object") queue.push(value);
    }
  }
  function eligible(value) {
    try {
      const url = new URL(value, location.href);
      return (
        url.origin === location.origin &&
        /\/api\/v\d+\/(pdp\/get_pc|item\/get)(?:$|\/)/.test(url.pathname)
      );
    } catch {
      return false;
    }
  }
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const response = originalFetch.apply(this, args);
    const url =
      typeof args[0] === "string" || args[0] instanceof URL
        ? String(args[0])
        : args[0]?.url;
    if (eligible(url))
      response
        .then((result) =>
          result
            .clone()
            .json()
            .then((body) => publish(body, url)),
        )
        .catch(() => {});
    return response;
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const requests = new WeakMap();
  XMLHttpRequest.prototype.open = function (...args) {
    requests.set(this, args[1]);
    return originalOpen.apply(this, args);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    const url = requests.get(this);
    if (eligible(url))
      this.addEventListener(
        "load",
        () => {
          try {
            if (this.responseType === "json") publish(this.response, url);
            else if (!this.responseType || this.responseType === "text")
              publish(JSON.parse(this.responseText), url);
          } catch {}
        },
        { once: true },
      );
    return originalSend.apply(this, args);
  };
})();
