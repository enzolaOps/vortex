import { lerTemas, resolverReferencias, type CampoDeCor } from "./contraste";
import {
  DESTAQUES,
  PERSONALIZACAO_PADRAO,
  paletaValidada,
  type BaseDoTema,
  type DestaqueId,
  type PaletaValidada,
  type Personalizacao,
} from "./personalizar";
import tokensDoDs from "./tokens.json";
import tokensCss from "./tokens.gerado.css?raw";

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

function limitar(n: unknown, min: number, max: number, recuo: number): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : recuo;
}

function ler(): Personalizacao {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return PERSONALIZACAO_PADRAO;
    const o = JSON.parse(cru) as Record<string, unknown>;
    return {
      ativo: o["ativo"] === true,
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

/** Aplica a paleta personalizada (ou limpa, voltando ao tema de fábrica) no documento. */
export function aplicarPersonalizacao(p: Personalizacao, raiz: HTMLElement = document.documentElement): PaletaValidada | undefined {
  for (const nome of escritas) raiz.style.removeProperty(nome);
  escritas = [];
  if (!p.ativo) return undefined;

  const validada = paletaValidada(base(), p);
  if (!validada) return undefined;

  for (const [papel, valor] of Object.entries(validada.papeis)) {
    raiz.style.setProperty(propriedade(papel), valor);
    escritas.push(propriedade(papel));
  }
  // O anel de seleção do avatar nasce com as duas cores escritas dentro do valor.
  const solido = validada.papeis["surface-solid"];
  const acento = validada.papeis["accent"];
  if (solido !== undefined && acento !== undefined) {
    const nome = propriedade(EXTRAS[0]);
    raiz.style.setProperty(nome, `0 0 0 2px ${solido}, 0 0 0 4px ${acento}`);
    escritas.push(nome);
  }
  return validada;
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

/** Liga a paleta guardada ao abrir o app, antes da primeira pintura. */
export function aplicarTemaSalvo(): void {
  aplicarPersonalizacao(atual);
}

/** A paleta que a combinação atual produz, com a medição, para a tela dizer se ajustou. */
export function paletaAtual(): PaletaValidada | undefined {
  return paletaValidada(base(), atual);
}

export type { DestaqueId };
