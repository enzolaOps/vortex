import { assinarAparencia, lerAparencia, type Aparencia } from "nucleo/store/aparencia";
import { assinarDensidade, lerDensidade } from "nucleo/store/densidade";

import { lerTemas, resolverReferencias, type CampoDeCor } from "./contraste";
import {
  DESTAQUES,
  PERSONALIZACAO_PADRAO,
  SEMENTES,
  TEMAS,
  normalizarHex,
  paletaValidada,
  type BaseDoTema,
  type DestaqueId,
  type PaletaValidada,
  type Personalizacao,
  type TemaId,
} from "./personalizar";
import tokensDoDs from "./tokens.json";
import tokensCss from "./tokens.gerado.css?raw";
import { ajustesDeVidro } from "./vidroEFundo";

/**
 * A paleta personalizada em uso: guardada no dispositivo, aplicada como
 * propriedades CSS no `<html>` e lida pela tela de Aparência.
 *
 * Mora no dispositivo, e não na conta, de propósito: tema é gosto de quem está
 * na frente da tela, e a mesma conta aberta num monitor diferente pede outro.
 */

const CHAVE = "vortex:tema-personalizado";

/** O tema de fábrica resolvido e os campos de cor com a opacidade de pico, lidos do próprio DS. */
let baseCache: BaseDoTema | undefined;
function base(): BaseDoTema {
  if (baseCache) return baseCache;
  const vidro = lerTemas(tokensCss)["vidro"] ?? {};
  const ds = tokensDoDs as { color: { tokens: { name: string; usage: string }[] } };
  const campos: CampoDeCor[] = ds.color.tokens
    .filter((t) => t.name.startsWith("backdrop-glow-"))
    .map((t) => ({ papel: t.name, opacidade: Number(/opacidade ([0-9.]+)/.exec(t.usage)?.[1] ?? "0.2") }));
  baseCache = { papeis: resolverReferencias(vidro), campos };
  return baseCache;
}

export function baseDoTema(): BaseDoTema {
  return base();
}

/**
 * Escuro ou claro: a FAMÍLIA do tema, que decide o `data-tema` do `<html>`.
 *
 * Mora fora da `Personalizacao` de propósito. Os temas prontos e a paleta
 * personalizada são sementes de um derivador ESCURO e só valem nele; guardar a
 * família à parte faz a escolha escura sobreviver intacta a uma ida ao claro —
 * voltar ao escuro devolve exatamente o que estava, sem nada para restaurar.
 *
 * `vidro` é o id do tema escuro no CSS gerado (`:root, [data-tema="vidro"]`).
 */
export const FAMILIAS = ["vidro", "claro", "sistema"] as const;
export type Familia = (typeof FAMILIAS)[number];
/** O que chega ao `data-tema`: "sistema" se resolve num dos dois. */
export type TemaDaRaiz = Exclude<Familia, "sistema">;

const CHAVE_FAMILIA = "vortex:tema-familia";
const PEDE_CLARO = "(prefers-color-scheme: light)";

function lerFamiliaGuardada(): Familia {
  try {
    const v = localStorage.getItem(CHAVE_FAMILIA);
    return FAMILIAS.find((f) => f === v) ?? "vidro";
  } catch {
    return "vidro";
  }
}

let familia: Familia = lerFamiliaGuardada();

function sistemaPedeClaro(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PEDE_CLARO).matches;
}

/** A família escolhida, como foi escolhida ("sistema" inclusive). */
export function lerFamilia(): Familia {
  return familia;
}

/** O tema que vale agora no `<html>`. */
export function temaDaRaiz(): TemaDaRaiz {
  return familia === "sistema" ? (sistemaPedeClaro() ? "claro" : "vidro") : familia;
}

const papeisPorTema = new Map<TemaDaRaiz, Readonly<Record<string, string>>>();

/** Os papéis de fábrica de uma família, resolvidos do CSS gerado. */
export function papeisDaFamilia(tema: TemaDaRaiz): Readonly<Record<string, string>> {
  if (tema === "vidro") return base().papeis;
  const guardado = papeisPorTema.get(tema);
  if (guardado) return guardado;
  const papeis = resolverReferencias(lerTemas(tokensCss)[tema] ?? {});
  papeisPorTema.set(tema, papeis);
  return papeis;
}

