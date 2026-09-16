/**
 * As preferências da tela Desktop do cliente, traduzidas para a casca.
 *
 * ⚠ **Este módulo nasce de um defeito mudo: tudo o que a tela Desktop gravava
 * era DESCARTADO.** O cliente manda as chaves dele (`iniciarComSistema`,
 * `barraNativa`, `aoFechar`…) e o main só aceitava as do upstream
 * (`customFrame`, `minimiseToTray`…). O interruptor mexia, o `invoke`
 * resolvia sem erro, e no próximo início tudo voltava ao padrão.
 *
 * ⚠ **Sem `electron` aqui, de propósito.** É a tradução PURA — que chave vira
 * que campo, que valor é aceito —, e é ela que quebra em silêncio. Os efeitos
 * (registrar no sistema, aplicar na janela) moram em `preferencias.ts`; este
 * arquivo roda no teste sem Electron nenhum.
 */

export const AO_FECHAR = ["bandeja", "encerrar", "perguntar"] as const;
export type AoFechar = (typeof AO_FECHAR)[number];

/** O que o cliente pode ESCREVER. Nada fora desta lista chega ao store. */
export type PreferenciasGravaveis = {
  iniciarComSistema: boolean;
  minimizarParaBandeja: boolean;
  abrirMinimizado: boolean;
  lembrarJanela: boolean;
  sempreNoTopoEmChamada: boolean;
  barraNativa: boolean;
  aoFechar: AoFechar;
  aceleracaoDeHardware: boolean;
  reduzirEmSegundoPlano: boolean;
};

export type ChaveGravavel = keyof PreferenciasGravaveis;

/**
 * O que a casca devolve na leitura: as gravadas mais o que está EM USO.
 *
 * ⚠ **`barraNativaEmUso` e `aceleracaoEmUso` existem porque as duas só valem
 * no próximo início.** A moldura é decidida ao criar a janela e o backend de
 * render antes do `ready`. Se o cliente escondesse a barra custom pela
 * PREFERÊNCIA, marcar "barra do sistema" deixaria a janela atual sem moldura
 * nenhuma e sem barra nossa — uma janela que não fecha. O cliente desenha
 * pelo que está em uso e avisa que falta reiniciar.
 */
export type PreferenciasLidas = PreferenciasGravaveis & {
  barraNativaEmUso: boolean;
  aceleracaoEmUso: boolean;
};

/** Os campos do store da casca que as preferências tocam. */
export type ConfigDasPreferencias = {
  iniciarComSistema: boolean;
  minimiseToTray: boolean;
  startMinimisedToTray: boolean;
  lembrarJanela: boolean;
  sempreNoTopoEmChamada: boolean;
  customFrame: boolean;
  aoFechar: AoFechar;
  hardwareAcceleration: boolean;
  reduzirEmSegundoPlano: boolean;
};

const ehBooleano = (v: unknown): v is boolean => typeof v === "boolean";
const ehAoFechar = (v: unknown): v is AoFechar =>
  typeof v === "string" && (AO_FECHAR as readonly string[]).includes(v);

/*
  ⚠ **`Record` sobre a chave, e não uma lista de strings.** A allowlist
  anterior era um array solto que ninguém conferia contra o tipo — e foi
  exatamente por ele divergir do cliente que tudo era descartado. Aqui chave
  nova no tipo não compila sem validador.
*/
const VALIDADORES: { [K in ChaveGravavel]: (v: unknown) => v is PreferenciasGravaveis[K] } = {
  iniciarComSistema: ehBooleano,
  minimizarParaBandeja: ehBooleano,
  abrirMinimizado: ehBooleano,
  lembrarJanela: ehBooleano,
  sempreNoTopoEmChamada: ehBooleano,
  barraNativa: ehBooleano,
  aoFechar: ehAoFechar,
  aceleracaoDeHardware: ehBooleano,
  reduzirEmSegundoPlano: ehBooleano,
};

export type Gravacao = {
  [K in ChaveGravavel]: { chave: K; valor: PreferenciasGravaveis[K] };
}[ChaveGravavel];

/**
 * Confere chave E tipo. O renderer executa conteúdo de terceiro, e `config` é
 * um arquivo em disco que o main lê para decidir comportamento: aceitar
 * `aoFechar: {}` ou `customFrame: "sim"` gravaria lixo que só explode no
 * próximo início.
 */
export function validarGravacao(chave: unknown, valor: unknown): Gravacao | undefined {
  if (typeof chave !== "string" || !Object.hasOwn(VALIDADORES, chave)) return undefined;
  const validar = VALIDADORES[chave as ChaveGravavel] as (v: unknown) => boolean;
  return validar(valor) ? ({ chave, valor } as Gravacao) : undefined;
}

/**
 * Em que campos do store uma gravação se transforma.
 *
 * ⚠ **"Minimizar para a bandeja" e "Ao fechar a janela" são a MESMA decisão**,
 * e a tela mostra as duas. Guardadas independentes, dariam o estado
 * contraditório "minimizar: sim, ao fechar: encerrar". A fonte é `aoFechar`;
 * o interruptor escreve nela, e `minimiseToTray` (lido pela casca upstream)
 * acompanha.
 */
