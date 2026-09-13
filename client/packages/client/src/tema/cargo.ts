/**
 * A cor de cargo, com a luminosidade decidida pelo APP.
 *
 * O cargo colorido vem do servidor — é escolha de quem administra, e o Vortex
 * não tem por que discutir o matiz. O que ele não pode aceitar é a
 * LUMINOSIDADE, porque é ela que decide se o nome é legível.
 *
 * O furo que isto fecha era o único da garantia de contraste do projeto. O
 * picker de paleta torna contraste ruim impossível para vinte tokens fixando a
 * rampa de L; a cor de cargo passava por fora, direto para o DOM via `style`, e
 * o `pnpm contrast` não podia vê-la justamente porque ela não é token.
 *
 * Medido antes: **22 de 22 nomes coloridos reprovavam 4,5:1 no tema claro**, do
 * pior 1,33:1 ao melhor 1,87:1 — nome de autor na mensagem, nome na member
 * list, nome na sala de voz e os cabeçalhos de seção de cargo. O arnês semeia
 * valores da paleta ESCURA (hoje um holográfico, um gradiente e `#f0cd8d`): no
 * claro eles viram texto quase branco sobre branco.
 *
 * O conserto é o mesmo princípio que já estava implementado em `derivar.ts`,
 * aplicado a mais uma entrada: **matiz e croma do usuário, luminosidade do
 * app**. Em OKLCH o L é perceptualmente uniforme, então um L fixo entrega o
 * mesmo contraste em qualquer matiz — e é isso que permite garantir por
 * construção em vez de validar depois.
 *
 * A prova está em `cargo.test.ts`, que varre matiz × croma × modo e exige
 * 4,5:1 contra as quatro superfícies. Avisar protegeria quem lê o aviso;
 * construir assim protege todo mundo.
 */
import { hexParaOklch, oklchParaHex, razao } from "./cor";
import { derivar, SEMENTE_PADRAO, type Modo } from "./derivar";

/**
 * O L de cada modo, copiado da rampa de `--vx-text-2`.
 *
 * `text-2` e não `text-1`: o nome de autor colorido convive com nomes NÃO
 * coloridos na mesma coluna, e igualar o L do texto primário faria o cargo
 * competir com quem não tem cargo. Um degrau abaixo mantém a hierarquia e
 * ainda passa com folga — `text-2` é um dos pares verificados.
 */
const L_DO_CARGO: Record<Modo, number> = {
  escuro: 0.792904,
  claro: 0.400967,
};

/**
 * Teto de croma, por modo.
 *
 * Os mesmos valores de `TETO_DE_CROMA` em `derivar.ts`, e pela mesma razão:
 * acima disso a cor sai do gamut sRGB e o `oklchParaHex` teria que reduzir o
 * croma sozinho — o que produz uma cor que ninguém escolheu.
 */
const TETO: Record<Modo, number> = { escuro: 0.11, claro: 0.19 };

/**
 * Traduz a cor bruta do protocolo para uma cor legível neste tema.
 *
 * `undefined` entra e sai — cargo sem cor é ausência, e o componente já trata
 * isso caindo na cor de texto normal.
 */
export function corDeCargo(
  bruta: string | undefined,
  modo: Modo,
): string | undefined {
  return pinturaDeCargo(bruta, modo)?.cor;
}

/** Uma cor hex, com o L trocado pelo do app. Lança se não for hex. */
function clamp(hex: string, modo: Modo): string {
  const cor = hexParaOklch(hex);
  return oklchParaHex({
    l: L_DO_CARGO[modo],
    c: Math.min(cor.c, TETO[modo]),
    h: cor.h,
  });
}

/* ============================================================
   Gradiente
   ============================================================ */

