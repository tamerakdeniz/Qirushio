import { readFile } from "node:fs/promises";
import { join } from "node:path";

let logoDataUrlPromise: Promise<string> | null = null;

export const brandColors = {
  background: "#070d19",
  accent: "#ff7e33",
  text: "#ffffff",
} as const;

export async function getLogoDataUrl(): Promise<string> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = readFile(join(process.cwd(), "public/assets/logo.png")).then(
      (buffer) => `data:image/png;base64,${buffer.toString("base64")}`,
    );
  }
  return logoDataUrlPromise;
}
