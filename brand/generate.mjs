/**
 * Regenerate every raster brand asset from brand/mark.svg.
 *
 *   npm i -D sharp        # not a repo dependency: assets are committed
 *   node brand/generate.mjs
 *
 * Output goes to packages/client/scripts/assets_fallback/web/, which is what
 * scripts/copyAssets.mjs links into public/assets when packages/client/assets
 * is absent — and it is absent in this fork, because upstream keeps its brand
 * assets in a private submodule we neither have nor are allowed to use.
 *
 * The SVGs (monochrome, wordmark) are copied, not rendered: they ship as SVG.
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const out = resolve(root, "packages/client/scripts/assets_fallback/web");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is missing. Install it first:  npm i -D sharp");
  process.exit(1);
}

mkdirSync(out, { recursive: true });

const markPath = resolve(here, "mark.svg");
const mark = readFileSync(markPath);

// High density so the rasteriser works from a large intermediate instead of
// upscaling a small one.
const render = (size) =>
  sharp(mark, { density: 900 }).resize(size, size).png({ compressionLevel: 9 });

// --- Standard icons ---------------------------------------------------------
for (const size of [192, 512]) {
  await render(size).toFile(resolve(out, `android-chrome-${size}x${size}.png`));
  console.log(`android-chrome-${size}x${size}.png`);
}

// --- Maskable ---------------------------------------------------------------
// Rendered full-bleed on purpose. Android applies its own shape to a maskable
// icon, so the rounded corners of the mark are meant to be cropped away —
// padding the artwork instead produces a visible box inside the platform's box.
// The blades occupy the middle ~57%, comfortably inside the 80% safe zone.
await render(512).toFile(resolve(out, "masking-512x512.png"));
console.log("masking-512x512.png");

// --- Favicon ----------------------------------------------------------------
// Written by hand: an .ico is a small header followed by embedded PNGs, and
// pulling in a dependency for eighty bytes of struct is not worth it.
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
const pngs = [];
for (const size of ICO_SIZES) {
  pngs.push({ size, data: await render(size).toBuffer() });
}

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon
header.writeUInt16LE(pngs.length, 4);

const entries = [];
let offset = 6 + 16 * pngs.length;
for (const { size, data } of pngs) {
  const e = Buffer.alloc(16);
  e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
  e.writeUInt8(size >= 256 ? 0 : size, 1);
  e.writeUInt8(0, 2); // palette colours
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  entries.push(e);
  offset += data.length;
}

writeFileSync(
  resolve(out, "icon.ico"),
  Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]),
);
console.log(`icon.ico (${ICO_SIZES.join(", ")})`);

// --- Vector assets ----------------------------------------------------------
copyFileSync(resolve(here, "monochrome.svg"), resolve(out, "monochrome.svg"));
copyFileSync(resolve(here, "wordmark.svg"), resolve(out, "wordmark.svg"));
console.log("monochrome.svg, wordmark.svg");

console.log(`\nWrote to ${out}`);

// --- Desktop assets ---------------------------------------------------------
// The Electron shell in desktop/ has the same problem as the web client: the
// upstream icons live in a private submodule. forge.config.ts and the tray
// read these paths.
const desktopOut = resolve(root, "desktop/assets");
mkdirSync(resolve(desktopOut, "hicolor"), { recursive: true });

for (const size of [16, 32, 64, 128, 256, 512]) {
  await render(size).toFile(resolve(desktopOut, `hicolor/${size}x${size}.png`));
}
await render(512).toFile(resolve(desktopOut, "icon.png"));
copyFileSync(resolve(out, "icon.ico"), resolve(desktopOut, "icon.ico"));

// macOS tray icon: a template image is tinted by the OS, so only the alpha
// channel matters. Rendered from the monochrome mark at 2x for retina.
await sharp(readFileSync(resolve(here, "monochrome.svg")), { density: 900 })
  .resize(40, 40)
  .png({ compressionLevel: 9 })
  .toFile(resolve(desktopOut, "iconTemplate.png"));

console.log(`Wrote to ${desktopOut}`);
