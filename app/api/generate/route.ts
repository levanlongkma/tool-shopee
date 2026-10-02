import { normalizeOutput, normalizeSource } from "@/lib/image/normalize";
import { editImage } from "@/lib/gemini/edit";
import type { Preset } from "@/types/product";

export const runtime = "nodejs";
export const maxDuration = 180;

const presets: Preset[] = [
  "mimitoys-standard",
  "mimitoys-no-text",
  "shopee-plain",
];

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const image = body.get("image");
    const preset = body.get("preset");
    if (
      !(image instanceof File) ||
      image.size > 15 * 1024 * 1024 ||
      !presets.includes(preset as Preset)
    )
      return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    const original = Buffer.from(await image.arrayBuffer());
    const normalized = await normalizeSource(original);
    const instruction = body.get("instruction");
    const generated = await editImage(
      normalized,
      preset as Preset,
      typeof instruction === "string" ? instruction : "",
    );
    const output = await normalizeOutput(generated);
    return new Response(new Uint8Array(output), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Không thể xử lý ảnh.",
      },
      { status: 500 },
    );
  }
}
