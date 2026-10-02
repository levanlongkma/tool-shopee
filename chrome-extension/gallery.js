(() => {
  const ids =
    location.pathname.match(/-i\.(\d+)\.(\d+)\/?$/) ||
    location.pathname.match(/\/product\/(\d+)\/(\d+)\/?$/);
  if (
    /\/(verify|captcha|challenge|buyer\/login)(\/|$)/i.test(location.pathname)
  )
    return { state: "verify" };
  if (!ids) return { state: "loading" };
  const key = `${ids[1]}.${ids[2]}`;
  // Shopee also delivers product data in the server-rendered MFE payload.
  // This contains the complete gallery even when only five thumbnails exist.
  for (const script of document.querySelectorAll(
    'script[type="text/mfe-initial-data"],script[type="application/json"],script#__NEXT_DATA__',
  )) {
    try {
      const queue = [JSON.parse(script.textContent)];
      let visited = 0;
      while (queue.length && visited++ < 10000) {
        let node = queue.shift();
        if (typeof node === "string" && /^[\s]*[\[{]/.test(node)) {
          try {
            node = JSON.parse(node);
          } catch {
            continue;
          }
        }
        if (!node || typeof node !== "object") continue;
        if (
          String(node.item_id ?? node.itemid) === ids[2] &&
          ((node.shop_id == null && node.shopid == null) ||
            String(node.shop_id ?? node.shopid) === ids[1]) &&
          Array.isArray(node.images) &&
          node.images.length > 0 &&
          node.images.length <= 200
        ) {
          const images = node.images.map((image) => {
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
          });
          if (images.every(Boolean))
            return {
              state: "ready",
              gallery: {
                sourceUrl: location.href,
                title: node.name || document.title,
                images: [...new Set(images)],
                complete: true,
                method: "embedded-product-data",
              },
            };
        }
        for (const value of Object.values(node))
          if (
            value &&
            (typeof value === "object" ||
              (typeof value === "string" && /^[\s]*[\[{]/.test(value)))
          )
            queue.push(value);
      }
    } catch {}
  }
  const captured = globalThis.__mimitoysProductGallery;
  if (captured?.complete && captured.images?.length) {
    const source = new URL(captured.sourceUrl).pathname;
    const sourceIds =
      source.match(/-i\.(\d+)\.(\d+)\/?$/) ||
      source.match(/\/product\/(\d+)\/(\d+)\/?$/);
    if (sourceIds && `${sourceIds[1]}.${sourceIds[2]}` === key)
      return {
        state: "ready",
        gallery: { ...captured, sourceUrl: location.href },
      };
  }
  if (window.scrollY > 300) {
    window.scrollTo(0, 0);
    return { state: "loading" };
  }
  const canonical = (value) => {
    try {
      const url = new URL(value);
      if (
        !url.hostname.endsWith(".img.susercontent.com") ||
        !url.pathname.startsWith("/file/") ||
        /_cover(?:@|$)/i.test(url.pathname)
      )
        return null;
      url.pathname = url.pathname.replace(/@[^/]+$/, "").replace(/_tn$/, "");
      url.search = "";
      return url.href;
    } catch {
      return null;
    }
  };
  const imageUrl = (image) =>
    [image.currentSrc, image.getAttribute("data-src"), image.src].find(
      (value) => value?.includes("img.susercontent.com/file/"),
    ) || image.src;
  const isThumbnail = (image) => {
    const candidates = [
      imageUrl(image),
      image.getAttribute("srcset"),
      image.closest("picture")?.querySelector("source")?.getAttribute("srcset"),
    ];
    return (
      candidates.some((value) =>
        /@resize_w(?:82|164)_nl(?:\.webp)?(?:\s|,|$)/i.test(value || ""),
      ) && !!canonical(imageUrl(image))
    );
  };
  const first = [...document.images].find((image) => {
    const rect = image.getBoundingClientRect();
    return (
      isThumbnail(image) &&
      rect.top >= -200 &&
      rect.top < 1200 &&
      canonical(imageUrl(image))
    );
  });
  if (!first) return { state: "loading" };
  let strip = first.closest(".Wi_1Rq") || first.parentElement;
  for (
    let i = 0;
    !first.closest(".Wi_1Rq") && i < 6 && strip.parentElement;
    i++
  ) {
    const rect = strip.parentElement.getBoundingClientRect();
    if (rect.height > 250 || rect.width > 900) break;
    strip = strip.parentElement;
  }
  let scan = globalThis.__mimitoysGalleryScan;
  if (!scan || scan.key !== key)
    scan = globalThis.__mimitoysGalleryScan = {
      key,
      images: new Set(),
      pages: new Set(),
      pending: false,
      stalled: 0,
      clicks: 0,
    };
  const thumbs = [...strip.querySelectorAll("img")].filter(
    (image) => isThumbnail(image) && canonical(imageUrl(image)),
  );
  const before = scan.images.size;
  for (const image of thumbs) scan.images.add(canonical(imageUrl(image)));
  const rect = strip.getBoundingClientRect();
  const visible = thumbs
    .filter((image) => {
      const box = image.getBoundingClientRect();
      return box.width > 0 && box.right > rect.left && box.left < rect.right;
    })
    .map(
      (image) =>
        `${canonical(imageUrl(image))}:${Math.round(image.getBoundingClientRect().left)}`,
    )
    .join("|");
  const title =
    document.querySelector("h1")?.textContent?.trim() ||
    document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content") ||
    document.title;
  const ready = () => ({
    state: "ready",
    gallery: {
      sourceUrl: location.href,
      title,
      images: [...scan.images],
      complete: true,
      method: "carousel",
    },
  });
  const selectors =
    'button[aria-label*="next" i], button[aria-label*="tiếp" i], [role="button"][aria-label*="next" i], .image-carousel__arrow--next, [data-testid*="next" i], svg.icon-arrow-right, svg[class*="arrow-right"], [class*="carousel"] [class*="next"]';
  let controlRoot = strip;
  if (!strip.querySelector(selectors)) {
    for (
      let parent = strip.parentElement, depth = 0;
      parent && depth < 4;
      parent = parent.parentElement, depth++
    ) {
      const box = parent.getBoundingClientRect();
      if (box.width > 900 || box.height > 1500) break;
      controlRoot = parent;
      if (
        [...parent.querySelectorAll("img")].some(
          (image) => image.getBoundingClientRect().height >= 200,
        )
      )
        break;
    }
  }
  const controls = [...controlRoot.querySelectorAll(selectors)].map(
    (element) =>
      element.tagName.toLowerCase() === "svg"
        ? element.closest('button,[role="button"]') || element.parentElement
        : element,
  );
  if (!controls.length) {
    for (const element of controlRoot.querySelectorAll(
      "button.shopee-icon-button",
    )) {
      const target =
        element.tagName.toLowerCase() === "svg"
          ? element.closest('button,[role="button"]') || element.parentElement
          : element;
      const box = target.getBoundingClientRect();
      if (
        box.width > 0 &&
        !target.closest(".qIctnQ, #sx-inject-download-image") &&
        box.width <= 80 &&
        box.height <= 120 &&
        box.left + box.width / 2 > rect.left + rect.width * 0.7
      )
        controls.push(target);
    }
  }
  const next = controls
    .sort(
      (a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left,
    )
    .find((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        box.width > 0 &&
        box.height > 0 &&
        box.top + box.height / 2 >= rect.top - 30 &&
        box.top + box.height / 2 <= rect.bottom + 30 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        Number(style.opacity) > 0
      );
    });
  const disabled =
    next &&
    (next.disabled ||
      next.getAttribute("aria-disabled") === "true" ||
      next.classList.contains("disabled") ||
      /(?:^|[\s_-])disabled(?:$|[\s_-])/.test(
        next.className?.baseVal || String(next.className),
      ) ||
      getComputedStyle(next).pointerEvents === "none");
  if (!next || disabled) return ready();
  if (scan.pending && visible === scan.previousPage) {
    if (++scan.stalled >= 4)
      return {
        state: "error",
        error:
          "Không thể chuyển đến hết gallery Shopee. Hãy tải lại tab sản phẩm và thử lại.",
      };
    return { state: "collecting", count: scan.images.size };
  }
  if (scan.pending && scan.pages.has(visible) && scan.images.size === before)
    return ready();
  scan.pages.add(visible);
  scan.previousPage = visible;
  scan.pending = true;
  scan.stalled = 0;
  if (++scan.clicks > 100)
    return {
      state: "error",
      error: "Gallery chưa quét hết sau 100 lần chuyển trang.",
    };
  next.click();
  return { state: "collecting", count: scan.images.size };
})();
