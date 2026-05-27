import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = join(root, "public/assets/logo.png");
const background = { r: 7, g: 13, b: 25, alpha: 1 };

async function squareIcon(size, logoScale = 0.82) {
  const logoSize = Math.round(size * logoScale);
  const logo = await sharp(logoPath).resize(logoSize, logoSize, { fit: "contain" }).png().toBuffer();
  const offset = Math.round((size - logoSize) / 2);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .png()
    .toBuffer();
}

async function openGraphImage() {
  const width = 1200;
  const height = 630;
  const logoSize = 300;
  const logo = await sharp(logoPath).resize(logoSize, logoSize, { fit: "contain" }).png().toBuffer();
  const titleSvg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#070d19"/>
          <stop offset="50%" stop-color="#0f1f3d"/>
          <stop offset="100%" stop-color="#070d19"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <text x="50%" y="72%" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="64" font-weight="700">Qirushio</text>
      <text x="50%" y="82%" text-anchor="middle" fill="#ff7e33" font-family="Arial, sans-serif" font-size="30" font-weight="600">Arkadaşlarınla Canlı Quiz</text>
    </svg>
  `);

  return sharp(titleSvg)
    .resize(width, height)
    .composite([{ input: logo, top: 110, left: Math.round((width - logoSize) / 2) }])
    .png()
    .toBuffer();
}

const outputs = [
  ["public/apple-touch-icon.png", () => squareIcon(180)],
  ["public/icon-192.png", () => squareIcon(192)],
  ["public/icon-512.png", () => squareIcon(512)],
  ["public/og-image.png", openGraphImage],
];

for (const [relativePath, factory] of outputs) {
  const buffer = await factory();
  const outPath = join(root, relativePath);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buffer);
  console.log(`wrote ${relativePath}`);
}
