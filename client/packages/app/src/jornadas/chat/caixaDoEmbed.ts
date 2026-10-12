import type { EmbedEspecial, EmbedMidia, EmbedSnapshot } from "nucleo/sdk/domain";

/**
 * A altura que os embeds somam à linha, calculada do metadata ANTES do primeiro
 * byte — o mesmo contrato de `caixaDoAnexo`: a lista é ancorada no fim, e uma
 * prévia que chega (ou uma imagem que carrega) e muda a altura da linha empurra
 * a âncora. Mídia e player reservam a caixa pela proporção que o servidor deu;
 * o cartão de texto tem teto de linhas, então a altura dele é um intervalo curto.
 */

/** Quantos cartões uma mensagem mostra; o resto vira "e mais N". */
export const MAXIMO_DE_EMBEDS = 3;

export const LARGURA_DO_EMBED = 432;
export const LARGURA_DA_MIDIA_DO_EMBED = 400;
export const ALTURA_MAXIMA_DA_MIDIA_DO_EMBED = 300;
/** Player de áudio (Spotify…): não tem proporção de vídeo. */
export const ALTURA_DO_PLAYER_DE_AUDIO = 152;
/** Miniatura à direita do cartão. */
export const LADO_DA_MINIATURA = 80;
/** A linha "e mais N". */
export const ALTURA_DO_MAIS_EMBEDS = 24;
/** Respiro entre cartões, e entre o corpo e o primeiro. Espelha `--vx-space-2`. */
export const RESPIRO_DO_EMBED = 8;

/* Cartão: bordas 2 + padding 2x12 + linhas de 18px (origem, título até 2 linhas, descrição até 3). */
const MOLDURA_DO_CARTAO = 26;
const LINHA_DO_CARTAO = 18;

export function caixaDaMidia(m: EmbedMidia): { largura: number; altura: number } {
  const escala = Math.min(LARGURA_DA_MIDIA_DO_EMBED / m.largura, ALTURA_MAXIMA_DA_MIDIA_DO_EMBED / m.altura, 1);
  const largura = Math.max(1, Math.round(m.largura * escala));
  return { largura, altura: Math.max(1, Math.round(largura * (m.altura / m.largura))) };
}

/**
 * Caixa do player, igual antes e depois do clique: audio tem altura fixa, o resto e 16:9.
 * O iframe do servico tambem e 16:9, entao trocar o poster por ele nao pode pular.
 */
export function caixaDoPlayer(especial: EmbedEspecial): { largura: number; altura: number } {
  if (especial.audio) return { largura: LARGURA_DA_MIDIA_DO_EMBED, altura: ALTURA_DO_PLAYER_DE_AUDIO };
  return { largura: LARGURA_DA_MIDIA_DO_EMBED, altura: Math.round((LARGURA_DA_MIDIA_DO_EMBED * 9) / 16) };
}

export function alturaDoEmbed(e: EmbedSnapshot): number {
  if (e.tipo === "imagem" && e.imagem) return caixaDaMidia(e.imagem).altura;
  if (e.tipo === "video" && e.video) return caixaDaMidia(e.video).altura;

  let h = MOLDURA_DO_CARTAO;
  if (e.origem) h += LINHA_DO_CARTAO;
  if (e.titulo) h += LINHA_DO_CARTAO * (e.titulo.length > 48 ? 2 : 1) + 2;
  if (e.tipo === "site" && e.descricao) h += LINHA_DO_CARTAO * Math.min(3, Math.ceil(e.descricao.length / 52));
  if (e.tipo === "texto" && e.blocos) h += LINHA_DO_CARTAO * Math.min(6, Math.max(1, Math.ceil(textoDe(e) / 52)));

  const midiaAbaixo = e.especial
    ? caixaDoPlayer(e.especial).altura + RESPIRO_DO_EMBED
    : e.imagem && e.imagemGrande
      ? caixaDaMidia(e.imagem).altura + RESPIRO_DO_EMBED
      : e.video
        ? caixaDaMidia(e.video).altura + RESPIRO_DO_EMBED
        : 0;
  const miniatura = e.imagem && !e.imagemGrande && !e.especial ? LADO_DA_MINIATURA + MOLDURA_DO_CARTAO : 0;
  return Math.max(h, miniatura) + midiaAbaixo;
}

function textoDe(e: EmbedSnapshot): number {
  let n = 0;
  const visita = (nos: readonly unknown[]) => {
    for (const no of nos) {
      const o = no as { valor?: string; filhos?: readonly unknown[]; itens?: readonly { filhos: readonly unknown[] }[] };
      if (typeof o.valor === "string") n += o.valor.length;
      if (o.filhos) visita(o.filhos);
      if (o.itens) for (const i of o.itens) visita(i.filhos);
    }
  };
  visita(e.blocos ?? []);
  return n;
}

/** Altura total que os embeds visíveis somam à linha, respiros e "e mais N" incluídos. */
export function alturaDeEmbeds(embeds: readonly EmbedSnapshot[]): number {
  if (embeds.length === 0) return 0;
  let total = 0;
  for (const e of embeds.slice(0, MAXIMO_DE_EMBEDS)) total += alturaDoEmbed(e) + RESPIRO_DO_EMBED;
  if (embeds.length > MAXIMO_DE_EMBEDS) total += ALTURA_DO_MAIS_EMBEDS;
  return total;
}
