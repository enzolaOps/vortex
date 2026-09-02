import { IconContext } from "@phosphor-icons/react";
import { useMemo, type ReactNode } from "react";

/**
 * O peso padrão de todo ícone do app.
 *
 * ⚠ **A escala resolveu o TAMANHO e deixou o PESO solto, e é o peso que
 * decide se um ícone sobrevive ao tamanho em que ele é desenhado.** Medido na
 * tela principal: dos 129 ícones, **65 saem a 13px, 15 a 12px e 2 a 9px** —
 * ou seja, a esmagadora maioria vive em 12–13px. O `regular` do Phosphor é
 * contorno desenhado num canvas de 256; a 13px o traço cai abaixo de um pixel
 * e o navegador o resolve em cinza claro. O ícone não some, ele DESBOTA — que
 * é o que faz um conjunto parecer barato sem que nenhum desenho esteja errado.
 *
 * A referência de qualidade que motivou isto é sólida por construção: os
 * ícones do Discord são preenchidos, sem traço nenhum, com formas gordas e
 * terminais arredondados. Nada ali pode afinar, porque não há linha para
 * afinar. É a propriedade que se copia — não o desenho.
 *
 * ⚠ **Contexto e não prop, porque prop seria 89 arquivos de novo.** É a mesma
 * razão de o ponto único existir: `IconContext` é o lugar onde a família toda
 * muda de uma vez, e a prop continua vencendo onde alguém precisou dizer algo
 * específico.
 *
 * ## Por que `fill`, e a medição que abriu a questão
 *
 * Renderizando as formas de verdade num canvas a 13px e contando os pixels que
 * chegam acima de 200/255 de alfa — ou seja, os que chegam como TINTA e não
 * como cinza de anti-serrilhado:
 *
 * | peso | tinta | opaca |
 * | --- | --- | --- |
 * | `thin` | 7,9% | 0,1% |
 * | `light` | 10,8% | 0,1% |
 * | `regular` | 14,6% | **3,8%** |
 * | `bold` | 22,3% | 12,8% |
 * | `fill` | 40,6% | **29,9%** |
 *
 * O `regular`, que estava no ar, punha 14,6% de tinta e só um quarto dela
 * chegava opaca. O mapa de alfa da lupa a 13px mostra o que isso é na prática
 * — `#` opaco, `+.,` parciais:
 *
 * ```
 *    ,.++.          .+##+,
 *   .#.,,.#        +#...##,
 *  .+     .+      .#.   ,++
 *  +.     ,+      #.     ,#.
 *  +,      +,     #.      #.
 *  .+     .+      +#     .#
 *   ,.#++#.+,      ,+####+#.
 *     regular          bold
 * ```
 *
 * O anel inteiro do `regular` tem QUATRO pixels opacos.
 *
 * ⚠ **Eu li o segundo eixo ao contrário e quase publiquei o inverso.** Contei
 * "vão interno sobrevivente" e escrevi que a lente FECHAVA no `regular`. O vão
 * está lá; quem não está é o anel — o contador devolvia zero porque o vazio
 * VAZAVA pelas falhas do traço. A correção inverte de quem é o risco.
 *
 * ## Por que o padrão não vale para todo mundo
 *
 * ⚠ **`fill` não faz uma coisa só.** Em uns ícones ele solidifica a MESMA
 * forma; em outros ele desenha OUTRA — o glifo vazado dentro de um quadrado.
 * `X`, `Plus` e `Check` são os três mais usados do app e caem no segundo
 * grupo. Quem os resgata é `CONTORNO`, em `icones.tsx`, com o critério medido
 * e a lista fechada por teste. Ler aquele arquivo antes de mexer aqui.
 *
 * ⚠ **Contexto e não prop, porque prop seria 89 arquivos de novo** — e porque
 * `IconBase` já lê o contexto de qualquer jeito, então o Provider não custa
 * nada por ícone. A prop continua vencendo o contexto, que é o que faz o
 * `fill` de ESTADO (ponto de presença, alfinete fixado, sino silenciado)
 * sobreviver: ali o preenchimento diz estado, não peso.
 */
export const PESO_PADRAO = "fill" as const;

export function PesoDeIcone({ children }: { children: ReactNode }) {
  /*
    ⚠ **O valor precisa ser estável.** `IconContext` é um contexto do React
    como qualquer outro: um objeto literal aqui dentro seria referência nova a
    cada render da raiz, e invalidaria TODO ícone montado — que na tela cheia
    são 129, e sob firehose seria a cada quadro. É a lei nº 1 aplicada a um
    contexto de terceiro, e a mesma armadilha do `getSnapshot`.
  */
  const valor = useMemo(() => ({ weight: PESO_PADRAO }), []);
  return <IconContext.Provider value={valor}>{children}</IconContext.Provider>;
}