/**
 * O gradiente de cargo, lido do `colour` do protocolo.
 *
 * ⚠ **Não é conceito que falta no Stoat, e este arquivo dizia que era.** O
 * `RE_COLOUR` do servidor (`server_members.rs`) aceita explicitamente
 * `(repeating-)?(linear|conic|radial)-gradient(...)` em `colour`, até 128
 * caracteres, e o cliente Solid de referência já o desenha
 * (`ColouredText.tsx`). O que faltava era do lado de cá: um gradiente não é
 * uma cor, não passa por `hexParaOklch`, e caía no `catch` que devolvia
 * ausência para não reabrir o furo de contraste.
 *
 * ⚠ **A string do servidor NUNCA vai ao DOM, nem depois de validada.** Ela é
 * escrita por quem tem "gerenciar cargos" em qualquer servidor onde a pessoa
 * esteja, e o regex do servidor aceita `var(--…)` — que leria os TOKENS deste
 * app. O que sai daqui é RECONSTRUÍDO a partir de números e hex já passados
 * pelo clamp; não há caminho por onde um caractere de quem escreveu chegue ao
 * `style`.
 *
 * O que é aceito, e por quê é estreito:
 * - só `linear-gradient` — cônico e radial sobre um nome de 13px não leem
 *   como gradiente, leem como mancha; eles DEGRADAM para a primeira parada;
 * - direção em graus ou `to <lado>`; `in <espaço>` é ignorado, porque aqui a
 *   interpolação é SEMPRE `oklab` (ver `interpolacao` abaixo);
 * - paradas só em hex, com posição opcional em `%`. Nome de cor, `rgb()` e
 *   `var()` não têm como passar pelo clamp, e um gradiente com uma parada que
 *   não passa é um gradiente cujo contraste ninguém garante — o todo cai.
 */
export type Gradiente = {
  /** `90deg` ou `to right` — já normalizado, nunca o texto de quem escreveu. */
  readonly direcao: string;
  readonly paradas: readonly { readonly hex: string; readonly pos?: number }[];
};

