/**
 * Regenera todo raster de marca a partir dos SVGs de `brand/`.
 *
 *   npm i -D sharp        # não é dependência do repositório: os assets são commitados
 *   node brand/generate.mjs
 *
 * Fontes:
 *   vortex-icone-app.svg  -> icon.png, icon.ico, hicolor/*, android-chrome, masking
 *   vortex-simbolo.svg    -> simboloDoInstalador.mjs (máscara 1 bit do splash), iconTemplate.png (bandeja do macOS), monochrome.svg, wordmark.svg
 *   vortex-logotipo.svg   -> wordmark.svg
 *
 * Saídas:
 *   desktop/assets/                                 (casca Electron)
 *   vendor/stoat-web/packages/client/scripts/assets_fallback/web (referência; o fork não tem o
 *                                                                 submódulo privado de marca)
 *
 * O cliente novo (`client/`) NÃO consome rasters: serve `vortex-simbolo.svg` direto.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const webOut = resolve(root, "vendor/stoat-web/packages/client/scripts/assets_fallback/web");
const desktopOut = resolve(root, "desktop/assets");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp não encontrado. Instale antes:  npm i -D sharp");
  process.exit(1);
}

mkdirSync(webOut, { recursive: true });
mkdirSync(resolve(desktopOut, "hicolor"), { recursive: true });

const icone = readFileSync(resolve(here, "vortex-icone-app.svg"));
const simbolo = readFileSync(resolve(here, "vortex-simbolo.svg"), "utf8");

// Densidade alta: o rasterizador parte de um intermediário grande em vez de ampliar um pequeno.
const render = (svg, size) =>
  sharp(svg, { density: 900 }).resize(size, size).png({ compressionLevel: 9 });

// --- PNGs do ícone do app ---------------------------------------------------
for (const size of [192, 512]) {
  await render(icone, size).toFile(resolve(webOut, `android-chrome-${size}x${size}.png`));
}
// Maskable: sem os cantos arredondados do arquivo — a plataforma aplica a própria forma, e
// o símbolo (~60% central) cabe na zona segura de 80%.
const cheio = Buffer.from(
  icone.toString("utf8").replace('<rect width="512" height="512" rx="112"/>', '<rect width="512" height="512"/>'),
);
await render(cheio, 512).toFile(resolve(webOut, "masking-512x512.png"));

for (const size of [16, 32, 64, 128, 256, 512]) {
  await render(icone, size).toFile(resolve(desktopOut, `hicolor/${size}x${size}.png`));
}
await render(icone, 512).toFile(resolve(desktopOut, "icon.png"));

// --- .ico -------------------------------------------------------------------
// Escrito à mão: um .ico é um cabeçalho curto seguido de PNGs embutidos.
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const pngs = [];
for (const size of ICO_SIZES) pngs.push({ size, data: await render(icone, size).toBuffer() });

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);

const entries = [];
let offset = 6 + 16 * pngs.length;
for (const { size, data } of pngs) {
  const e = Buffer.alloc(16);
  e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 = 256
  e.writeUInt8(size >= 256 ? 0 : size, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  entries.push(e);
  offset += data.length;
}
const ico = Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
writeFileSync(resolve(webOut, "icon.ico"), ico);
writeFileSync(resolve(desktopOut, "icon.ico"), ico);

// --- Bandeja do macOS -------------------------------------------------------
// Template image: o SO tinge, só o canal alfa importa. Símbolo em preto, 2x para retina.
const preto = Buffer.from(simbolo.replaceAll("#F2F4FA", "#000000"));
await render(preto, 40).toFile(resolve(desktopOut, "iconTemplate.png"));

// --- Máscara do símbolo para o splash do instalador -------------------------
// O GIF do instalador é gerado por código sem dependência de imagem
// (desktop/scripts/splashDoInstalador.mjs). Em vez de rasterizar ali, ele lê uma
// máscara de 1 bit a 216px (3x de 72) embutida num módulo gerado — 3x3 amostras por pixel de
// saída de 72px, que é a mesma conta do desenho antigo.
const LADO = 216;
const { data } = await sharp(Buffer.from(simbolo.replaceAll("#F2F4FA", "#FFFFFF")), { density: 900 })
  .resize(LADO, LADO)
  .ensureAlpha()
  .extractChannel(3)
  .raw()
  .toBuffer({ resolveWithObject: true });
const bits = Buffer.alloc(Math.ceil((LADO * LADO) / 8));
for (let i = 0; i < LADO * LADO; i++) if (data[i] > 127) bits[i >> 3] |= 1 << (i & 7);
writeFileSync(
  resolve(root, "desktop/scripts/simboloDoInstalador.mjs"),
  `/* GERADO por brand/generate.mjs a partir de brand/vortex-simbolo.svg. Não edite. */
export const LADO = ${LADO};
export const MASCARA = "${gzipSync(bits, { level: 9 }).toString("base64")}";
`,
);

// --- SVGs da referência web (nomes que o upstream espera) -------------------
copyFileSync(resolve(here, "vortex-simbolo.svg"), resolve(webOut, "monochrome.svg"));
copyFileSync(resolve(here, "vortex-logotipo.svg"), resolve(webOut, "wordmark.svg"));

console.log(`Escrito em ${desktopOut}\ne em ${webOut}`);
