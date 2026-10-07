import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// `vitest/config` e não `vite`: é o que acrescenta a chave `test` ao tipo.
import { defineConfig } from "vitest/config";

/*
  A versão do MediaPipe, para `ui-logica/voz/fundoDeVideo.ts`.

  ⚠ Mesma conta do `vite.config.ts` do client, que injeta a constante no
  build: aqui ela é resolvida a partir do `@livekit/track-processors` (o
  MediaPipe é dependência DELE, e o `nodeLinker: isolated` só deixa cada pacote
  enxergar o que declarou).
*/
const exigir = createRequire(import.meta.url);
const VERSAO_DO_MEDIAPIPE: string = (() => {
  const processadores = dirname(exigir.resolve("@livekit/track-processors"));
  const doProcessador = createRequire(join(processadores, "index.js"));
  const dir = dirname(doProcessador.resolve("@mediapipe/tasks-vision"));
  return (
    JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      version: string;
    }
  ).version;
})();

export default defineConfig({
  define: {
    // O client injeta a versão do próprio package.json; no teste o valor é fixo.
    __VERSAO__: JSON.stringify("0.0.0"),
    __VERSAO_MEDIAPIPE__: JSON.stringify(VERSAO_DO_MEDIAPIPE),
  },

  ssr: {
    resolve: {
      /**
       * O `solid-js` do TESTE precisa ser o de navegador, não o de servidor.
       *
       * Em Node, `solid-js` resolve para `dist/server.js` — o build de SSR,
       * onde **`createEffect` é no-op por design**. Sem esta condição, metade
       * da ponte `stoat.js → React` (a reativa) fica fora de teste sem nada
       * falhar. Copiado do `vite.config.ts` do client, onde a leitura completa
       * mora: `environment: "jsdom"` NÃO substitui isto (o Vitest troca o
       * pipeline e a condição deixa de valer), e alias nominal não é consultado
       * porque o Vitest externaliza `node_modules`.
       */
      conditions: ["browser", "development"],
    },
  },

  test: {
    /** Um `document` para quem resolve como navegador e roda em Node. */
    setupFiles: ["./src/testes/documento.ts"],
  },
});