const LADO = "(?:left|right|top|bottom)";
const DIRECAO = new RegExp(`^(?:(\\d{1,3})deg|to ${LADO}(?: ${LADO})?)$`);
const INTERPOLACAO = /\s+in\s+[a-z-]+(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?$/;
const PARADA = /^(#[0-9a-f]{3}|#[0-9a-f]{6})(?:\s+(\d{1,3})%|\s+0)?$/;

/** Teto de paradas. O servidor cabe ~9 em 128 caracteres; mais é lixo. */
const MAX_PARADAS = 8;

/**
 * Lê um gradiente de `colour`. `undefined` para qualquer coisa fora do que
 * este cliente sabe desenhar com contraste garantido.
 *
 * Exportado porque o editor precisa do inverso — abrir um cargo que já tem
 * gradiente e mostrar a cor escolhida, não o CSS.
 */
export function lerGradiente(bruta: string | undefined): Gradiente | undefined {
  if (!bruta) return undefined;
  const m = /^(?:repeating-)?(linear|conic|radial)-gradient\((.*)\)$/i.exec(
    bruta.trim(),
  );
  if (!m) return undefined;

  /*
    Sem parênteses aninhados: o grammar aceito não tem função dentro, então
    um `(` dentro do corpo é `rgb()`/`var()`/`url()` e o todo cai. É isso que
    torna o `split(",")` seguro — uma vírgula de `rgb(1, 2, 3)` nunca chega
    até aqui.
  */
  const corpo = m[2]!.toLowerCase();
  if (/[()]/.test(corpo)) return undefined;

  const partes = corpo.split(",").map((p) => p.trim());
  let direcao = "180deg"; // o padrão do CSS, "to bottom"
  const primeira = partes[0]!.replace(INTERPOLACAO, "").trim();
  if (primeira === "") return undefined;
  if (DIRECAO.test(primeira)) {
    const graus = DIRECAO.exec(primeira)?.[1];
    direcao =
      graus === undefined ? primeira : `${String(Number(graus) % 360)}deg`;
    partes.shift();
  }

  if (partes.length < 2 || partes.length > MAX_PARADAS) return undefined;

  const paradas: { hex: string; pos?: number }[] = [];
  for (const p of partes) {
    const pm = PARADA.exec(p);
    if (!pm) return undefined;
    const pos = pm[2] === undefined ? undefined : Math.min(Number(pm[2]), 100);
    paradas.push(pos === undefined ? { hex: pm[1]! } : { hex: pm[1]!, pos });
  }

  // Só o LINEAR é desenhado como gradiente; os outros dois viram a primeira
  // parada, sinalizados por direção vazia.
  return { direcao: m[1]!.toLowerCase() === "linear" ? direcao : "", paradas };
}

/**
 * O que o EDITOR grava: `linear-gradient(90deg, #A, #B)`.
 *
 * A forma é a do design (a cor escolhida → a segunda parada) e é o subconjunto
 * mais estreito do `RE_COLOUR` — `cargo.test.ts` lê a regex do servidor do
 * disco e reprova se isto um dia sair dela.
 */
export function gradienteParaGravar(de: string, ate: string): string {
  return `linear-gradient(90deg, ${de.toUpperCase()}, ${ate.toUpperCase()})`;
}

/**
 * A segunda parada do design — o violeta da paleta de cargos.
 *
 * O design desenha o gradiente de cargo como UMA escolha: a cor da amostra na
 * frente, este violeta atrás. Um segundo seletor de cor dobraria a decisão
 * para ganhar uma liberdade que a tela não pede.
 */
export const FIM_DO_GRADIENTE = "#8B7BE8";

/**
 * A pintura de um cargo neste tema.
 *
 * `cor` existe nas DUAS variantes, e é a razão desta forma: toda superfície
 * onde o gradiente não entra (autor na timeline, cartão de perfil, cabeçalho
 * de seção) continua precisando de UMA cor, e a primeira parada passada pelo
 * clamp é a identidade do cargo sem o adorno. A nota do design é explícita —
 * gradiente só em pill e no nome da lista de membros, nunca no autor da
 * mensagem, onde o contraste sobre a timeline é o que importa.
 */
export type PinturaDeCargo =
  | { readonly tipo: "solida"; readonly cor: string }
  | {
      readonly tipo: "gradiente";
      readonly cor: string;
      /** Para `background-clip: text` — as paradas com o L do app. */
      readonly texto: string;
      /** O fundo da pílula: as mesmas paradas a 33%, como o design (`55`). */
      readonly fundo: string;
    }
  | {
      readonly tipo: "holografico";
      readonly cor: string;
      /** Para `background-clip: text` — ver `paradasDoHolografico`. */
      readonly texto: string;
      /** O preset do design em opacidade CHEIA — a pílula é clara. */
      readonly fundo: string;
    };

/* ============================================================
   Holográfico
   ============================================================ */

/**
 * O preset holográfico do design, na forma que o editor grava.
 *
 * ⚠ **Ele não precisa de campo no protocolo, e a pendência dizia que
 * precisava.** O design o escreve como gradiente ESTÁTICO — sem animação —, e
 * o `RE_COLOUR` do servidor aceita `100deg`, paradas hex e `45%`. Outro
 * cliente Stoat que leia este `colour` desenha o mesmo gradiente; o que só o
 * Vortex faz é RECONHECÊ-LO e dar a ele a pílula clara de texto escuro.
 *
 * Reconhecido por IGUALDADE das paradas lidas, não por comparação de string:
 * `colour` gravado por outro cliente com outra caixa ou outro espaçamento é o
 * mesmo holográfico, e uma comparação de texto diria que não é.
 */
export const HOLOGRAFICO =
  "linear-gradient(100deg, #8FE9F0, #C9B6F5 45%, #F3C6A8)";

/**
 * A cor do texto da pílula holográfica — `#101318`, do design.
 *
 * Não é token, e não pode ser: o fundo da pílula é o preset em opacidade cheia
 * e NÃO muda com o tema, então o texto sobre ele também não pode mudar. Um
 * token de texto viraria claro no tema escuro e sumiria no pastel.
 * `cargo.test.ts` mede o par contra as três paradas.
 */
export const TINTA_HOLOGRAFICA = "#101318";

export function ehHolografico(g: Gradiente | undefined): boolean {
  const preset = lerGradiente(HOLOGRAFICO)!;
  return (
    g !== undefined &&
    g.direcao === preset.direcao &&
    g.paradas.length === preset.paradas.length &&
    g.paradas.every(
      (p, i) => p.hex === preset.paradas[i]!.hex && p.pos === preset.paradas[i]!.pos,
    )
  );
}

/**
 * As superfícies onde um nome de cargo pousa, por modo.
 *
 * As mesmas quatro que `cargo.test.ts` varre. Derivadas da semente PADRÃO, e
 * isso vale para qualquer paleta que quem usa escolha: o picker fixa a rampa
 * de LUMINOSIDADE e só gira matiz e croma, e é a luminosidade que decide
 * contraste. Calculadas uma vez por modo.
 */
const SUPERFICIES_DO_NOME = [
  "--vx-surface-0",
  "--vx-surface-1",
  "--vx-surface-2",
  "--vx-surface-3",
] as const;
const FUNDOS = new Map<Modo, readonly string[]>();
function fundosDe(modo: Modo): readonly string[] {
  let f = FUNDOS.get(modo);
  if (!f) {
    const tokens = derivar(SEMENTE_PADRAO[modo]);
    f = SUPERFICIES_DO_NOME.map((s) => tokens[s]);
    FUNDOS.set(modo, f);
  }
  return f;
}

/**
 * ⚠ **O holográfico usa a regra do contraste, não a regra do clamp.**
 *
 * O clamp de `corDeCargo` faz duas coisas: garante 4,5:1 E puxa todo cargo
 * para o L de `text-2`, para um nome colorido não competir com quem não tem
 * cargo. Aplicado aqui, a segunda metade apagaria o preset — os pastéis do
 * design vivem em L ≈ 0,85–0,90, e em 0,79 o iridescente vira só "colorido".
 *
 * Então cada parada fica CRUA onde já passa 4,5:1 em todas as superfícies do
 * modo, e só vai para o clamp onde não passa. A regra é DERIVADA e não
 * enumerada: medido, no escuro as três passam com folga larga e o nome sai
 * byte a byte do design; no claro nenhuma passa (pastel sobre branco) e as
 * três são clampadas. Se a rampa de superfícies mudar, a decisão muda sozinha
 * — e o teste reprova se alguma parada sair abaixo de 4,5.
 */
function paradaDoHolografico(hex: string, modo: Modo): string {
  const crua = hex.toLowerCase();
  return fundosDe(modo).every((f) => razao(crua, f) >= 4.5) ? crua : clamp(hex, modo);
}

/**
 * ⚠ **`in oklab` não é gosto, é a garantia de contraste.** Todas as paradas
 * saem com o MESMO L; interpolar em sRGB (o padrão do CSS) passa por pontos
 * intermediários com L diferente — o meio de um teal e um violeta em sRGB fica
 * mais escuro que os dois —, e o contraste medido nas paradas não valeria
 * entre elas. Em OKLab o L interpola linearmente entre dois iguais, ou seja
 * fica constante: o que o teste prova nas paradas vale no gradiente inteiro.
 */
const interpolacao = "in oklab";

/**
 * Cache por (modo, bruta). O nome na member list e as pílulas re-renderizam
 * sob presença; sem ele cada passagem refaria regex e conversão OKLCH por
 * linha visível — o erro nº 4 do briefing com cor no lugar de markdown. As
 * entradas são as cores DISTINTAS de cargo que a sessão viu, não mensagens, e
 * o teto só existe porque o conteúdo vem de servidores alheios.
 */
const CACHE = new Map<string, PinturaDeCargo | null>();
const TETO_DO_CACHE = 512;

export function pinturaDeCargo(
  bruta: string | undefined,
  modo: Modo,
): PinturaDeCargo | undefined {
  if (!bruta) return undefined;
  const chave = `${modo}|${bruta}`;
  const guardada = CACHE.get(chave);
  if (guardada !== undefined) return guardada ?? undefined;

  const pintura = calcular(bruta, modo);
  if (CACHE.size >= TETO_DO_CACHE) CACHE.clear();
  CACHE.set(chave, pintura ?? null);
  return pintura;
}

function calcular(bruta: string, modo: Modo): PinturaDeCargo | undefined {
  try {
    return { tipo: "solida", cor: clamp(bruta, modo) };
  } catch {
    // Não é hex: pode ser gradiente. Qualquer outra coisa é ausência —
    // devolver a string crua reabriria o furo que este arquivo fecha.
  }

  const g = lerGradiente(bruta);
  if (!g) return undefined;

  if (ehHolografico(g)) {
    const texto = g.paradas
      .map((p) => {
        const hex = paradaDoHolografico(p.hex, modo);
        return p.pos === undefined ? hex : `${hex} ${String(p.pos)}%`;
      })
      .join(", ");
    return {
      tipo: "holografico",
      cor: clamp(g.paradas[0]!.hex, modo),
      texto: `linear-gradient(${interpolacao} ${g.direcao}, ${texto})`,
      // A constante DESTE app, nunca a string lida: o reconhecimento já
      // provou que as paradas são as do preset.
      fundo: HOLOGRAFICO,
    };
  }

  const paradas = g.paradas.map((p) => ({ ...p, hex: clamp(p.hex, modo) }));
  const cor = paradas[0]!.hex;
  if (g.direcao === "") return { tipo: "solida", cor };

  const emCss = (f: (hex: string) => string) =>
    paradas
      .map((p) => (p.pos === undefined ? f(p.hex) : `${f(p.hex)} ${String(p.pos)}%`))
      .join(", ");

  return {
    tipo: "gradiente",
    cor,
    texto: `linear-gradient(${interpolacao} ${g.direcao}, ${emCss((h) => h)})`,
    fundo: `linear-gradient(${interpolacao} ${g.direcao}, ${emCss(
      (h) => `color-mix(in oklab, ${h} 33%, transparent)`,
    )})`,
  };
}
