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
  // A de fábrica. Os números são os do `tokens.css`, não uma aproximação.
  { id: "vortex", nome: "Vortex", matiz: 295, croma: 1, acento: "#bcaef2" },
  { id: "grafite", nome: "Grafite", matiz: 280, croma: 0.15, acento: "#b9b6c4" },
  { id: "mare", nome: "Maré", matiz: 245, croma: 1, acento: "#a8c6f0" },
  { id: "musgo", nome: "Musgo", matiz: 155, croma: 0.9, acento: "#9bdcb4" },
  { id: "ambar", nome: "Âmbar", matiz: 70, croma: 0.8, acento: "#f0cd8d" },
  { id: "rose", nome: "Rosé", matiz: 350, croma: 1.1, acento: "#f0aec2" },
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
