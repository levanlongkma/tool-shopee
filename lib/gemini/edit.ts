import { buildPrompt } from "./prompts";
import type { Preset } from "@/types/product";

type ImageBlock = { data?: string };
type Interaction = {
  output_image?: ImageBlock;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; data?: string }>;
  }>;
};

export async function editImage(
  source: Buffer,
  preset: Preset,
  instruction: string,
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new Error("Chưa cấu hình GEMINI_API_KEY trong .env hoặc .env.local.");
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
        input: [
          { type: "text", text: buildPrompt(preset, instruction) },
          {
            type: "image",
            mime_type: "image/png",
            data: source.toString("base64"),
          },
        ],
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: "1:1",
          image_size: "2K",
        },
      }),
      signal: AbortSignal.timeout(120000),
    },
  );
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    if (response.status === 429 && /Free Tier|limit:\s*0/i.test(details)) {
      throw new Error(
        "Tài khoản Gemini đang ở Free Tier; model tạo ảnh không có hạn mức miễn phí. Hãy bật gói trả phí cho API key rồi thử lại.",
      );
    }
    throw new Error(
      `Gemini không xử lý được ảnh (${response.status}). ${details}`,
    );
  }
  const interaction = (await response.json()) as Interaction;
  const data =
    interaction.output_image?.data ||
    interaction.steps
      ?.flatMap((step) => step.content || [])
      .find((item) => item.type === "image")?.data;
  if (!data)
    throw new Error("Gemini không trả về ảnh. Hãy thử lại hoặc đổi preset.");
  return Buffer.from(data, "base64");
}
