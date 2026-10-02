import { chromium } from "playwright";
import type { AnalyzeResult, ProductImage } from "@/types/product";
import { validatePublicUrl } from "@/lib/validation/url";

type Candidate = {
  url: string;
  width: number;
  height: number;
  score: number;
  source: string;
};

function normalizedImageUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(width|height|w|h|quality|q|format|size|_)?$/i.test(key))
      url.searchParams.delete(key);
  }
  return url.href;
}

export async function crawlGeneric(input: string): Promise<AnalyzeResult> {
  const url = await validatePublicUrl(input);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1365, height: 900 },
      serviceWorkers: "block",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    await context.route("**/*", async (route) => {
      try {
        await validatePublicUrl(route.request().url());
        await route.continue();
      } catch {
        await route.abort();
      }
    });
    const page = await context.newPage();
    let response;
    try {
      response = await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
      if (!response || response.status() >= 400)
        throw new Error("Không thể truy cập trang sản phẩm tự động.");
      await page.waitForTimeout(1600);
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(350);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    } catch {
      throw new Error("Không thể truy cập trang sản phẩm tự động.");
    }

    if (
      /\/(verify|captcha|challenge)(\/|$)/i.test(new URL(page.url()).pathname)
    ) {
      throw new Error("Trang sản phẩm yêu cầu xác minh truy cập.");
    }

    const result = await page.evaluate(() => {
      const title =
        document
          .querySelector('meta[property="og:title"]')
          ?.getAttribute("content") || document.title;
      const candidates: Candidate[] = [];
      const add = (
        value: string | null | undefined,
        width: number,
        height: number,
        score: number,
        source: string,
      ) => {
        if (!value) return;
        try {
          const absolute = new URL(value, location.href);
          if (!["http:", "https:"].includes(absolute.protocol)) return;
          candidates.push({ url: absolute.href, width, height, score, source });
        } catch {
          /* ignore malformed candidate */
        }
      };
      document.querySelectorAll("img").forEach((img) => {
        const rect = img.getBoundingClientRect();
        const width = img.naturalWidth || Math.round(rect.width);
        const height = img.naturalHeight || Math.round(rect.height);
        if (width < 180 || height < 180) return;
        const parent = img.closest(
          "main, article, [class*='product'], [class*='gallery'], [class*='image']",
        );
        const score =
          (parent ? 2 : 0) +
          (rect.top < 1300 ? 2 : 0) +
          (width >= 500 && height >= 500 ? 2 : 0);
        add(img.currentSrc || img.src, width, height, score, "page");
        for (const attr of ["data-src", "data-original", "data-zoom-image"])
          add(img.getAttribute(attr), width, height, score + 1, "page");
      });
      document
        .querySelectorAll<HTMLElement>("[style*='background-image']")
        .forEach((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.width < 60 || rect.height < 60 || rect.top > 1500) return;
          const image = element.style.backgroundImage.match(
            /url\(["']?(.*?)["']?\)/,
          )?.[1];
          add(
            image,
            Math.round(rect.width),
            Math.round(rect.height),
            3,
            "page background",
          );
        });
      add(
        document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute("content"),
        0,
        0,
        8,
        "og:image",
      );
      document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((script) => {
          try {
            const parsed = JSON.parse(script.textContent || "null");
            const values = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of values) {
              const products = item?.["@graph"] || [item];
              for (const product of products) {
                if (!String(product?.["@type"] || "").includes("Product"))
                  continue;
                const images = Array.isArray(product.image)
                  ? product.image
                  : [product.image];
                for (const image of images)
                  add(
                    typeof image === "string" ? image : image?.url,
                    0,
                    0,
                    9,
                    "structured data",
                  );
              }
            }
          } catch {
            /* ignore malformed metadata */
          }
        });
      return { title, candidates };
    });

    const seen = new Set<string>();
    const images: ProductImage[] = [];
    for (const item of result.candidates.sort((a, b) => b.score - a.score)) {
      if (images.length >= 30) break;
      try {
        const imageUrl = await validatePublicUrl(item.url);
        const key = normalizedImageUrl(imageUrl.href);
        if (seen.has(key)) continue;
        seen.add(key);
        images.push({
          id: `image-${images.length + 1}`,
          url: imageUrl.href,
          width: item.width || undefined,
          height: item.height || undefined,
          source: item.source,
        });
      } catch {
        /* drop unsafe candidates */
      }
    }
    return { title: result.title, images };
  } finally {
    await browser.close();
  }
}
