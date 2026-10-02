import sharp from "sharp";

export async function normalizeSource(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

export async function normalizeOutput(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 40_000_000 })
    .resize(1200, 1200, { fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();
}
