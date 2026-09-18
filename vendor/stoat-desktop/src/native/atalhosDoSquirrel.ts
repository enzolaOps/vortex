import { spawn } from "node:child_process";

import { app } from "electron";

import { tratarEventosDoSquirrel } from "./atalhosDoSquirrelModelo";

/**
 * O EFEITO dos eventos do Squirrel. A decisão mora em
 * `atalhosDoSquirrelModelo.ts`, que é puro e testado; aqui só se liga o
 * `child_process` e o `app` a ela.
 *
 * ⚠ **Sem `electron-squirrel-startup`, e a razão é testabilidade.** O pacote
 * faz exatamente isto em vinte linhas, mas lê `process.argv[1]` e chama
 * `require("electron").app` no corpo do módulo — ou seja, a decisão não pode
 * ser exercitada sem Electron, e o runner desta casca marca `electron` como
 * externo de propósito (`scripts/testar.mjs`). Adotá-lo custaria uma
 * dependência E deixaria o caminho sem teste, que é a troca errada nas duas
 * pontas.
 *
 * @returns `true` quando o processo está encerrando por causa de um evento do
 * Squirrel — quem chama não deve montar janela, bandeja nem ponte.
 */
export function tratarSquirrel(): boolean {
  return tratarEventosDoSquirrel({
    argv: process.argv,
    plataforma: process.platform,
    execPath: process.execPath,
    rodarUpdate: (comando, argumentos, aoTerminar) => {
      try {
        const filho = spawn(comando, argumentos, { detached: true });
        /*
          `close` e não `exit`: o `Update.exe` só terminou de escrever o `.lnk`
          quando os descritores dele fecham. E `once`, porque `app.quit()`
          chamado duas vezes num processo que já está saindo é ruído.
        */
        filho.once("close", aoTerminar);
        /*
          Sem o `error` o processo ficaria pendurado para sempre se o
          `Update.exe` não existisse — e um instalador que não termina deixa o
          spinner do Squirrel na tela, que é metade do defeito original.
        */
        filho.once("error", aoTerminar);
      } catch {
        aoTerminar();
      }
    },
    sair: () => app.quit(),
  });
}