export function camposDaGravacao(
  g: Gravacao,
  plataforma: string,
): Partial<ConfigDasPreferencias> {
  switch (g.chave) {
    case "iniciarComSistema":
      return { iniciarComSistema: g.valor };
    case "minimizarParaBandeja":
      return {
        aoFechar: g.valor ? "bandeja" : "encerrar",
        minimiseToTray: g.valor,
      };
    case "aoFechar":
      return { aoFechar: g.valor, minimiseToTray: g.valor === "bandeja" };
    case "abrirMinimizado":
      return { startMinimisedToTray: g.valor };
    case "lembrarJanela":
      return { lembrarJanela: g.valor };
    case "sempreNoTopoEmChamada":
      return { sempreNoTopoEmChamada: g.valor };
    case "barraNativa":
      /* No macOS a moldura é sempre a do sistema com os semáforos por cima; a
         preferência não tem o que mudar lá, e gravá-la faria a tela mentir. */
      return plataforma === "darwin" ? {} : { customFrame: !g.valor };
    case "aceleracaoDeHardware":
      return { hardwareAcceleration: g.valor };
    case "reduzirEmSegundoPlano":
      return { reduzirEmSegundoPlano: g.valor };
  }
}

/** O que o cliente recebe ao hidratar. */
export function preferenciasParaOCliente(
  c: ConfigDasPreferencias,
  emUso: { customFrame: boolean; hardwareAcceleration: boolean },
  plataforma: string,
): PreferenciasLidas {
  const mac = plataforma === "darwin";
  return {
    iniciarComSistema: c.iniciarComSistema,
    minimizarParaBandeja: c.aoFechar === "bandeja",
    abrirMinimizado: c.startMinimisedToTray,
    lembrarJanela: c.lembrarJanela,
    sempreNoTopoEmChamada: c.sempreNoTopoEmChamada,
    barraNativa: mac ? false : !c.customFrame,
    aoFechar: c.aoFechar,
    aceleracaoDeHardware: c.hardwareAcceleration,
    reduzirEmSegundoPlano: c.reduzirEmSegundoPlano,
    barraNativaEmUso: mac ? false : !emUso.customFrame,
    aceleracaoEmUso: emUso.hardwareAcceleration,
  };
}

/**
 * `aoFechar` de quem nunca o gravou: deriva do `minimiseToTray` do upstream,
 * para quem desligou a bandeja numa casca antiga não passar a ter a janela
 * escondida ao fechar.
 */
export function aoFecharInicial(guardado: unknown, minimiseToTray: boolean): AoFechar {
  return ehAoFechar(guardado) ? guardado : minimiseToTray ? "bandeja" : "encerrar";
}

/* ------------------------------------------------ janela por monitor */

export type Retangulo = { x: number; y: number; width: number; height: number };
export type EstadoDaJanela = Retangulo & { isMaximised: boolean };

/**
 * A configuração de monitores como texto — a CHAVE do estado guardado.
 *
 * ⚠ **Por conjunto de monitores, e não por monitor avulso**, porque é isso
 * que "restaura o layout em ultrawide" pede: o notebook sozinho e o notebook
 * na base com o ultrawide são dois arranjos, e cada um tem a janela onde a
 * pessoa a deixou. Ordenado, para a ordem em que o sistema lista as telas
 * não criar chaves diferentes para o mesmo arranjo.
 */
export function assinaturaDasTelas(telas: readonly { bounds: Retangulo }[]): string {
  return telas
    .map(({ bounds: b }) => `${b.x},${b.y},${b.width}x${b.height}`)
    .sort()
    .join("|");
}

/**
 * Pelo menos isto visível numa tela, NOS DOIS EIXOS. Área não basta: uma
 * faixa de 20×600 na borda soma área e não dá onde agarrar a janela — ela
 * nasceria inalcançável.
 */
const LADO_MINIMO = 100;

export function cabeNasTelas(e: Retangulo, telas: readonly { workArea: Retangulo }[]): boolean {
  if (!(e.width > 0 && e.height > 0)) return false;
  return telas.some(({ workArea: w }) => {
    const larg = Math.min(e.x + e.width, w.x + w.width) - Math.max(e.x, w.x);
    const alt = Math.min(e.y + e.height, w.y + w.height) - Math.max(e.y, w.y);
    return larg >= LADO_MINIMO && alt >= LADO_MINIMO;
  });
}

/** O estado a restaurar para este arranjo, ou nada. */
export function estadoParaRestaurar(
  porArranjo: Readonly<Record<string, EstadoDaJanela>> | undefined,
  telas: readonly { bounds: Retangulo; workArea: Retangulo }[],
): EstadoDaJanela | undefined {
  const salvo = porArranjo?.[assinaturaDasTelas(telas)];
  return salvo && cabeNasTelas(salvo, telas) ? salvo : undefined;
}

/** Quantos arranjos guardar. Cada doca de escritório é um; mais que isso é lixo. */
const ARRANJOS_GUARDADOS = 8;

export function guardarEstado(
  porArranjo: Readonly<Record<string, EstadoDaJanela>> | undefined,
  assinatura: string,
  estado: EstadoDaJanela,
): Record<string, EstadoDaJanela> {
  /* Reinsere no fim: a ordem de inserção é a de uso, e o mais antigo sai. */
  const resto = Object.entries(porArranjo ?? {}).filter(([k]) => k !== assinatura);
  return Object.fromEntries([...resto.slice(-(ARRANJOS_GUARDADOS - 1)), [assinatura, estado]]);
}
