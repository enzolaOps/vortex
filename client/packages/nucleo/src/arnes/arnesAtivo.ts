/**
 * Estamos no arnês de medição?
 *
 * Um predicado, num lugar só, porque DOIS lados precisam concordar e eles
 * ficam em arquivos diferentes: o `App` decide o que montar, e o `main` decide
 * se liga o roteador. Duas cópias da mesma condição é a divergência que este
 * projeto já viu várias vezes — a que diverge é a que ninguém abriu naquela
 * semana.
 *
 * ⚠ **Lido do `pathname` cru, e nunca de um store.** O arnês não é um lugar do
 * produto: `Local` é a união marcada que descreve onde a pessoa está, e é ela
 * que a URL projeta, que a paleta de comandos indexa e que todo `Record<…>` de
 * exaustividade do projeto percorre. Um `{ tipo: "arnes" }` ali dentro seria um
 * destino de produto que o produto não tem.
 *
 * E por isso o roteador NÃO é ligado aqui. Ele faria `replaceState` para
 * `caminhoDe(lerLocal())` na abertura — que para `/dev` devolve `/` —, e o
 * arnês perderia o próprio endereço em todo F5. A projeção de URL continua
 * verificada onde ela é produto; no rig de medição ela não tem o que projetar.
 *
 * ⚠ **Vale no build de PRODUÇÃO também, e isso é requisito do gate — não
 * descuido.** A primeira versão tinha `import.meta.env.DEV &&` na frente, o
 * que fazia o ramo inteiro sumir do bundle de produção. Parecia a escolha
 * conservadora, e quebrou o gate de merge em silêncio: `scripts/gate.mjs` mede
 * o BUILD DE PRODUÇÃO servido em `:4174` — a razão está no `CLAUDE.md`, medir
 * no dev server reprova o ambiente em vez do código —, e o arnês é justamente
 * quem semeia as dez mil mensagens e dispara o firehose. Sem ele no bundle, o
 * gate estourava procurando uma caixa de seleção que não existia mais.
 *
 * Antes da separação entre `Cliente` e `Arnes`, o arnês ERA o `App` e estava
 * no bundle de produção sempre. Isto é estritamente menos exposição que aquilo:
 * o `Arnes` é `lazy`, então quem nunca abre `/dev` não baixa o chunk, e o que
 * ele faz é dirigir um firehose sintético em memória.
 */
export const ARNES_ATIVO =
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/dev");
