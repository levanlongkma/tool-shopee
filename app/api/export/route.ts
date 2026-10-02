import JSZip from "jszip";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form
      .getAll("images")
      .filter((value): value is File => value instanceof File);
    if (!files.length || files.length > 10)
      return Response.json({ error: "Chọn từ 1 đến 10 ảnh." }, { status: 400 });
    const zip = new JSZip();
    const metadata: {
      sourceUrl: string;
      preset: string;
      generatedAt: string;
      images: Array<{ filename: string; source: string }>;
    } = {
      sourceUrl: String(form.get("sourceUrl") || ""),
      preset: String(form.get("preset") || ""),
      generatedAt: new Date().toISOString(),
      images: [],
    };
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== "image/png" || file.size > 15 * 1024 * 1024)
        return Response.json(
          { error: "Ảnh xuất không hợp lệ." },
          { status: 400 },
        );
      const filename = `${String(i + 1).padStart(2, "0")}-mimitoys.png`;
      zip.file(filename, await file.arrayBuffer());
      metadata.images.push({
        filename,
        source: String(form.getAll("sources")[i] || ""),
      });
    }
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));
    const output = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          'attachment; filename="mimitoys-product-images.zip"',
      },
    });
  } catch {
    return Response.json({ error: "Không thể tạo ZIP." }, { status: 500 });
  }
}
