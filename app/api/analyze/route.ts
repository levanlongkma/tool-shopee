import { NextResponse } from "next/server";
import { crawlProduct } from "@/lib/crawler";
import { saveBrowserGallery } from "@/lib/crawler/shopee";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.url !== "string")
      return NextResponse.json({ error: "URL không hợp lệ." }, { status: 400 });
    const result =
      body.gallery !== undefined
        ? await saveBrowserGallery(body.url, body.gallery)
        : await crawlProduct(body.url);
    if (!result.images.length)
      return NextResponse.json(
        { error: "Không tìm thấy ảnh sản phẩm phù hợp." },
        { status: 404 },
      );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không thể phân tích trang sản phẩm.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
