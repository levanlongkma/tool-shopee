import type { Preset } from "@/types/product";

const preservation = `Keep the real product faithful to the source image. Preserve shape, proportions, colors, included accessories and essential parts. Do not invent objects, remove parts, duplicate objects, distort geometry, or crop important product details. Remove previous seller logos, watermarks, shop names and unrelated marketplace graphics when possible. Do not generate any logo, text, label, badge, or random characters. Output one polished square 1:1 commercial image.`;

export function buildPrompt(preset: Preset, instruction: string): string {
  const base =
    preset === "shopee-plain"
      ? `Create a clean marketplace image on a solid white or extremely light neutral background. No furniture, room scene, props, gradient or texture. Center the complete product, filling roughly 80–90% of the canvas, with a natural soft studio shadow.`
      : `Create a bright, premium, child-friendly e-commerce composition with a simple playroom, children's room, warm home, or clean studio background. Use natural commercial lighting, soft realistic shadows and sharp product detail. Keep approximately the top 12.5% of the square canvas as uncluttered natural continuous background for a future real logo. No white strip, box, banner, or blur in that area. Keep important objects below it.`;
  const style =
    preset === "mimitoys-standard"
      ? "Allow natural visual room below the logo safe area for a future headline overlay, but do not render text yourself."
      : "";
  const custom = instruction.trim().slice(0, 500);
  return [
    preservation,
    base,
    style,
    custom
      ? `Additional user direction, only when compatible with product preservation: ${custom}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
