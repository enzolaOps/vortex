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
  escuro: { modo: "escuro", matiz: 258, croma: 1, acento: "#35c2cc" },
  claro: { modo: "claro", matiz: 258, croma: 1, acento: "#0e7c86" },
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
  readonly superficie: readonly [Degrau, Degrau, Degrau, Degrau, Degrau];
  readonly texto: readonly [Degrau, Degrau, Degrau, Degrau];
  readonly bordaSutil: Degrau;
  readonly bordaForte: Degrau;
  readonly acento: Degrau;
  readonly acentoHover: Degrau;
  readonly acentoPress: Degrau;
  readonly acentoTexto: Degrau;
  readonly acentoSuave: Degrau;
  readonly sobreAcento: Degrau;
  readonly perigo: Semantica;
  /*
    O vermelho de TEXTO, separado do de preenchimento.

    O design usa dois: `#E8596B` para borda e fundo tingido, `#F0808D` para a
    palavra "Excluir" dentro de um menu. É a mesma divisão que `acento` e
    `acentoTexto` já fazem, e pela mesma razão — a cor que funciona como
    superfície de 3px não é a que funciona como letra de 13px sobre ela.
  */
  readonly perigoTexto: Semantica;
  readonly aviso: Semantica;
  readonly sucesso: Semantica;
  readonly neutro: Degrau;
  readonly offline: Degrau;
};

/**
 * A rampa de superfície tem PASSO CONSTANTE em L — e isso é o conserto de um
 * problema medido, não gosto.
 *
 * A rampa original tinha degraus de 1,075 · 1,105 · 1,152 no escuro e 1,060 ·
 * 1,040 · 1,031 no claro. Quatro superfícies que somavam 1,368:1 e 1,137:1 de
 * ponta a ponta: elevação que existia no token e quase não existia no olho —
 * e num app onde profundidade vem de CAMADA e não de sombra, isso é a única
 * pista de profundidade que existe.
 *
 * Passo constante em L é a escolha certa porque em OKLCH o L é perceptualmente
 * uniforme: `surface-1 → surface-2` tem que parecer o mesmo salto que
 * `surface-2 → surface-3`, e é isso que passo constante entrega. Em razão WCAG
 * os degraus saem desiguais (1,10 · 1,14 · 1,15 no escuro) porque a razão não é
 * linear no L — o número desigual é o sintoma de estar certo, não de errado.
 *
 * Pelo mesmo motivo, o passo foi escolhido pelo ΔL e não pela razão: no
 * extremo escuro a razão WCAG é dominada pelo termo de flare (`+0,05`) e
 * comprime tudo perto de 1,1 por mais que se abra. Abrir até L 0,150 na base
 * levava o span a 1,53 e dava um `#0b0a11` mais escuro que a base de qualquer
 * app da categoria, sem melhorar o primeiro degrau. O ΔL é a medida honesta
 * aqui; a razão é o piso de segurança.
 *
 * **A direção foi ditada pelo orçamento, não escolhida.** Os pares de
 * `pares.ts` dizem onde há folga: no escuro o par mais apertado é `text-3 /
 * surface-3` (era 1,11× o mínimo), então SUBIR a superfície mais alta é caro e
 * abrir para baixo é quase de graça — a base foi de L 0,200 para 0,180 e a
 * superfície de topo quase não se moveu. No claro o topo é branco puro e não
 * sobe, então a abertura desce também, e o par apertado ali era
 * `border-strong / surface-0`: a borda escureceu de L 0,610 para 0,580 para
 * pagar por isso.
 *
 * Resultado medido: no escuro os degraus vão de 1,075 · 1,105 · 1,152 para
 * 1,10 · 1,14 · 1,15 e o span de 1,368 para 1,447; no claro, de 1,060 · 1,040 ·
 * 1,031 para 1,081 · 1,069 · 1,067 e o span de 1,137 para 1,233. O ganho maior
 * é no claro, e é o de EVENNESS: o degrau lá ENCOLHIA a cada passo. O pior par
 * segue em 1,10× e 1,12× do mínimo.
 */
