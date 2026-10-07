/**
 * Paletas curadas.
 *
 * O picker da primeira versão pedia MATIZ e CROMA ao usuário — os parâmetros
 * da derivação, expostos como se fossem a interface. É o modelo mental de quem
 * implementou vazando para quem usa, e foi a causa real da sensação de
 * "rústico": nenhum produto pergunta o croma do neutro.
 *
 * O que produtos fazem: oferecem paletas prontas, com preview, e escondem o
 * ajuste fino. Discord dá temas e um accent picker; Slack dá swatches de cinco
 * barrinhas. A abstração certa para quem escolhe é "quero a verde", não
 * "matiz 150, croma 1".
 *
 * Todas passam pela mesma varredura de contraste — não há paleta aqui que
 * precise de exceção, porque a garantia é da derivação e não da curadoria.
 *
 * `acento` é lido só por matiz e croma; a luminosidade vem da rampa do modo.
 * Por isso o mesmo hex serve para claro e escuro.
 */
export type Paleta = {
  readonly id: string;
  readonly nome: string;
  readonly matiz: number;
  readonly croma: number;
  readonly acento: string;
};

export const PALETAS: readonly Paleta[] = [
  /*
    A de fábrica. Os números são os do `tokens.css`, não uma aproximação — e
    isso tem teste, porque uma curadoria que não contém a paleta ATIVA faz o
    picker abrir sem nada selecionado num app recém-instalado.

    ⚠ O neutro saiu de 295 (violáceo) para 258 (azul-ardósia) com a identidade
    nova, e o acento de lilás pastel para teal. As cinco variações abaixo
    foram re-escolhidas em volta do neutro novo: manter as antigas deixaria
    "Grafite" e "Maré" descrevendo uma família que não existe mais.
  */
  { id: "vortex", nome: "Vortex", matiz: 258, croma: 1, acento: "#35c2cc" },
  { id: "grafite", nome: "Grafite", matiz: 258, croma: 0.12, acento: "#9aa3ad" },
  { id: "indigo", nome: "Índigo", matiz: 265, croma: 1, acento: "#7f8ff5" },
  { id: "musgo", nome: "Musgo", matiz: 200, croma: 0.9, acento: "#46c98a" },
  { id: "ambar", nome: "Âmbar", matiz: 250, croma: 0.9, acento: "#e2b15c" },
  { id: "rose", nome: "Rosé", matiz: 300, croma: 1, acento: "#f16f95" },
];

/** A paleta que casa com a semente atual, se alguma casar. */
export function paletaDe(matiz: number, croma: number, acento: string): string | null {
  const achada = PALETAS.find(
    (p) =>
      Math.round(p.matiz) === Math.round(matiz) &&
      Math.abs(p.croma - croma) < 0.001 &&
      p.acento.toLowerCase() === acento.toLowerCase(),
  );
  return achada?.id ?? null;
}
