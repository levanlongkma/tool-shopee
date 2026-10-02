import { validatePublicUrl } from "@/lib/validation/url";

const MAX_BYTES = 15 * 1024 * 1024;

export async function downloadImage(input: string): Promise<Buffer> {
  let current = input;
  for (let redirect = 0; redirect < 5; redirect++) {
    const url = await validatePublicUrl(current);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
      headers: {
        "user-agent": "Mozilla/5.0 MimiToysImageStudio/1.0",
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Ảnh chuyển hướng không hợp lệ.");
      current = new URL(location, url).href;
      continue;
    }
    if (!response.ok)
      throw new Error(`Không tải được ảnh (${response.status}).`);
    const contentType = response.headers.get("content-type") || "";
    if (!/^image\/(jpeg|png|webp|avif|gif|tiff|bmp)(;|$)/i.test(contentType))
      throw new Error("URL không trả về định dạng ảnh được hỗ trợ.");
    if (Number(response.headers.get("content-length")) > MAX_BYTES)
      throw new Error("Ảnh vượt quá 15 MB.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (!response.body) throw new Error("Ảnh trống.");
    const reader = response.body.getReader();
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Ảnh vượt quá 15 MB.");
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Ảnh chuyển hướng quá nhiều lần.");
}
