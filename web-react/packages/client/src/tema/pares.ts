/**
 * Os pares de contraste que a interface realmente produz.
 *
 * **Uma lista só, e essa unificação é o ponto.** Ela existia dentro do
 * `scripts/contrast.mjs`, verificando o `tokens.css` no CI. O picker de paleta
 * precisa da mesma verificação em tempo de escolha — e duas listas de pares
 * que precisam concordar sempre acabam divergindo: alguém adiciona um par no
 * CI e a paleta escolhida pelo usuário passa a ser aprovada por uma régua mais
 * curta que a do projeto. Ou o contrário, e o picker rejeita paletas que o CI
 * aceita.
 *
 * `min` segue `design-system.md`: 4,5:1 em texto, 3:1 em borda de controle e
 * em indicador não-textual — o ponto de presença é forma + cor, mas a cor
 * ainda precisa ser distinguível do fundo.
 */
import type { TokenName } from "../preset/tokens";
import { razao } from "./cor";

export type Par = {
  readonly fg: TokenName;
  readonly bg: TokenName;
  readonly min: number;
  readonly tipo: "texto" | "borda" | "indicador";
};

const SUPERFICIES = [
  "--vx-surface-0",
  "--vx-surface-1",
  "--vx-surface-2",
  "--vx-surface-3",
  "--vx-surface-4",
] as const satisfies readonly TokenName[];

const TEXTOS = ["--vx-text-1", "--vx-text-2", "--vx-text-3"] as const;

const STATUS = [
  "--vx-status-online",
  "--vx-status-idle",
  "--vx-status-dnd",
  "--vx-status-offline",
] as const;

function montar(): Par[] {
  const lista: Par[] = [];

  /*
    Texto sobre toda superfície em que pode aparecer.

    ⚠ **Com cinco superfícies, a superfície que aperta trocou de lado em cada
    modo, e isso é o que a paleta do design não previa.** No escuro a pior é a
    mais ALTA (`surface-4`, menu e modal); no claro é a mais BAIXA
    (`surface-0`, rail e gutter), porque no claro a rampa sobe em direção ao
    branco e a base é o tom mais escuro que existe.

    Medido na paleta como o design a entregou: `text-3` dava 4,10:1 sobre
    `surface-3` e 3,71:1 sobre `surface-4` no escuro, e 3,79:1 sobre
    `surface-0` no claro. Os três abaixo de 4,5. A rampa de L foi ajustada até
    passarem com folga — é exatamente o trabalho que a derivação existe para
    fazer, e a razão de ela ter sobrevivido à troca de identidade.
  */
  for (const bg of SUPERFICIES) {
    for (const fg of TEXTOS) lista.push({ fg, bg, min: 4.5, tipo: "texto" });
  }

  // Bordas: separam controle do fundo.
  for (const bg of SUPERFICIES) {
    lista.push({ fg: "--vx-border-strong", bg, min: 3, tipo: "borda" });
  }

  /*
    Ação e semânticos, usados como texto e como ícone.

    Agora sobre TODAS as superfícies, e não só as três de baixo: o design põe
    ação destrutiva dentro de menu (`surface-4`) e de card (`surface-3`) —
    "Excluir canal" em vermelho sobre menu flutuante é a superfície mais
    comum do `danger` no produto inteiro.
  */
  for (const bg of SUPERFICIES) {
    for (const fg of [
      "--vx-accent",
      "--vx-accent-text",
      "--vx-danger",
      "--vx-warning",
      "--vx-success",
    ] as const) {
      lista.push({ fg, bg, min: 4.5, tipo: "texto" });
    }
  }

  // Texto sobre o preenchimento do botão primário, nos três estados.
  for (const bg of [
    "--vx-accent",
    "--vx-accent-hover",
    "--vx-accent-press",
  ] as const) {
    lista.push({ fg: "--vx-on-accent", bg, min: 4.5, tipo: "texto" });
  }

  // Presença: ponto pequeno, precisa se separar do fundo em que é desenhado.
  for (const fg of STATUS) {
    lista.push({ fg, bg: "--vx-surface-0", min: 3, tipo: "indicador" });
    lista.push({ fg, bg: "--vx-surface-1", min: 3, tipo: "indicador" });
  }

  /*
    O neutro semântico carrega o estado "herdar" da matriz tri-state e o
    "mudo" da voz — informação, não decoração, então vale o mínimo de
    indicador. Ele vive dentro de menu e de painel, que são as duas
    superfícies altas.
  */
  for (const bg of ["--vx-surface-3", "--vx-surface-4"] as const) {
    lista.push({ fg: "--vx-neutral", bg, min: 3, tipo: "indicador" });
  }

  return lista;
}

