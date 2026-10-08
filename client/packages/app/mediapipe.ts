import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { Plugin } from "vite";

/**
 * O runtime do MediaPipe servido pela PRÓPRIA origem (mesmo mecanismo do `client`).
 *
 * `@livekit/track-processors` carrega, por padrão, o WASM do MediaPipe de
 * `cdn.jsdelivr.net`. A CSP bloqueia — e deve: seria a câmera de quem usa
 * dependendo de terceiro. Este plugin serve os arquivos de `node_modules` em
 * `/mediapipe/<versão>/` no dev server e os emite no build.
 *
 * Só os de SIMD (o par sem SIMD dobraria o artefato por navegadores que a base
 * não usa; sem SIMD cai no aviso de "fundo indisponível").
 *
 * Resolvido a partir do package.json do `nucleo`, que declara o
 * `@livekit/track-processors` (o `nodeLinker: isolated` só deixa cada pacote
 * enxergar o que declarou). Os arquivos só são BAIXADOS por quem liga o fundo.
 */
const exigir = createRequire(new URL("../nucleo/package.json", import.meta.url));
const DIR = (() => {
  const processadores = dirname(exigir.resolve("@livekit/track-processors"));
  const doProcessador = createRequire(join(processadores, "index.js"));
  return dirname(doProcessador.resolve("@mediapipe/tasks-vision"));
})();

export const VERSAO_DO_MEDIAPIPE: string = (
  JSON.parse(readFileSync(join(DIR, "package.json"), "utf8")) as { version: string }
).version;

const ARQUIVOS = readdirSync(join(DIR, "wasm")).filter((f) =>
  f.startsWith("vision_wasm_internal."),
);

export function mediapipeLocal(): Plugin {
  const prefixo = `/mediapipe/${VERSAO_DO_MEDIAPIPE}/`;
  const tipo = (f: string) => (f.endsWith(".wasm") ? "application/wasm" : "text/javascript");

  return {
    name: "vortex-mediapipe",

    configureServer(server) {
      server.middlewares.use(prefixo, (req, res, next) => {
        const nome = (req.url ?? "").replace(/^\//, "").split("?")[0] ?? "";
        if (!ARQUIVOS.includes(nome)) {
          next();
          return;
        }
        res.setHeader("Content-Type", tipo(nome));
        res.end(readFileSync(join(DIR, "wasm", nome)));
      });
    },

    generateBundle() {
      for (const nome of ARQUIVOS) {
        this.emitFile({
          type: "asset",
          fileName: `mediapipe/${VERSAO_DO_MEDIAPIPE}/${nome}`,
          source: readFileSync(join(DIR, "wasm", nome)),
        });
      }
    },
  };
}
