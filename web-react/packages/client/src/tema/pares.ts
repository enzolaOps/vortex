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

  // Texto sobre toda superfície em que pode aparecer.
  for (const bg of SUPERFICIES) {
    for (const fg of TEXTOS) lista.push({ fg, bg, min: 4.5, tipo: "texto" });
  }

  // Bordas: separam controle do fundo.
  for (const bg of SUPERFICIES) {
    lista.push({ fg: "--vx-border-strong", bg, min: 3, tipo: "borda" });
  }

  // Ação e semânticos, usados como texto e como ícone sobre o fundo base.
  for (const bg of ["--vx-surface-0", "--vx-surface-1", "--vx-surface-2"] as const) {
    for (const fg of [
      "--vx-accent",
      "--vx-danger",
      "--vx-warning",
      "--vx-success",
    ] as const) {
      lista.push({ fg, bg, min: 4.5, tipo: "texto" });
    }
  }

  // Texto sobre o preenchimento do botão primário.
  lista.push({ fg: "--vx-on-accent", bg: "--vx-accent", min: 4.5, tipo: "texto" });
  lista.push({
    fg: "--vx-on-accent",
    bg: "--vx-accent-hover",
    min: 4.5,
    tipo: "texto",
  });

  // Presença: ponto pequeno, precisa se separar do fundo em que é desenhado.
  for (const fg of STATUS) {
    lista.push({ fg, bg: "--vx-surface-0", min: 3, tipo: "indicador" });
    lista.push({ fg, bg: "--vx-surface-1", min: 3, tipo: "indicador" });
  }

  return lista;
}

export const PARES: readonly Par[] = montar();

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
