const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const { chromium } = require("playwright");

(async () => {
  const extension = path.resolve(__dirname, "..", "chrome-extension");
  const profile = path.resolve(
    __dirname,
    "..",
    ".mimitoys",
    "chrome-helper-test",
  );
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const shop = "12345678",
    item = "87654321";
  const productUrl = `https://shopee.vn/product/${shop}/${item}`;
  const cache = path.resolve(
    __dirname,
    "..",
    ".mimitoys",
    "shopee-cache",
    `${shop}.${item}.json`,
  );
  const title = "MimiToys full gallery fixture";
  const ids = [
    "vn-11134207-81ztc-mlzqymky6yv8d7",
    "vn-11134207-81ztc-mnckow466lflb3",
    "vn-11134207-81ztc-mlzrkmaj1s780c",
    "vn-11134207-81ztc-mlzsdy6i3gg8cb",
    "vn-11134207-820l4-minv91u4p7uq0c",
    "vn-11134207-820l4-minsku2vhdz4d9",
    "vn-11134207-820l4-mgxri2w0kxsbfd",
    "vn-11134207-820l4-mgxri2vy08axb9",
    "vn-11134207-81ztc-mlzrw8o5e29t6d",
  ];
  const images = ids.map(
    (id) => `https://down-vn.img.susercontent.com/file/${id}`,
  );
  let mode = "carousel",
    verified = false;
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker"));
    assert.ok(worker.url().startsWith("chrome-extension://"));
    await context.route("https://*.img.susercontent.com/**", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxKcAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    await context.route("https://shopee.vn/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/")) {
        return route.fulfill({
          json: {
            data: {
              item: {
                item_id: Number(item),
                shop_id: Number(shop),
                name: title,
                images: ids,
              },
              recommendations: [
                {
                  item_id: 99999999,
                  shop_id: Number(shop),
                  images: ["unrelated-product-image"],
                },
              ],
            },
          },
        });
      }
      if (url.pathname.startsWith("/verify/") || !verified)
        return route.fulfill({
          contentType: "text/html",
          body: "<h1>Verification fixture</h1>",
        });
      const endpoint =
        mode === "xhr"
          ? `/api/v4/item/get?itemid=${item}&shopid=${shop}`
          : `/api/v4/pdp/get_pc?item_id=${item}&shop_id=${shop}`;
      const capture =
        mode === "carousel" || mode === "embedded"
          ? ""
          : mode === "xhr"
            ? `const xhr=new XMLHttpRequest();xhr.open('GET',${JSON.stringify(endpoint)});xhr.responseType='json';xhr.onload=()=>window.websiteImageCount=xhr.response.data.item.images.length;xhr.send();`
            : `fetch(${JSON.stringify(endpoint)}).then(r=>r.json()).then(body=>window.websiteImageCount=body.data.item.images.length);`;
      const embedded =
        mode === "embedded"
          ? `<script type="text/mfe-initial-data">${JSON.stringify({ payload: JSON.stringify({ item: { item_id: Number(item), shop_id: Number(shop), name: title, images: ids }, recommendations: [{ item_id: 99999999, images: ["unrelated-product-image"] }] }) })}</script>`
          : "";
      const body = `<meta charset="utf-8">${embedded}<h1>${title}</h1><div style="width:460px;height:520px"><img style="width:320px;height:320px" src="${images[0]}_tn"><div id="strip" class="Wi_1Rq" style="position:relative;width:460px;height:100px"><div id="thumbs" style="display:flex"></div><button class="shopee-icon-button" style="position:absolute;right:0;top:20px;width:30px;height:40px">›</button></div></div><div style="height:400px">Reviews</div><img style="width:82px;height:82px" src="https://down-vn.img.susercontent.com/file/unrelated-review-image@resize_w82_nl.webp"><script>
      const all=${JSON.stringify(images)};let index=0;
      function render(){document.getElementById('thumbs').innerHTML=all.slice(index,index+4).map(src=>'<div class="qIctnQ" style="position:relative"><picture><source type="image/webp" srcset="'+src+'@resize_w82_nl.webp 1x, '+src+'@resize_w164_nl.webp 2x"><img width="82" height="82" src="'+src+'" srcset="'+src+'@resize_w82_nl 1x, '+src+'@resize_w164_nl 2x"></picture><div id="sx-inject-download-image" style="position:absolute;right:0;top:0"><button>Download</button></div></div>').join('')+'<img style="width:82px;height:82px" src="https://down-vn.img.susercontent.com/file/video_cover@resize_w82_nl.webp">';document.querySelector('.shopee-icon-button').disabled=index+4>=all.length;}
      document.querySelector('.shopee-icon-button').onclick=()=>{index+=4;render()};render();${capture}</script>`;
      return route.fulfill({ contentType: "text/html; charset=utf-8", body });
    });
    const app = await context.newPage();
    await app.goto("http://localhost:3000/");
    await app.getByText("Chrome đã kết nối", { exact: false }).waitFor();
    await app
      .getByPlaceholder("https://shopee.vn/ten-san-pham...")
      .fill(productUrl);
    const newTab = context.waitForEvent("page");
    const firstResult = app.waitForResponse(
      (r) =>
        r.url().endsWith("/api/analyze") && r.request().method() === "POST",
    );
    await app.getByRole("button", { name: "Phân tích", exact: true }).click();
    const product = await newTab;
    await product.goto("https://shopee.vn/verify/traffic/error");
    await app
      .getByText(
        "Shopee yêu cầu xác minh. Hãy hoàn thành trong tab Chrome vừa mở; ứng dụng đang chờ.",
        { exact: true },
      )
      .waitFor({ timeout: 15000 });
    verified = true;
    await product.goto(productUrl);
    const response = await firstResult;
    assert.equal(response.status(), 200, await response.text());
    assert.equal(response.request().postDataJSON().gallery.method, "carousel");
    assert.deepEqual(
      (await response.json()).images.map((image) => image.url),
      images,
    );
    assert.equal(await app.locator('img[src^="/api/image"]').count(), 9);
    for (const captureMode of ["fetch", "xhr", "embedded"]) {
      mode = captureMode;
      const capturePage = await context.newPage();
      await capturePage.goto(productUrl);
      if (captureMode !== "embedded")
        await capturePage.waitForFunction(() => window.websiteImageCount === 9);
      const gallery = await worker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({ url });
        const tab = tabs.sort((a, b) => b.id - a.id)[0];
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["gallery.js"],
        });
        return result[0].result.gallery;
      }, productUrl);
      assert.equal(
        gallery.method,
        captureMode === "embedded" ? "embedded-product-data" : "product-data",
      );
      const result = await context.request.post(
        "http://localhost:3000/api/analyze",
        { data: { url: productUrl, gallery } },
      );
      assert.equal(result.status(), 200, await result.text());
      assert.deepEqual(
        (await result.json()).images.map((image) => image.url),
        images,
      );
      await capturePage.close();
    }
    for (const gallery of [
      {
        sourceUrl: "https://shopee.vn/product/12345678/00000000",
        images,
        complete: true,
      },
      {
        sourceUrl: productUrl,
        images: ["http://127.0.0.1/private.jpg"],
        complete: true,
      },
      { sourceUrl: productUrl, images: images.slice(0, 4) },
    ]) {
      const rejected = await context.request.post(
        "http://localhost:3000/api/analyze",
        { data: { url: productUrl, gallery } },
      );
      assert.equal(rejected.status(), 400);
    }
    console.log(
      "PASS: 9 images across 3 carousel pages using picture/srcset thumbnails and Shopee icon buttons; injected download buttons ignored; full 9 images from fetch/XHR and embedded MFE JSON with only 4 thumbnails rendered; video/review/recommendation images excluded; verification wait and partial/mismatched/unsafe galleries checked. Shopee responses were mocked.",
    );
  } finally {
    await context.close();
    await fs.unlink(cache).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