function limitar(n: unknown, min: number, max: number, recuo: number): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : recuo;
}

function ler(): Personalizacao {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return PERSONALIZACAO_PADRAO;
    const o = JSON.parse(cru) as Record<string, unknown>;
    const ativo = o["ativo"] === true;
    const tema = TEMAS.find((t) => t === o["tema"]);
    const livre = typeof o["destaqueLivre"] === "string" ? normalizarHex(o["destaqueLivre"]) : undefined;
    return {
      ativo,
      tema: tema ?? "vidro",
      // Quem guardou uma paleta antes dos temas prontos já tinha mexido nos ajustes.
      personalizado: tema === undefined ? ativo : o["personalizado"] === true,
      destaqueLivre: livre ?? null,
      matiz: limitar(o["matiz"], 0, 360, PERSONALIZACAO_PADRAO.matiz),
      intensidade: limitar(o["intensidade"], 0, 100, PERSONALIZACAO_PADRAO.intensidade),
      destaque: DESTAQUES.find((d) => d === o["destaque"]) ?? PERSONALIZACAO_PADRAO.destaque,
    };
  } catch {
    return PERSONALIZACAO_PADRAO;
  }
}

let atual: Personalizacao = ler();
const ouvintes = new Set<() => void>();

export function assinarPersonalizacao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável: trocada só quando algo muda. */
export function lerPersonalizacao(): Personalizacao {
  return atual;
}

/** As propriedades CSS que a paleta escreve, para limpar uma por uma. */
const EXTRAS = ["shadow-selected"] as const;
let escritas: string[] = [];

function propriedade(papel: string): string {
  return `--vx-${papel}`;
}

/**
 * Aplica no documento tudo o que a Aparência escolhe: a paleta (ou o tema de fábrica,
 * sem nada escrito), os ajustes de vidro e de brilho, a escala do texto, o modo de
 * movimento e a densidade das mensagens. Tudo vira VALOR de token ou atributo da raiz.
 */
export function aplicarPersonalizacao(p: Personalizacao, raiz: HTMLElement = document.documentElement): PaletaValidada | undefined {
  for (const nome of escritas) raiz.style.removeProperty(nome);
  escritas = [];
  const escrever = (nome: string, valor: string) => {
    raiz.style.setProperty(nome, valor);
    escritas.push(nome);
  };

  // O `color-scheme` vem do bloco do tema no CSS: trocar o atributo basta.
  const tema = temaDaRaiz();
  if (raiz.getAttribute("data-tema") !== tema) raiz.setAttribute("data-tema", tema);

  // Temas prontos e paleta personalizada só existem no escuro: no claro, nenhuma cor
  // deles é escrita (superfície escura com texto escuro do claro seria ilegível). A
  // escolha continua guardada e volta sozinha com o escuro.
  const validada = tema === "vidro" && p.ativo ? paletaValidada(base(), p) : undefined;
  if (validada) {
    for (const [papel, valor] of Object.entries(validada.papeis)) escrever(propriedade(papel), valor);
    // O anel de seleção do avatar nasce com as duas cores escritas dentro do valor.
    const solido = validada.papeis["surface-solid"];
    const acento = validada.papeis["accent"];
    if (solido !== undefined && acento !== undefined) {
      escrever(propriedade(EXTRAS[0]), `0 0 0 2px ${solido}, 0 0 0 4px ${acento}`);
    }
  }

  const a = lerAparencia();
  const resolvidos = { ...papeisDaFamilia(tema), ...(validada?.papeis ?? {}) };
  for (const [papel, valor] of Object.entries(ajustesDeVidro(resolvidos, a))) escrever(propriedade(papel), valor);
  if (a.texto !== 100) escrever("--vx-texto-escala", String(a.texto / 100));

  if (a.reduzirAnimacoes === null) raiz.removeAttribute("data-movimento");
  else raiz.setAttribute("data-movimento", a.reduzirAnimacoes ? "reduzido" : "normal");
  raiz.setAttribute("data-densidade", lerDensidade());
  return validada;
}

