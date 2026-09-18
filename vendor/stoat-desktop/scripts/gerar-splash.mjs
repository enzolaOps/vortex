/**
 * Escreve `assets/instalacao.gif` a partir de `splashDoInstalador.mjs`.
 *
 *   pnpm assets:splash        (a partir de vendor/stoat-desktop/)
 *
 * O arquivo é commitado: o maker do Squirrel o lê no build e o CI não roda
 * geração de asset. `splashDoInstalador.test.ts` reconstrói os bytes e compara
 * com o que está na árvore, então mexer no gerador sem rodar isto reprova.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MEDIDAS, gerarSplash } from "./splashDoInstalador.mjs";

const destino = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "assets",
  "instalacao.gif",
);

const dados = gerarSplash();
writeFileSync(destino, dados);
console.log(
  `assets/instalacao.gif — ${MEDIDAS.LARGURA}×${MEDIDAS.ALTURA}, ` +
    `${MEDIDAS.QUADROS} quadros, ${dados.length} bytes`,
);