export const PARES: readonly Par[] = montar();

/**
 * Os tokens que NÃO aparecem em par nenhum, e a razão de cada um.
 *
 * Existe porque a auditoria de design perguntou "cadê o `--vx-border-subtle`
 * na lista?" — e a resposta certa era "de propósito", mas nada no código dizia
 * isso. Um token ausente da lista e um token esquecido da lista são
 * indistinguíveis olhando, e o segundo é um furo de contraste que ninguém vê.
 *
 * O teste em `pares.test.ts` exige que TODO token esteja num dos dois lugares:
 * usado em algum par, ou aqui com motivo escrito. Token novo que ninguém
 * classificou reprova — o default de uma decisão esquecida é "pare", como no
 * `TokenName` conferido contra o `tokens.css`.
 */
export const SEM_PAR: Readonly<Record<string, string>> = {
  "--vx-accent-soft":
    "Preenchimento de estado, nunca texto nem borda. O que é lido em cima " +
    "dela é `--vx-text-1`, e esse par é o mesmo de qualquer superfície.",
  "--vx-border-subtle":
    "Hairline decorativa, e a ausência é a decisão. O mínimo de 3:1 vale para " +
    "borda que CARREGA informação — limite de controle, foco. Esta separa " +
    "blocos que o espaçamento já separa; puxá-la para 3:1 a transformaria na " +
    "borda forte, que é o token ao lado e existe para isso.",
  "--vx-text-4":
    "Texto de controle DESABILITADO, e a dispensa é a mesma que a WCAG dá: " +
    "componente inativo está fora do critério de contraste, porque o baixo " +
    "contraste É a informação. Exigir 4,5:1 aqui o tornaria indistinguível " +
    "de `--vx-text-3`, que é justamente o estado ativo ao lado dele.",
};

/* ------------------------------------------------------------- exceções */

/**
 * Os pares que a PALETA DO DESIGN escolhe violar.
 *
 * ⚠ **Isto existe por decisão de quem toca o produto, e ela se sobrepõe à
 * régua anterior.** A paleta entregue no design tem `text.tertiary` e o acento
 * claro abaixo de 4,5:1 em algumas superfícies. A primeira versão desta
 * implementação abriu a rampa de L até todos passarem — o que trocava a cor do
 * design por uma aproximação. A decisão nova é seguir o design exatamente e
 * tratar o contraste depois, junto com o editor de tema.
 *
 * O que este mecanismo preserva: a guarda continua afiada para tudo o que NÃO
 * está listado aqui. O teste exige as duas direções — toda exceção listada
 * precisa realmente falhar (senão vira lixo que mente sobre uma decisão), e
 * nenhuma falha pode aparecer fora da lista. Uma regressão nova reprova o
 * build como sempre reprovou.
 *
 * `medido` é a razão real na paleta de fábrica, e ela é a dívida escrita em
 * número: 3,39:1 é bem diferente de 4,49:1, e a rodada que for consertar isto
 * precisa saber quais doem.
 */
export type Excecao = {
  readonly fg: TokenName;
  readonly bg: TokenName;
  readonly modo: "escuro" | "claro";
  /** A razão medida na paleta de fábrica. A dívida, em número. */
  readonly medido: number;
};

