import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Serve `brand/mark.svg` como `/mark.svg`, em dev e no build.
 *
 * `brand/` fica fora da raiz desta ilha — é compartilhado com `web/` e
 * `desktop/`, e é o único diretório que as três compartilham. As saídas
 * óbvias seriam copiar o arquivo para `public/` ou abrir `server.fs.allow`
 * para fora da raiz; a primeira cria uma cópia que deriva da fonte, e o
 * arquivo de marca JÁ carrega esse risco entre as três peças. Não vale
 * adicionar uma quarta.
 *
 * Lendo direto da fonte, trocar a marca é trocar um arquivo.
 */
function marcaDoVortex(): Plugin {
  const origem = fileURLToPath(new URL("../../../brand/mark.svg", import.meta.url));

  return {
    name: "vortex-marca",

    configureServer(server) {
      server.middlewares.use("/mark.svg", (_req, res) => {
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "no-cache");
        res.end(readFileSync(origem));
      });
    },

    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "mark.svg",
        source: readFileSync(origem),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    // Regra do projeto: React Compiler ativo desde o dia 1. Uma das duas
    // perguntas do spike é se ele convive com o TanStack Virtual — desligar
    // aqui esvazia o spike.
    react({ compiler: true }),
    tailwindcss(),
    marcaDoVortex(),
  ],
});
