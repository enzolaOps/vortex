/**
 * Da semente à paleta inteira.
 *
 * A referência da fase 4 é explícita: o usuário escolhe a PALETA e o app
 * deriva o resto. Não são 20 campos de cor — isso seria editor de token com
 * outro nome, e reintroduziria os quatro problemas que o color picker por
 * componente tem, sendo o pior deles que contraste vira impossível de
 * garantir.
 *
 * O que o usuário escolhe: modo, matiz do neutro, quanto croma o neutro tem, e
 * a cor de acento. O que o app decide: **toda a luminosidade**.
 *
 * É essa divisão que transforma "avisar sobre contraste" em "não conseguir
 * produzir contraste ruim". Em OKLCH o L é perceptualmente uniforme, então uma
 * rampa de L fixa entrega o mesmo contraste em qualquer matiz. O usuário mexe
 * no que é identidade; a régua fica com o app.
 *
 * As rampas abaixo NÃO foram inventadas: saíram da conversão da paleta atual
 * de `tokens.css` para OKLCH. A semente padrão reproduz a paleta de hoje, e um
 * teste guarda isso — rampa que não reproduz o ponto de partida é rampa que
 * mudou o produto sem ninguém decidir.
 *
 * Com UMA exceção, e ela veio da varredura: `--vx-border-strong` estava em
 * exatamente 3,00:1 contra `--vx-surface-3` no tema escuro. Zero folga. A
 * paleta passava no `pnpm contrast` e passava por sorte — qualquer matiz
 * diferente do violáceo original derrubava o par abaixo do mínimo, e mesmo sem
 * o picker qualquer ajuste futuro na rampa quebraria.
 *
 * A luminosidade da borda forte subiu para 0,61 nos dois modos, dando 3,34:1
 * no pior matiz do escuro e 3,20:1 no do claro. `tokens.css` foi atualizado
 * junto, porque derivação e fonte discordando é a divergência que este
 * arquivo inteiro existe para evitar.
 */
import type { TokenName } from "../preset/tokens";
import { hexParaOklch, oklchParaHex } from "./cor";

export type Modo = "escuro" | "claro";

export type Semente = {
  readonly modo: Modo;
  /** Matiz do neutro, 0–360. É o que dá "violáceo" ao cinza. */
  readonly matiz: number;
  /** Multiplicador do croma do neutro. 0 = cinza puro, 1 = a paleta de hoje. */
  readonly croma: number;
  /** A cor de acento, como o usuário a escolheu. Matiz e croma são lidos dela. */
  readonly acento: string;
};

export const SEMENTE_PADRAO: Record<Modo, Semente> = {
  escuro: { modo: "escuro", matiz: 295, croma: 1, acento: "#bcaef2" },
  claro: { modo: "claro", matiz: 299, croma: 1, acento: "#5b45c4" },
};

export const LIMITES_DA_SEMENTE = {
  matiz: { min: 0, max: 360 },
  croma: { min: 0, max: 2.5 },
} as const;

/**
 * Um degrau da rampa.
 *
 * `dh` é o DESVIO de matiz em relação ao da semente, não um matiz absoluto. A
 * paleta original não usa matiz único: os degraus vão de 291,6° a 301,4°,
 * ajuste à mão que dá vida ao neutro. Guardar o desvio preserva essa relação
 * quando o usuário gira o matiz — a família roda junto em vez de achatar num
 * tom só.
 *
 * É também o que torna possível o teste forte: com desvio, a semente padrão
 * reproduz `tokens.css` EXATAMENTE, nos 20 tokens e nos dois modos.
 */
type Degrau = { l: number; c: number; dh: number };

/** Cor semântica: matiz ABSOLUTO — vermelho tem que continuar vermelho. */
type Semantica = { l: number; c: number; h: number };

type Rampa = {
  readonly superficie: readonly [Degrau, Degrau, Degrau, Degrau];
  readonly texto: readonly [Degrau, Degrau, Degrau];
  readonly bordaSutil: Degrau;
  readonly bordaForte: Degrau;
  readonly acento: Degrau;
  readonly acentoHover: Degrau;
  readonly acentoSuave: Degrau;
  readonly sobreAcento: Degrau;
  readonly perigo: Semantica;
  readonly aviso: Semantica;
  readonly sucesso: Semantica;
  readonly offline: Degrau;
};