/**
 * Os papéis de uma paleta com os ajustes de vidro e de brilho em cima, para a prévia
 * desenhar no próprio contêiner o que o app inteiro desenharia com aquela paleta.
 */
export function papeisComAjustes(
  papeis: Readonly<Record<string, string>>,
  a: Pick<Aparencia, "vidro" | "brilho">,
  tema: TemaDaRaiz = "vidro",
): Readonly<Record<string, string>> {
  return { ...papeis, ...ajustesDeVidro({ ...papeisDaFamilia(tema), ...papeis }, a) };
}

/** Escolhe um tema pronto: aplica a semente dele e desfaz qualquer personalização. */
export function escolherTema(id: TemaId): void {
  definirPersonalizacao({
    ...SEMENTES[id],
    tema: id,
    ativo: id !== "vidro",
    personalizado: false,
    destaqueLivre: null,
  });
}

/** Mexe num ajuste: parte do tema escolhido e marca a escolha como personalizada. */
export function personalizar(mudanca: Partial<Pick<Personalizacao, "matiz" | "intensidade" | "destaque" | "destaqueLivre">>): void {
  definirPersonalizacao({ ...mudanca, ativo: true, personalizado: true });
}

/** Os papéis de um estado de personalização, para a prévia e as miniaturas (o tema de fábrica quando inativo). */
export function papeisDe(p: Personalizacao): Readonly<Record<string, string>> {
  if (!p.ativo) return base().papeis;
  return paletaValidada(base(), p)?.papeis ?? base().papeis;
}

const papeisDosTemas = new Map<TemaId, Readonly<Record<string, string>>>();

/** Os papéis de um tema pronto, derivados da semente dele (e medidos como qualquer paleta). */
export function papeisDoTema(id: TemaId): Readonly<Record<string, string>> {
  const guardado = papeisDosTemas.get(id);
  if (guardado) return guardado;
  const papeis = papeisDe({ ...PERSONALIZACAO_PADRAO, ...SEMENTES[id], tema: id, ativo: id !== "vidro" });
  papeisDosTemas.set(id, papeis);
  return papeis;
}

export function definirPersonalizacao(mudanca: Partial<Personalizacao>): void {
  atual = { ...atual, ...mudanca };
  try {
    localStorage.setItem(CHAVE, JSON.stringify(atual));
  } catch {
    /* vale nesta aba */
  }
  aplicarPersonalizacao(atual);
  for (const o of ouvintes) o();
}

/** Escolhe escuro, claro ou seguir o sistema; vale na hora e fica guardado no dispositivo. */
export function definirFamilia(f: Familia): void {
  familia = f;
  try {
    localStorage.setItem(CHAVE_FAMILIA, f);
  } catch {
    /* vale nesta aba */
  }
  aplicarPersonalizacao(atual);
  for (const o of ouvintes) o();
}

/** Liga o tema e a paleta guardados ao abrir o app, antes da primeira pintura. */
export function aplicarTemaSalvo(): void {
  aplicarPersonalizacao(atual);
}

// Mexer num ajuste de vidro, brilho, texto, movimento ou densidade vale na hora, sem recarregar.
// Vive o tempo do app: quem assina é o módulo, não uma tela.
const reaplicar = () => {
  aplicarPersonalizacao(atual);
};
assinarAparencia(reaplicar);
assinarDensidade(reaplicar);

// "Seguir o sistema" acompanha a troca do sistema com o app aberto.
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  window.matchMedia(PEDE_CLARO).addEventListener("change", () => {
    if (familia !== "sistema") return;
    aplicarPersonalizacao(atual);
    for (const o of ouvintes) o();
  });
}

/** A paleta que a combinação atual produz, com a medição, para a tela dizer se ajustou. */
export function paletaAtual(): PaletaValidada | undefined {
  return paletaValidada(base(), atual);
}

export type { DestaqueId };
