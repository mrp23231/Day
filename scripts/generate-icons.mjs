import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

// Day's existing collapsed-navigation wordmark, exported as an installable icon.
await mkdir("public", { recursive: true });
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#111111"/><text x="256" y="350" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="270" font-weight="600" fill="#ffffff">D</text></svg>`;
await writeFile("public/icon.svg", icon);
for (const [name, size] of [["icon-512.png",512],["icon-maskable.png",512],["icon-192.png",192],["apple-touch-icon.png",180]]) {
  let image = sharp(Buffer.from(icon)).resize(size, size);
  if (name === "icon-maskable.png") image = image.flatten({ background: "#111111" });
  await image.png().toFile(`public/${name}`);
}
