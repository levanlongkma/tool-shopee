import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AnalyzeResult, ProductImage } from "@/types/product";
import { validatePublicUrl } from "@/lib/validation/url";

const execFileAsync = promisify(execFile);

function productIds(url: URL): RegExpMatchArray | null {
  if (url.hostname !== "shopee.vn") return null;
  return (
    url.pathname.match(/-i\.(\d+)\.(\d+)\/?$/) ||
    url.pathname.match(/\/product\/(\d+)\/(\d+)\/?$/)
  );
}

function cachePath(url: URL): string | null {
  const match = productIds(url);
  return match
    ? path.join(
        process.cwd(),
        ".mimitoys",
        "shopee-cache",
        `${match[1]}.${match[2]}.json`,
      )
    : null;
}

function navigationUrl(url: URL): string {
  const match = productIds(url);
  if (!match) return url.href;
  return `https://shopee.vn/product/${match[1]}/${match[2]}`;
}

async function readCache(url: URL): Promise<AnalyzeResult | null> {
  const file = cachePath(url);
  if (!file) return null;
  try {
    const cached = JSON.parse(await readFile(file, "utf8")) as AnalyzeResult & {
      savedAt: string;
      galleryVersion?: number;
    };
    if (
      cached.galleryVersion !== 3 ||
      !Number.isFinite(Date.parse(cached.savedAt)) ||
      Date.now() - Date.parse(cached.savedAt) > 30 * 24 * 60 * 60 * 1000
    )
      return null;
    if (
      !Array.isArray(cached.images) ||
      !cached.images.length ||
      cached.images.length > 200
    )
      return null;
    for (const image of cached.images) await validatePublicUrl(image.url);
    return { title: cached.title, images: cached.images };
  } catch {
    return null;
  }
}

async function saveCache(url: URL, result: AnalyzeResult): Promise<void> {
  const file = cachePath(url);
  if (!file) return;
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      JSON.stringify({
        ...result,
        savedAt: new Date().toISOString(),
        galleryVersion: 3,
      }),
      "utf8",
    );
  } catch {
    /* The gallery can still be used without a cache. */
  }
}

function fullSizeImage(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !url.hostname.endsWith(".img.susercontent.com") ||
      !url.pathname.startsWith("/file/")
    )
      return null;
    url.pathname = url.pathname
      .replace(/@resize_w\d+_nl\.webp$/i, "")
      .replace(/_tn$/i, "");
    url.search = "";
    return url.href;
  } catch {
    return null;
  }
}

async function normalizeGallery(
  title: string | undefined,
  candidates: string[],
): Promise<AnalyzeResult> {
  const seen = new Set<string>();
  const images: ProductImage[] = [];
  for (const candidate of candidates) {
    const full = fullSizeImage(candidate);
    if (!full || seen.has(full)) continue;
    await validatePublicUrl(full);
    seen.add(full);
    images.push({
      id: `image-${images.length + 1}`,
      url: full,
      source: "Shopee gallery",
    });
  }
  if (!images.length)
    throw new Error("Không tìm thấy ảnh gallery của sản phẩm Shopee.");
  return { title, images };
}

export async function saveBrowserGallery(
  input: string,
  gallery: unknown,
): Promise<AnalyzeResult> {
  const url = await validatePublicUrl(input);
  const requested = productIds(url);
  if (!requested || !gallery || typeof gallery !== "object")
    throw new Error("Gallery Shopee không hợp lệ.");
  const data = gallery as {
    sourceUrl?: unknown;
    title?: unknown;
    images?: unknown;
    complete?: unknown;
  };
  if (data.complete !== true)
    throw new Error(
      "Gallery chưa quét hết. Hãy cập nhật MimiToys Chrome Helper và tải lại trang.",
    );
  if (
    typeof data.sourceUrl !== "string" ||
    !Array.isArray(data.images) ||
    !data.images.length ||
    data.images.length > 200 ||
    data.images.some(
      (image) => typeof image !== "string" || image.length > 2048,
    ) ||
    (data.title !== undefined &&
      (typeof data.title !== "string" || data.title.length > 500))
  )
    throw new Error("Gallery Shopee không hợp lệ.");
  const source = productIds(await validatePublicUrl(data.sourceUrl));
  if (!source || requested[1] !== source[1] || requested[2] !== source[2])
    throw new Error("Gallery không thuộc sản phẩm đã yêu cầu.");
  const result = await normalizeGallery(
    data.title as string | undefined,
    data.images as string[],
  );
  await saveCache(url, result);
  return result;
}

export async function crawlShopee(input: string): Promise<AnalyzeResult> {
  const url = await validatePublicUrl(input);
  const cached = await readCache(url);
  if (cached) return cached;
  let raw: string;
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        path.join(process.cwd(), "scripts", "shopee-crawl.cjs"),
        navigationUrl(url),
      ],
      { timeout: 90000, maxBuffer: 1024 * 1024 },
    );
    raw = stdout;
  } catch (error) {
    const detail =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr).trim()
        : "";
    throw new Error(detail || "Không thể lấy ảnh sản phẩm Shopee.");
  }
  const extracted = JSON.parse(raw) as {
    title: string;
    images: string[];
    complete?: boolean;
  };
  if (extracted.complete !== true)
    throw new Error("Chưa đọc được toàn bộ gallery Shopee.");
  const result = await normalizeGallery(extracted.title, extracted.images);
  await saveCache(url, result);
  return result;
}
