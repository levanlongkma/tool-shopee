const puppeteer = require("puppeteer-core");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await puppeteer.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900 });
    const directory = path.join(__dirname, "..", "chrome-extension");
    await page.evaluateOnNewDocument(
      await fs.readFile(path.join(directory, "product-network.js"), "utf8"),
    );
    const reader = await fs.readFile(
      path.join(directory, "gallery.js"),
      "utf8",
    );
    const response = await page.goto(process.argv[2], {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || response.status() >= 400)
      throw new Error("Không thể truy cập trang sản phẩm Shopee.");
    await page
      .waitForFunction(
        () =>
          globalThis.__mimitoysProductGallery ||
          document.querySelector('img[src*="@resize_w82_nl.webp"]') ||
          /\/verify\//.test(location.pathname),
        { timeout: 15000 },
      )
      .catch(() => {});
    const deadline = Date.now() + 30000;
    let previous = "";
    while (Date.now() < deadline) {
      const result = await page.evaluate(reader);
      if (result.state === "verify")
        throw new Error("Shopee yêu cầu xác minh truy cập.");
      if (result.state === "error") throw new Error(result.error);
      if (result.state === "ready") {
        const snapshot = JSON.stringify(result.gallery);
        if (snapshot === previous) {
          process.stdout.write(snapshot);
          return;
        }
        previous = snapshot;
      } else previous = "";
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(
      "Chưa đọc được toàn bộ gallery Shopee. Hãy dùng Chrome Helper để phân tích lại.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
