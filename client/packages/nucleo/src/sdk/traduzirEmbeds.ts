import { ImageEmbed, TextEmbed, VideoEmbed, WebsiteEmbed, type MessageEmbed } from "stoat.js";

import { analisar, hrefSeguro } from "../markdown/analisar";
import type { EmbedEspecial, EmbedMidia, EmbedSnapshot } from "./domain";

/**
 * Os embeds do protocolo → os cartões do domínio.
 *
 * Quem gera o embed é o servidor (`january`), a partir de um link que OUTRA
 * PESSOA escreveu — a cadeia começa em conteúdo de terceiro. Daí as regras:
 *
 *  - **Só `http:`/`https:`** para o destino do cartão (`hrefSeguro`).
 *  - **Imagem e vídeo SÓ pelo proxy do servidor** (`proxiedURL`). A URL original
 *    nunca chega ao domínio: buscá-la do navegador vazaria o IP. Sem proxy, a
 *    mídia some e o cartão fica de texto.
 *  - **Player só de host conhecido** e só por `https`; e a UI não o monta antes
 *    do clique.
 *  - **Cor só em hex.** `colour` é string livre no protocolo.
 */

/** Hosts de player aceitos em iframe. Fechado de propósito: acrescentar é decisão de segurança. */
export const HOSTS_DE_PLAYER: ReadonlySet<string> = new Set([
  "www.youtube-nocookie.com",
  "player.twitch.tv",
  "open.spotify.com",
  "w.soundcloud.com",
  "bandcamp.com",
  "streamable.com",
  "new.lightspeed.tv",
]);

const SERVICOS_DE_AUDIO: ReadonlySet<string> = new Set(["Spotify", "Soundcloud", "Bandcamp"]);

const COR_HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const LIMITE_DO_TITULO = 200;
const LIMITE_DA_DESCRICAO = 400;

/** Referência estável para a ausência — armadilha nº 1. */
const VAZIO_EMBEDS: readonly EmbedSnapshot[] = [];

function recortar(texto: string | undefined, limite: number): string | undefined {
  if (!texto) return undefined;
  const t = texto.trim();
  if (t === "") return undefined;
  return t.length > limite ? `${t.slice(0, limite).trimEnd()}…` : t;
}

/** O host de uma URL já validada, para o cartão sem `siteName`. */
function hostDe(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function corSegura(cor: string | undefined): string | undefined {
  return cor && COR_HEX.test(cor.trim()) ? cor.trim() : undefined;
}

function dimensao(n: number): number | undefined {
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/** A mídia pela URL do PROXY. Sem proxy (servidor sem `january`), sem mídia. */
function midia(e: ImageEmbed | VideoEmbed | undefined): EmbedMidia | undefined {
  if (!e) return undefined;
  const proxy = e.proxiedURL;
  // O proxy tem de ser http(s) também: `hrefSeguro` recusa o resto.
  const url = hrefSeguro(proxy);
  if (url === undefined) return undefined;
  const largura = dimensao(e.width);
  const altura = dimensao(e.height);
  // Sem medida a caixa seria uma mentira (e a imagem faria a linha pular): 16:9.
  return { url, largura: largura ?? 16, altura: altura && largura ? altura : 9 };
}

function especialDe(e: WebsiteEmbed): EmbedEspecial | undefined {
  const tipo = e.specialContent?.type;
  if (tipo === undefined || tipo === "None") return undefined;
  const bruta = e.embedURL;
  if (bruta === undefined) return undefined;
  try {
    const u = new URL(bruta);
    if (u.protocol !== "https:" || !HOSTS_DE_PLAYER.has(u.hostname)) return undefined;
    return { servico: tipo, playerUrl: u.href, audio: SERVICOS_DE_AUDIO.has(tipo) };
  } catch {
    return undefined;
  }
}

function traduzir(e: MessageEmbed, posicao: number): EmbedSnapshot | undefined {
  if (e instanceof WebsiteEmbed) {
    const titulo = recortar(e.title, LIMITE_DO_TITULO);
    const descricao = recortar(e.description, LIMITE_DA_DESCRICAO);
    // O protocolo entrega embed vazio quando não resolveu o link: uma caixa só
    // com um domínio parece algo que falhou ao carregar.
    if (!titulo && !descricao) return undefined;
    const url = hrefSeguro(e.url);
    const especial = especialDe(e);
    return {
      id: e.url ?? `${String(posicao)}`,
      tipo: "site",
      url,
      origem: recortar(e.siteName, LIMITE_DO_TITULO) ?? hostDe(url),
      titulo,
      descricao,
      blocos: undefined,
      imagem: midia(e.image),
      imagemGrande: e.image?.size === "Large",
      // Com player, o vídeo do site é o próprio player (sob clique).
      video: especial ? undefined : midia(e.video),
      especial,
      cor: corSegura(e.colour),
    };
  }

  if (e instanceof TextEmbed) {
    const titulo = recortar(e.title, LIMITE_DO_TITULO);
    const texto = e.description?.trim();
    if (!titulo && !texto) return undefined;
    const url = hrefSeguro(e.url);
    return {
      id: e.url ?? `${String(posicao)}`,
      tipo: "texto",
      url,
      origem: undefined,
      titulo,
      descricao: undefined,
      // Markdown já analisado e cacheado por conteúdo — nunca no render.
      blocos: texto ? analisar(texto.slice(0, 2000)) : undefined,
      imagem: undefined,
      imagemGrande: false,
      video: undefined,
      especial: undefined,
      cor: corSegura(e.colour),
    };
  }

  if (e instanceof ImageEmbed) {
    const imagem = midia(e);
    if (!imagem) return undefined;
    return {
      id: e.url,
      tipo: "imagem",
      url: hrefSeguro(e.url),
      origem: undefined,
      titulo: undefined,
      descricao: undefined,
      blocos: undefined,
      imagem,
      imagemGrande: true,
      video: undefined,
      especial: undefined,
      cor: undefined,
    };
  }

  if (e instanceof VideoEmbed) {
    const video = midia(e);
    if (!video) return undefined;
    return {
      id: e.url,
      tipo: "video",
      url: hrefSeguro(e.url),
      origem: undefined,
      titulo: undefined,
      descricao: undefined,
      blocos: undefined,
      imagem: undefined,
      imagemGrande: true,
      video,
      especial: undefined,
      cor: undefined,
    };
  }

  return undefined;
}

export function traduzirEmbeds(brutos: readonly MessageEmbed[] | undefined): readonly EmbedSnapshot[] {
  if (!brutos || brutos.length === 0) return VAZIO_EMBEDS;

  const cartoes: EmbedSnapshot[] = [];
  const vistos = new Set<string>();
  brutos.forEach((e, i) => {
    const c = traduzir(e, i);
    // Dois embeds com a mesma chave viram uma linha só na lista do React.
    if (!c || vistos.has(`${c.tipo}:${c.id}`)) return;
    vistos.add(`${c.tipo}:${c.id}`);
    cartoes.push(c);
  });

  return cartoes.length > 0 ? cartoes : VAZIO_EMBEDS;
}
