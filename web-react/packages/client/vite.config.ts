import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
// `vitest/config` e não `vite`: é o que acrescenta a chave `test` ao tipo da
// configuração. Com o `defineConfig` do Vite, o bloco abaixo não compila.
import { defineConfig } from "vitest/config";

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
  /*
    A porta vem do AMBIENTE, com o default do Vite como reserva.

    O `launch.json` fixava `--port 5173 --strictPort`, e a porta ficou presa
    num processo órfão — o servidor de desenvolvimento passou a não subir, com
    uma mensagem sobre conflito de porta em vez de sobre o app. Nada aqui
    precisa de 5173 em particular: este é um SPA que fala PARA um backend, não
    um destino de callback de OAuth nem de webhook, então ninguém de fora
    conhece o número.

    `undefined` e não um número quando `PORT` não existe: assim o Vite escolhe,
    e a configuração não reintroduz o valor fixo que causou o problema.
  */
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },

  plugins: [
    // Regra do projeto: React Compiler ativo desde o dia 1. Uma das duas
    // perguntas do spike é se ele convive com o TanStack Virtual — desligar
    // aqui esvazia o spike.
    react({ compiler: true }),
    tailwindcss(),
    marcaDoVortex(),
  ],

  ssr: {
    resolve: {
      /**
       * O `solid-js` do TESTE precisa ser o de navegador, não o de servidor.
       *
       * Em Node, `solid-js` resolve para `dist/server.js` — o build de SSR,
       * onde **`createEffect` é no-op por design**. Medido: um efeito sobre um
       * `createSignal` simples não roda nem uma vez. Sem isto, metade da ponte
       * `stoat.js → React` — a metade REATIVA, que é a razão de o adapter
       * existir — nunca esteve sob teste e silenciosamente não podia estar.
       *
       * Não dá para arrumar no `resolve.conditions` do topo: aquilo vale para
       * o build de produção também, e trocar as condições lá derrubaria a
       * condição `production`. O `ssr.resolve.conditions` atinge só o pipeline
       * que o Vitest usa.
       *
       * ⚠ **Tentei duas vezes trocar isto por algo mais estreito, e as duas
       * falharam de um jeito que vale registrar** — as duas passariam por
       * "mais limpo" numa revisão de código:
       *
       * 1. `environment: "jsdom"`. Com ambiente de navegador o Vitest troca o
       *    pipeline de transformação, ESTAS CONDIÇÕES DEIXAM DE VALER, e o
       *    `solid-js` volta a ser o de servidor. Quatro suítes de efeito
       *    (`fixadas`, `reacoes`, `reconciliacao`, `voz`) passaram a falhar: o
       *    conserto desfazia em silêncio o conserto que devia preservar.
       * 2. Alias nominal do `solid-js` no `test.alias`. O Vitest EXTERNALIZA
       *    dependências de `node_modules`, então o Node as resolve por conta
       *    própria e o alias nem é consultado.
       *
       * A condição é ampla porque a resolução é ampla. O preço dela está logo
       * abaixo, em `setupFiles`.
       */
      conditions: ["browser", "development"],
    },
  },

  test: {
    /**
     * Um `document` para quem resolve como navegador e roda em Node.
     *
     * É o preço da condição acima, e ele só apareceu quando o markdown entrou:
     * o `decode-named-character-reference`, que o micromark usa para
     * decodificar entidades, tem uma build de navegador que toca `document` no
     * ESCOPO DO MÓDULO. Como `sdk/map.ts` passou a importar o analisador,
     * quinze suítes que nada têm com markdown quebravam todas no mesmo
     * `import`.
     */
    setupFiles: ["./src/testes/documento.ts"],
  },
});
