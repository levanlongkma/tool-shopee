import { downloadImage } from "@/lib/image/download";
import sharp from "sharp";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url).searchParams.get("url");
    if (!url) return new Response("Missing URL", { status: 400 });
    const image = await downloadImage(url);
    const jpeg = await sharp(image, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Image unavailable", { status: 400 });
  }
}
