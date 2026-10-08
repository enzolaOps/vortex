import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";

/**
 * Serve `brand/vortex-simbolo.svg` como `/vortex-simbolo.svg`, em dev e no build (favicon).
 *
 * `brand/` fica fora da raiz desta ilha; copiar o arquivo para `public/` criaria uma cópia
 * que deriva da fonte. Lendo direto de `brand/`, trocar a marca é trocar um arquivo (mesmo
 * mecanismo do `client`).
 */
export function marcaDoVortex(): Plugin {
  const origem = fileURLToPath(new URL("../../../brand/vortex-simbolo.svg", import.meta.url));

  return {
    name: "vortex-marca",

    configureServer(server) {
      server.middlewares.use("/vortex-simbolo.svg", (_req, res) => {
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "no-cache");
        res.end(readFileSync(origem));
      });
    },

    generateBundle() {
      this.emitFile({ type: "asset", fileName: "vortex-simbolo.svg", source: readFileSync(origem) });
    },
  };
}
