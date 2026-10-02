let running = false;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function productKey(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "shopee.vn" ||
    url.username ||
    url.password
  )
    throw new Error("Chỉ hỗ trợ link sản phẩm tại https://shopee.vn.");
  const ids =
    url.pathname.match(/-i\.(\d+)\.(\d+)\/?$/) ||
    url.pathname.match(/\/product\/(\d+)\/(\d+)\/?$/);
  if (!ids)
    throw new Error("Không nhận diện được mã sản phẩm Shopee trong link.");
  return {
    key: `${ids[1]}.${ids[2]}`,
    url: `https://shopee.vn/product/${ids[1]}/${ids[2]}`,
  };
}

async function collect(message, sender) {
  const requested = productKey(message.url);
  if (running)
    throw new Error(
      "Chrome đang phân tích một sản phẩm khác. Hãy chờ hoàn tất.",
    );
  running = true;
  try {
    const existing = (
      await chrome.tabs.query({ url: "https://shopee.vn/*" })
    ).find((tab) => {
      try {
        return productKey(tab.url).key === requested.key;
      } catch {
        return false;
      }
    });
    const tab = existing
      ? await chrome.tabs.update(existing.id, { active: true })
      : await chrome.tabs.create({ url: requested.url, active: true });
    let previousDocument;
    if (existing) {
      const documents = await chrome.scripting
        .executeScript({ target: { tabId: tab.id }, func: () => true })
        .catch(() => []);
      previousDocument = documents[0]?.documentId;
      await chrome.tabs.reload(tab.id, { bypassCache: true });
      await delay(500);
    }
    const deadline = Date.now() + 120000;
    let previousState = "";
    let previousGallery = "";
    while (Date.now() < deadline) {
      const currentTab = await chrome.tabs.get(tab.id).catch(() => {
        throw new Error("Tab Shopee đã đóng. Hãy bấm Phân tích để mở lại.");
      });
      if (currentTab.status === "complete") {
        let data;
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["gallery.js"],
          });
          if (previousDocument && results[0]?.documentId === previousDocument) {
            await delay(750);
            continue;
          }
          data = results[0]?.result;
        } catch {
          // The tab may be navigating between Shopee pages.
        }
        if (data?.state === "error") throw new Error(data.error);
        if (data?.state === "ready") {
          if (productKey(data.gallery.sourceUrl).key !== requested.key)
            throw new Error("Tab Shopee đang hiển thị một sản phẩm khác.");
          const snapshot = JSON.stringify(data.gallery);
          if (snapshot === previousGallery) {
            await chrome.tabs
              .update(sender.tab.id, { active: true })
              .catch(() => {});
            return { type: "result", gallery: data.gallery };
          }
          previousGallery = snapshot;
        } else {
          previousGallery = "";
        }
        const state =
          data?.state === "collecting"
            ? `collecting-${data.count}`
            : data?.state || "loading";
        if (state !== previousState) {
          await chrome.tabs
            .sendMessage(sender.tab.id, {
              type: "status",
              id: message.id,
              text:
                state === "verify"
                  ? "Shopee yêu cầu xác minh. Hãy hoàn thành trong tab Chrome vừa mở; ứng dụng đang chờ."
                  : data?.state === "collecting"
                    ? `Đã đọc ${data.count} ảnh, đang quét phần còn lại của gallery…`
                    : "Chrome đang mở trang sản phẩm và đọc gallery…",
            })
            .catch(() => {});
          previousState = state;
        }
      }
      await delay(750);
    }
    throw new Error(
      "Chrome chưa đọc được gallery sau 2 phút. Hãy kiểm tra tab Shopee rồi thử lại.",
    );
  } finally {
    running = false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let origin;
  try {
    origin = new URL(sender.url).origin;
  } catch {
    return;
  }
  if (
    !["http://localhost:3000", "http://127.0.0.1:3000"].includes(origin) ||
    !sender.tab ||
    message?.type !== "gallery" ||
    typeof message.id !== "string" ||
    typeof message.url !== "string"
  )
    return;
  collect(message, sender)
    .then(sendResponse)
    .catch((error) => sendResponse({ type: "error", error: error.message }));
  return true;
});