export const EXCECOES: readonly Excecao[] = [
  /*
    `--vx-text-3` é o texto terciário: timestamp, hint, cabeçalho de grupo. O
    design o pôs em `#77808E` no escuro e `#767F8C` no claro, e nos dois casos
    ele fica abaixo de 4,5:1 nas superfícies mais próximas do próprio tom.
  */
  { fg: "--vx-text-3", bg: "--vx-surface-2", modo: "escuro", medido: 4.46 },
  { fg: "--vx-text-3", bg: "--vx-surface-3", modo: "escuro", medido: 4.1 },
  { fg: "--vx-text-3", bg: "--vx-surface-4", modo: "escuro", medido: 3.71 },
  { fg: "--vx-text-3", bg: "--vx-surface-0", modo: "claro", medido: 3.39 },
  { fg: "--vx-text-3", bg: "--vx-surface-1", modo: "claro", medido: 3.68 },
  { fg: "--vx-text-3", bg: "--vx-surface-2", modo: "claro", medido: 3.94 },
  { fg: "--vx-text-3", bg: "--vx-surface-3", modo: "claro", medido: 4.05 },
  { fg: "--vx-text-3", bg: "--vx-surface-4", modo: "claro", medido: 4.05 },

  /*
    `--vx-danger` dentro de menu. O design o desenha em `#E8596B`, que sobre a
    superfície flutuante fica em 4,28 — e "Excluir canal" em vermelho dentro de
    menu é a superfície mais comum do token no produto inteiro.
  */
  { fg: "--vx-danger", bg: "--vx-surface-4", modo: "escuro", medido: 4.28 },

  /*
    O acento claro (`#0E7C86`) contra as duas superfícies mais escuras do tema
    claro. O próprio design anotou que escolheu este valor "para manter 4,5:1
    sobre superfície clara" — e mantém, sobre o branco. Sobre o rail e a
    coluna, que são os tons mais fundos do claro, não.
  */
  { fg: "--vx-accent", bg: "--vx-surface-0", modo: "claro", medido: 4.14 },
  { fg: "--vx-accent-text", bg: "--vx-surface-0", modo: "claro", medido: 4.14 },
  { fg: "--vx-accent", bg: "--vx-surface-1", modo: "claro", medido: 4.49 },
  { fg: "--vx-accent-text", bg: "--vx-surface-1", modo: "claro", medido: 4.49 },
];

/** Este par está dispensado neste modo? */
export function dispensado(
  par: Par,
  modo: "escuro" | "claro",
): boolean {
  return EXCECOES.some(
    (e) => e.fg === par.fg && e.bg === par.bg && e.modo === modo,
  );
}

/**
 * As falhas que ainda contam — as que NÃO estão dispensadas.
 *
 * Existe como função e não como `filter` repetido em cada teste porque são
 * quatro chamadores (o contraste do `tokens.css`, a reprodução da semente
 * padrão, a varredura de matiz e as paletas curadas), e quatro cópias do mesmo
 * filtro é a divergência que este arquivo inteiro existe para evitar.
 *
 * ⚠ A dispensa vale para QUALQUER paleta, não só a de fábrica. Os pares
 * listados falham por causa das luminosidades da RAMPA — `text-3` e o acento
 * claro têm o L que o design escolheu —, e girar o matiz do neutro não move
 * luminosidade nenhuma. Uma dispensa que valesse só para a semente padrão
 * deixaria a varredura reprovar por um motivo já decidido.
 */
export function falhasQueContam(
  falhas: readonly Falha[],
  modo: "escuro" | "claro",
): readonly Falha[] {
  return falhas.filter((f) => !dispensado(f.par, modo));
}

export type Falha = {
  readonly par: Par;
  readonly razao: number;
};

export type Veredito = {
  readonly ok: boolean;
  readonly falhas: readonly Falha[];
  /** O par mais apertado que PASSOU — o que mede quanta folga a paleta tem. */
  readonly maisApertado: Falha | null;
};

/**
 * Verifica uma paleta inteira.
 *
 * Recebe o mapa de token para hex, e não lê o CSS: serve tanto para o
 * `tokens.css` do projeto quanto para a paleta que o usuário acabou de
 * derivar, que ainda não está em lugar nenhum.
 *
 * Token faltando é ERRO, não par ignorado. Um verificador que pula o que não
 * encontra aprova por omissão exatamente quando alguém renomeia um token.
 */
export function verificar(paleta: Partial<Record<TokenName, string>>): Veredito {
  const falhas: Falha[] = [];
  let maisApertado: Falha | null = null;
  let folgaMinima = Infinity;

  for (const par of PARES) {
    const fg = paleta[par.fg];
    const bg = paleta[par.bg];
    if (!fg || !bg) {
      throw new Error(
        `token ausente na paleta: ${!fg ? par.fg : par.bg} — o verificador não ` +
          `mede o que não recebe, e não pode aprovar por omissão`,
      );
    }

    const r = razao(fg, bg);
    if (r < par.min) {
      falhas.push({ par, razao: r });
      continue;
    }

    const folga = r - par.min;
    if (folga < folgaMinima) {
      folgaMinima = folga;
      maisApertado = { par, razao: r };
    }
  }

  return { ok: falhas.length === 0, falhas, maisApertado };
}
