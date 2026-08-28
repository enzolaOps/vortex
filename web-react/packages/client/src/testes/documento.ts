/**
 * Um `document` global, para a suíte que roda em Node resolvendo como
 * navegador.
 *
 * O `vite.config.ts` força `ssr.resolve.conditions: ["browser", …]` porque sem
 * isso o `solid-js` do teste é o build de SSR, onde `createEffect` é no-op — e
 * aí metade da ponte `stoat.js → React` fica fora de teste sem nada falhar.
 * A leitura completa está lá.
 *
 * A conta dessa condição chegou com o markdown: o
 * `decode-named-character-reference`, que o micromark usa para decodificar
 * entidades HTML, tem uma build de navegador que faz `document.createElement`
 * **no escopo do módulo**. Não é uma chamada que dá para adiar — é o `import`
 * que a dispara.
 *
 * **Isto NÃO é `environment: "jsdom"`, e a diferença é o ponto.** Trocar o
 * ambiente faz o Vitest trocar o pipeline de transformação, e aí a condição de
 * resolução acima para de valer — o `solid-js` volta a ser o de servidor e as
 * suítes de efeito quebram. Medido: `fixadas`, `reacoes`, `reconciliacao` e
 * `voz` falharam exatamente assim. Aqui a gente instala a única peça que
 * faltava e não mexe em mais nada.
 *
 * ⚠ **jsdom continua NÃO sendo o runner de navegador que as pendências
 * pedem.** Ele não tem engine de layout: âncora, remedição e a assertion de
 * linha medindo 0px seguem sem teste e seguem medidas à mão no arnês. O que
 * este arquivo entrega é a existência de `document`, e nada além.
 */
import { JSDOM } from "jsdom";

/*
  A `url` NÃO é decoração: sem ela o documento nasce em `about:blank`, que é
  uma origem OPACA — e `localStorage` numa origem opaca lança
  `SecurityError` por especificação. Descobri isso derrubando as 41 suítes de
  uma vez.
*/
const janela = new JSDOM("", { url: "http://localhost" }).window;

// `globalThis` e não `global`: o segundo é do Node e não existe no navegador,
// e este arquivo é o único lugar do projeto que precisa da distinção.
(globalThis as { document?: Document }).document = janela.document;

/**
 * `localStorage`, e ele revelou um teste que passava por ausência.
 *
 * `store/sessao.ts` embrulha todo acesso em `try/catch` de propósito — aba
 * anônima e armazenamento bloqueado são casos reais, e sessão ilegível é
 * tratada como sessão inexistente. Em Node não havia `localStorage` nenhum,
 * então **todo caminho de persistência caía direto no `catch`**: guardar não
 * guardava, ler devolvia `undefined`, e os testes concordavam com isso sem
 * nunca terem exercitado a escrita.
 *
 * Apareceu quando `restaurarSessao` passou a ser testada de verdade: ela lia o
 * token que o teste tinha acabado de guardar, e não achava nada.
 */
(globalThis as { localStorage?: Storage }).localStorage = janela.localStorage;
