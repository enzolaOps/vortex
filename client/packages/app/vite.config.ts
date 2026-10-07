import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
// `vitest/config` e não `vite`: acrescenta a chave `test` ao tipo.
import { defineConfig } from "vitest/config";

import { cspDoVortex } from "./csp.ts";

/**
 * Condições de resolução do `solid-js` nos testes que rodam em Node.
 *
 * O `app` importa o `nucleo`, e o `nucleo` carrega o `solid-js` dentro de
 * `sdk/`. Em Node ele resolve para o build de SERVIDOR, onde `createEffect` é
 * no-op, e metade da ponte stoat.js → React fica fora de teste sem erro algum.
 * A condição `browser` corrige isso só no pipeline do Vitest (`ssr.resolve`),
 * sem tocar o build de produção. Leitura completa no `vite.config.ts` do
 * `client`. `environment: "jsdom"` NÃO substitui isto: por isso o `app` testa
 * componente em modo navegador (projeto `navegador`), nunca em jsdom.
 */
const CONDICOES_NODE = ["browser", "development"];

export default defineConfig({
  server: {
    // Porta própria para não colidir com o `client` (5173). `PORT` vence.
    port: process.env.PORT ? Number(process.env.PORT) : 5180,
  },

  plugins: [
    // React Compiler ativo desde o dia 1, como no `client`.
    react({ compiler: true }),
    tailwindcss(),
    cspDoVortex(),
  ],

  ssr: { resolve: { conditions: CONDICOES_NODE } },

  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unidade",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["nucleo/testes/documento"],
        },
      },
      {
        extends: true,
        test: {
          name: "navegador",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
