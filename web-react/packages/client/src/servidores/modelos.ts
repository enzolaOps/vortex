/**
 * Os modelos de servidor — e eles são REAIS, não desenho.
 *
 * ⚠ **"Modelo" não existe no protocolo**, e por um momento a leitura óbvia foi
 * registrá-los como pendência. Ela está errada: `template` dá zero ocorrências
 * no schema do Stoat, mas o que um modelo FAZ aqui é criar o servidor e depois
 * os canais — e `criarServidor` e `criarCanal` existem os dois. O modelo é uma
 * lista de canais com um nome bonito, e uma lista de canais é coisa que este
 * cliente sabe criar.
 *
 * O que NÃO cabe é o modelo COMPARTILHÁVEL que o design de "Páginas Restantes"
 * desenha — `vortex.gg/t/vx-core-base`, com sincronização e reaplicação. Aquilo
 * precisa de um objeto no servidor. Estes quatro são presets locais, e a
 * diferença está dita na tela.
 *
 * ⚠ **O PROPÓSITO também é real, e só em parte.** O design diz que ele define
 * "nível de verificação inicial, canais e se o servidor nasce com regras".
 * Nível de verificação não existe (ver `config/Seguranca.tsx`); canais e o
 * canal de regras existem. Então o propósito muda a lista de canais, e nada
 * mais — que é a metade que o protocolo sustenta.
 */

export type CanalInicial = {
  readonly nome: string;
  readonly voz: boolean;
};

export type ModeloId = "zero" | "jogos" | "estudo" | "produto" | "comunidade";

export type Modelo = {
  readonly id: ModeloId;
  readonly nome: string;
  readonly detalhe: string;
  /** O glifo do design. Emoji e não ícone: é o que a referência usa. */
  readonly glifo: string;
  readonly canais: readonly CanalInicial[];
};

/**
 * O caminho mais comum, e o único com borda de acento.
 *
 * Ele fica visualmente ACIMA dos modelos porque é o que a maioria escolhe — é
 * instrução do design, e a razão é que uma lista de cinco opções iguais faz
 * todo mundo ler as cinco para escolher a primeira.
 */
export const DO_ZERO: Modelo = {
  id: "zero",
  nome: "Criar do zero",
  detalhe: "Um canal de texto e um de voz",
  glifo: "＋",
  canais: [
    { nome: "geral", voz: false },
    { nome: "Sala do time", voz: true },
  ],
};

export const MODELOS: readonly Modelo[] = [
  {
    id: "jogos",
    nome: "Jogos",
    detalhe: "Voz, LFG e clipes",
    glifo: "🎮",
    canais: [
      { nome: "geral", voz: false },
      { nome: "procura-grupo", voz: false },
      { nome: "clipes", voz: false },
      { nome: "Sala 1", voz: true },
      { nome: "Sala 2", voz: true },
    ],
  },
  {
    id: "estudo",
    nome: "Estudo",
    detalhe: "Salas de foco e materiais",
    glifo: "📚",
    canais: [
      { nome: "geral", voz: false },
      { nome: "materiais", voz: false },
      { nome: "duvidas", voz: false },
      { nome: "Foco", voz: true },
    ],
  },
  {
    id: "produto",
    nome: "Produto",
    detalhe: "Roadmap, crit e releases",
    glifo: "🛠",
    canais: [
      { nome: "geral", voz: false },
      { nome: "roadmap", voz: false },
      { nome: "design-crit", voz: false },
      { nome: "releases", voz: false },
      { nome: "Sala do time", voz: true },
    ],
  },
  {
    id: "comunidade",
    nome: "Comunidade",
    detalhe: "Regras, fórum e eventos",
    glifo: "💬",
    canais: [
      { nome: "regras", voz: false },
      { nome: "boas-vindas", voz: false },
      { nome: "geral", voz: false },
      { nome: "eventos", voz: false },
      { nome: "Sala aberta", voz: true },
    ],
  },
];

export const PROPOSITOS = ["time", "comunidade"] as const;
export type Proposito = (typeof PROPOSITOS)[number];

export const NOME_DO_PROPOSITO: Record<
  Proposito,
  { readonly titulo: string; readonly detalhe: string }
> = {
  time: { titulo: "Time pequeno", detalhe: "até 20 pessoas" },
  comunidade: { titulo: "Comunidade", detalhe: "aberto ao público" },
};

/**
 * Os canais que o servidor vai nascer com.
 *
 * ⚠ O propósito só ACRESCENTA, e nunca remove: escolher "Comunidade" num
 * modelo de jogos não deve tirar as salas de voz que a pessoa viu na lista de
 * prévia. Ele soma `regras` e `boas-vindas`, que é o que o design chama de
 * "nascer com regras".
 */
export function canaisDe(
  modelo: Modelo,
  proposito: Proposito,
): readonly CanalInicial[] {
  if (proposito === "time") return modelo.canais;

  const extras: CanalInicial[] = [];
  const tem = (n: string) => modelo.canais.some((c) => c.nome === n);
  if (!tem("regras")) extras.push({ nome: "regras", voz: false });
  if (!tem("boas-vindas")) extras.push({ nome: "boas-vindas", voz: false });
  return [...extras, ...modelo.canais];
}
