(() => {
  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.channel !== "mimitoys-product-gallery-v2"
    )
      return;
    const gallery = event.data.gallery;
    if (
      gallery?.complete === true &&
      typeof gallery.sourceUrl === "string" &&
      Array.isArray(gallery.images) &&
      gallery.images.length <= 200
    )
      globalThis.__mimitoysProductGallery = gallery;
  });
})();
