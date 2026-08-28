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
 * `import.meta.env.DEV` é substituído estaticamente pelo Vite, então em
 * produção isto é `false` literal e o ramo inteiro do arnês some do bundle.
 */
export const ARNES_ATIVO =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/dev");