const RAMPAS: Record<Modo, Rampa> = {
  escuro: {
    superficie: [
      { l: 0.200146, c: 0.013939, dh: -3.362 },
      { l: 0.231638, c: 0.017258, dh: -4.926 },
      { l: 0.267284, c: 0.020429, dh: -1.696 },
      { l: 0.309759, c: 0.023372, dh: 0.582 },
    ],
    texto: [
      { l: 0.940893, c: 0.010882, dh: 2.619 },
      { l: 0.792904, c: 0.028461, dh: 2.185 },
      { l: 0.705315, c: 0.033772, dh: 2.463 },
    ],
    bordaSutil: { l: 0.287719, c: 0.020055, dh: -1.565 },
    bordaForte: { l: 0.610259, c: 0.047018, dh: 0.323 },
    acento: { l: 0.78681, c: 0.096395, dh: 0 },
    acentoHover: { l: 0.846115, c: 0.071206, dh: 1.216 },
    acentoSuave: { l: 0.284447, c: 0.049093, dh: -0.273 },
    sobreAcento: { l: 0.210728, c: 0.024018, dh: 4.623 },
    perigo: { l: 0.811323, c: 0.110353, h: 8.496 },
    aviso: { l: 0.863762, c: 0.090457, h: 82.071 },
    sucesso: { l: 0.839823, c: 0.086609, h: 156.952 },
    offline: { l: 0.575265, c: 0.043215, dh: 1.473 },
  },
  claro: {
    superficie: [
      { l: 0.957021, c: 0.012361, dh: 2.285 },
      { l: 0.976375, c: 0.008196, dh: 2.358 },
      { l: 0.989689, c: 0.004082, dh: 2.427 },
      { l: 1, c: 0, dh: 0 },
    ],
    texto: [
      { l: 0.239641, c: 0.023036, dh: -2.919 },
      { l: 0.400967, c: 0.035615, dh: -1.134 },
      { l: 0.486767, c: 0.038825, dh: -0.7 },
    ],
    bordaSutil: { l: 0.912599, c: 0.023491, dh: 0.343 },
    bordaForte: { l: 0.609573, c: 0.041331, dh: -0.28 },
    acento: { l: 0.489427, c: 0.188565, dh: 0 },
    acentoHover: { l: 0.43063, c: 0.180921, dh: -1.184 },
    acentoSuave: { l: 0.933132, c: 0.030146, dh: 13.301 },
    sobreAcento: { l: 1, c: 0, dh: 0 },
    perigo: { l: 0.506756, c: 0.174791, h: 17.182 },
    aviso: { l: 0.474597, c: 0.100491, h: 74.2 },
    sucesso: { l: 0.478729, c: 0.102331, h: 156.821 },
    offline: { l: 0.534453, c: 0.045534, dh: -3.112 },
  },};




/**
 * Teto de croma do acento, por modo.
 *
 * Não é gosto: é o ponto onde a luminância WCAG começa a se afastar o
 * suficiente do que a rampa de L promete. Croma alto empurra a luminância
 * relativa para longe do L perceptual, e é exatamente aí que a garantia de
 * contraste deixaria de valer para alguns matizes. O valor saiu da varredura
 * de todos os matizes no teste, não de tentativa e erro na tela.
 */
const TETO_DE_CROMA: Record<Modo, number> = { escuro: 0.11, claro: 0.19 };

function neutro(degrau: Degrau, s: Semente): string {
  return oklchParaHex({
    l: degrau.l,
    c: degrau.c * s.croma,
    h: s.matiz + degrau.dh,
  });
}

export function derivar(s: Semente): Record<TokenName, string> {
  const r = RAMPAS[s.modo];
  const acento = hexParaOklch(s.acento);
  const croma = Math.min(acento.c, TETO_DE_CROMA[s.modo]);

  /** Acento: matiz e croma vêm do usuário; a luminosidade é do app. */
  const daAcao = (d: Degrau): string =>
    oklchParaHex({ l: d.l, c: Math.min(d.c, croma), h: acento.h + d.dh });

  const semantica = (x: Semantica): string =>
    oklchParaHex({ l: x.l, c: x.c, h: x.h });

  return {
    "--vx-surface-0": neutro(r.superficie[0], s),
    "--vx-surface-1": neutro(r.superficie[1], s),
    "--vx-surface-2": neutro(r.superficie[2], s),
    "--vx-surface-3": neutro(r.superficie[3], s),

    "--vx-text-1": neutro(r.texto[0], s),
    "--vx-text-2": neutro(r.texto[1], s),
    "--vx-text-3": neutro(r.texto[2], s),

    "--vx-border-subtle": neutro(r.bordaSutil, s),
    "--vx-border-strong": neutro(r.bordaForte, s),

    "--vx-accent": daAcao(r.acento),
    "--vx-accent-hover": daAcao(r.acentoHover),
    "--vx-accent-soft": daAcao(r.acentoSuave),
    // `on-accent` é NEUTRO, não derivado do acento: ele precisa contrastar com
    // o acento, e uma cor tirada do mesmo matiz corre atrás dele.
    "--vx-on-accent": neutro(r.sobreAcento, s),

    "--vx-danger": semantica(r.perigo),
    "--vx-warning": semantica(r.aviso),
    "--vx-success": semantica(r.sucesso),

    // Presença repete os semânticos de propósito: "ocupado" e "erro" são o
    // mesmo vermelho no produto, e separá-los aqui criaria duas fontes para a
    // mesma ideia.
    "--vx-status-online": semantica(r.sucesso),
    "--vx-status-idle": semantica(r.aviso),
    "--vx-status-dnd": semantica(r.perigo),
    "--vx-status-offline": neutro(r.offline, s),
  };
}

/** A semente de uma cor de acento escolhida, mantendo o resto. */
export function comAcento(s: Semente, hex: string): Semente {
  return { ...s, acento: hex };
}

export function limitar(s: Semente): Semente {
  return {
    ...s,
    matiz: ((s.matiz % 360) + 360) % 360,
    croma: Math.min(
      LIMITES_DA_SEMENTE.croma.max,
      Math.max(LIMITES_DA_SEMENTE.croma.min, s.croma),
    ),
  };
}