const RAMPAS: Record<Modo, Rampa> = {
  escuro: {
    superficie: [
      { l: 0.139451, c: 0.004826, dh: 4.802 },
      { l: 0.184827, c: 0.012048, dh: -3.869 },
      { l: 0.207604, c: 0.013453, dh: 0.368 },
      { l: 0.242084, c: 0.017048, dh: 1.761 },
      { l: 0.275873, c: 0.022189, dh: 4.481 },
    ],
    texto: [
      { l: 0.935727, c: 0.009173, dh: 0.336 },
      { l: 0.747799, c: 0.021265, dh: -0.514 },
      { l: 0.597175, c: 0.023874, dh: 1.19 },
      { l: 0.44693, c: 0.025712, dh: 1.175 },
    ],
    /*
      ⚠ **0,255 e era 0,305 — a hairline saía CLARA demais em toda divisória.**

      O design escreve a divisória como `rgba(255,255,255,0.06)`, um véu, e não
      uma cor. Um véu compõe certo sobre qualquer fundo; uma cor chapada só
      acerta a superfície para a qual foi escolhida. Medido: `#292f39` é o que
      6% de branco dá sobre `--vx-surface-3` — e as divisórias deste app vivem
      sobre `surface-0`, `surface-1` e `surface-2`, onde o mesmo véu compõe
      `#17181a`, `#1d2126` e `#22262c`. Ou seja, o token estava calibrado para
      a superfície onde ele quase não aparece.

      Um valor OPACO não pode acertar as quatro, e ele continua opaco porque a
      derivação inteira é de cores opacas — trocar por `color-mix` aqui tiraria
      a hairline do picker de paleta, que deriva TODOS os tokens da semente.
      0,255 é o meio das duas superfícies onde as divisórias de fato estão.
    */
    bordaSutil: { l: 0.255, c: 0.02, dh: 1.5 },
    bordaForte: { l: 0.561559, c: 0.025425, dh: -3.51 },
    acento: { l: 0.746311, c: 0.115375, dh: 0 },
    acentoHover: { l: 0.801338, c: 0.114854, dh: -0.675 },
    acentoPress: { l: 0.612283, c: 0.096094, dh: 3.724 },
    acentoTexto: { l: 0.856754, c: 0.095046, dh: -1.601 },
    acentoSuave: { l: 0.28, c: 0.035, dh: 3.5 },
    sobreAcento: { l: 0.16, c: 0.008, dh: 0 },
    perigo: { l: 0.655027, c: 0.176981, h: 15.968 },
    perigoTexto: { l: 0.727685, c: 0.137474, h: 13.749 },
    aviso: { l: 0.788215, c: 0.117607, h: 79.445 },
    sucesso: { l: 0.748358, c: 0.146918, h: 158.512 },
    neutro: { l: 0.565837, c: 0.02148, dh: -2.401 },
    offline: { l: 0.565837, c: 0.02148, dh: -2.401 },
  },
  claro: {
    superficie: [
      { l: 0.939683, c: 0.005795, dh: 6.532 },
      { l: 0.966482, c: 0.004545, dh: 0.325 },
      { l: 0.990591, c: 0.001703, dh: -10.161 },
      { l: 1, c: 0, dh: 0 },
      { l: 1, c: 0, dh: 0 },
    ],
    texto: [
      { l: 0.203692, c: 0.011029, dh: 2.665 },
      { l: 0.453359, c: 0.022719, dh: -2.365 },
      { l: 0.593431, c: 0.022555, dh: -0.499 },
      { l: 0.66, c: 0.021, dh: 1.5 },
    ],
    bordaSutil: { l: 0.905, c: 0.008, dh: 1.5 },
    bordaForte: { l: 0.607821, c: 0.018614, dh: 1.421 },
    acento: { l: 0.536185, c: 0.08876, dh: 0 },
    acentoHover: { l: 0.45, c: 0.08, dh: -0.704 },
    acentoPress: { l: 0.4, c: 0.072, dh: -0.704 },
    acentoTexto: { l: 0.536185, c: 0.08876, dh: 0 },
    acentoSuave: { l: 0.945, c: 0.03, dh: 3.5 },
    sobreAcento: { l: 1, c: 0, dh: 0 },
    perigo: { l: 0.538347, c: 0.184859, h: 18.141 },
    /*
      No CLARO os dois são o mesmo valor, e isso não é descuido.

      No escuro o texto precisa ser mais CLARO que o preenchimento para se
      separar dele; no claro seria o contrário, e `#c22c43` já está no limite
      de baixo — clareá-lo derrubaria o contraste sobre branco. `acentoTexto`
      repete `acento` no claro exatamente pelo mesmo motivo.
    */
    perigoTexto: { l: 0.538347, c: 0.184859, h: 18.141 },
    aviso: { l: 0.472782, c: 0.098779, h: 77.361 },
    sucesso: { l: 0.480897, c: 0.113976, h: 154.976 },
    neutro: { l: 0.565837, c: 0.02148, dh: -2.401 },
    offline: { l: 0.565837, c: 0.02148, dh: -2.401 },
  },
};



/**
 * Teto de croma do acento, por modo.
 *
 * Não é gosto: é o ponto onde a luminância WCAG começa a se afastar o
 * suficiente do que a rampa de L promete. Croma alto empurra a luminância
 * relativa para longe do L perceptual, e é exatamente aí que a garantia de
 * contraste deixaria de valer para alguns matizes. O valor saiu da varredura
 * de todos os matizes no teste, não de tentativa e erro na tela.
 */
const TETO_DE_CROMA: Record<Modo, number> = { escuro: 0.12, claro: 0.19 };

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
    "--vx-surface-4": neutro(r.superficie[4], s),

    "--vx-text-1": neutro(r.texto[0], s),
    "--vx-text-2": neutro(r.texto[1], s),
    "--vx-text-3": neutro(r.texto[2], s),
    "--vx-text-4": neutro(r.texto[3], s),

    "--vx-border-subtle": neutro(r.bordaSutil, s),
    "--vx-border-strong": neutro(r.bordaForte, s),

    "--vx-accent": daAcao(r.acento),
    "--vx-accent-hover": daAcao(r.acentoHover),
    "--vx-accent-press": daAcao(r.acentoPress),
    "--vx-accent-text": daAcao(r.acentoTexto),
    "--vx-accent-soft": daAcao(r.acentoSuave),
    // `on-accent` é NEUTRO, não derivado do acento: ele precisa contrastar com
    // o acento, e uma cor tirada do mesmo matiz corre atrás dele.
    "--vx-on-accent": neutro(r.sobreAcento, s),

    "--vx-danger": semantica(r.perigo),
    "--vx-danger-text": semantica(r.perigoTexto),
    "--vx-warning": semantica(r.aviso),
    "--vx-success": semantica(r.sucesso),
    // Neutro semântico: "herdar" na matriz tri-state, mudo, offline. Cinza da
    // família do neutro, e não um quarto matiz — ele quer dizer AUSÊNCIA de
    // estado, e uma cor própria transformaria ausência em mais um estado.
    "--vx-neutral": neutro(r.neutro, s),

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
