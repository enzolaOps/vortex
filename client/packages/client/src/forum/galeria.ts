import { decodeTime } from "ulid";

import { formatarBytes } from "../lib/bytes";
import { relogio } from "../lib/duracao";
import { rotuloDeDia } from "../sdk/agrupamento";
import type { TopicoSnapshot } from "../sdk/domain";

/**
 * O recorte da galeria de mídia: filtro de tipo, busca e grupos por dia.
 *
 * Função pura pela mesma razão de `recorte.ts` no fórum: é aqui que a tela
 * decide o que EXISTE na grade, e uma grade errada renderiza — só que mente.
 */

export type FiltroDaGaleria = "tudo" | "imagens" | "videos" | "gifs";

/** Um dia de publicação — o "Hoje" do design acima da grade. */
export type GrupoDaGaleria = {
  /** Início do dia em ms: estável entre republicações, é a chave da linha. */
  readonly chave: string;
  readonly rotulo: string;
  readonly ids: readonly string[];
};

export type RecorteDaGaleria = {
  readonly grupos: readonly GrupoDaGaleria[];
  /** Quantos itens o recorte deixou — zero decide o estado vazio. */
  readonly visiveis: number;
};

function inicioDoDia(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function passaNoFiltro(t: TopicoSnapshot, filtro: FiltroDaGaleria): boolean {
  if (filtro === "tudo") return true;
  const tipo = t.abertura?.midia?.tipo;
  // "Imagens" exclui GIF, como a referência: GIF tem filtro próprio.
  if (filtro === "imagens") return tipo === "imagem";
  if (filtro === "videos") return tipo === "video";
  return tipo === "gif";
}

export function recortarGaleria(
  ids: readonly string[],
  ler: (id: string) => TopicoSnapshot | undefined,
  nomeDoAutor: (id: string) => string | undefined,
  { filtro, busca, agora }: { filtro: FiltroDaGaleria; busca: string; agora: number },
): RecorteDaGaleria {
  const termo = busca.trim().toLowerCase();
  const itens: { id: string; em: number }[] = [];
  for (const id of ids) {
    const t = ler(id);
    if (!t || !passaNoFiltro(t, filtro)) continue;
    if (termo !== "") {
      const autor = nomeDoAutor(t.abertura?.autorId ?? t.donoId) ?? "";
      if (!t.nome.toLowerCase().includes(termo) && !autor.toLowerCase().includes(termo)) {
        continue;
      }
    }
    // Data de PUBLICAÇÃO, e não de última atividade: "a varredura por data
    // exige linhas alinhadas", e um item que ganha resposta não muda de dia.
    itens.push({ id, em: decodeTime(id) });
  }

  // Mais novo primeiro; empate de milissegundo cai no ID, que é total.
  itens.sort((a, b) => b.em - a.em || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

  const grupos: { chave: string; rotulo: string; ids: string[] }[] = [];
  for (const { id, em } of itens) {
    const chave = String(inicioDoDia(em));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.chave === chave) ultimo.ids.push(id);
    else grupos.push({ chave, rotulo: rotuloDeDia(em, agora), ids: [id] });
  }
  return { grupos, visiveis: itens.length };
}

/**
 * "128 itens · 2,4 GB" — do CANAL inteiro, e não do recorte: é o tamanho da
 * galeria, e um total que encolhe ao filtrar diria outra coisa.
 *
 * Soma só o que o protocolo mediu. Sem nenhum tamanho conhecido o peso some,
 * em vez de afirmar "0 B" sobre arquivos que existem.
 */
export function totalDaGaleria(
  ids: readonly string[],
  ler: (id: string) => TopicoSnapshot | undefined,
): string {
  let bytes = 0;
  let conhecidos = 0;
  for (const id of ids) {
    const tamanho = ler(id)?.abertura?.midia?.tamanho;
    if (tamanho === undefined) continue;
    bytes += tamanho;
    conhecidos += 1;
  }
  // Contagem exata, e não o `99+` de `plural`: aqui é o tamanho do acervo,
  // não um selo de não-lidas — o design escreve "128 itens".
  const itens = `${ids.length.toLocaleString("pt-BR")} ${ids.length === 1 ? "item" : "itens"}`;
  const peso = conhecidos > 0 ? formatarBytes(bytes) : undefined;
  return peso ? `${itens} · ${peso}` : itens;
}

/**
 * O selo de tipo no canto do item (D-CANAIS-15): GIF diz "GIF", vídeo diz a
 * DURAÇÃO ("0:12"), imagem não tem selo.
 *
 * A duração não vem do protocolo — `Metadata::Video` tem só largura e altura.
 * Ela vem do PRÓPRIO arquivo: o `<video preload="metadata">` que já desenha o
 * quadro lê o cabeçalho e o navegador expõe `duration`. É dado medido, não
 * inventado. Enquanto ele não chegou (spoiler escondido, instância sem
 * servidor de mídia, rede lenta) o selo diz "VÍDEO": o tipo é certo, a
 * duração ainda não — e `0:00` afirmaria um vídeo vazio.
 *
 * `Infinity` é o que o navegador devolve para transmissão sem fim conhecido,
 * e `NaN` antes do cabeçalho; nenhum dos dois é duração.
 */
export function seloDaMidia(
  tipo: "imagem" | "video" | "gif" | undefined,
  duracaoSegundos: number | undefined,
): string | undefined {
  if (tipo === "gif") return "GIF";
  if (tipo !== "video") return undefined;
  return duracaoSegundos !== undefined && Number.isFinite(duracaoSegundos) && duracaoSegundos > 0
    ? relogio(duracaoSegundos)
    : "VÍDEO";
}

/**
 * Duração já medida, por URL. Module-level e não estado da célula: a grade é
 * virtualizada e a célula remonta ao rolar — sem isto o selo voltaria a
 * "VÍDEO" e piscaria para "0:12" a cada passada. Uma entrada por vídeo que a
 * sessão viu; sem teto, pela mesma conta do cache do gradiente.
 */
const duracoes = new Map<string, number>();

export function duracaoConhecida(url: string | undefined): number | undefined {
  return url === undefined ? undefined : duracoes.get(url);
}

export function lembrarDuracao(url: string, segundos: number): void {
  if (Number.isFinite(segundos) && segundos > 0) duracoes.set(url, segundos);
}
