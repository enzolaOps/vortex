import { describe, expect, it } from "vitest";
import { ulid } from "ulid";

import type { AberturaDePost, TopicoSnapshot } from "../sdk/domain";
import {
  duracaoConhecida,
  lembrarDuracao,
  recortarGaleria,
  seloDaMidia,
  totalDaGaleria,
} from "./galeria";
import { linhasDaGrade } from "./linhas";

/**
 * O recorte da galeria de mídia e as linhas da grade.
 *
 * Nada aqui dá erro quando quebra: dá um GIF no filtro de imagens, um item de
 * ontem sob "Hoje", ou a grade de um dia começando na linha errada.
 */

// Local, e não UTC: o rótulo de dia é o da parede de quem olha.
const AGORA = new Date(2026, 8, 16, 15, 0).getTime();
const HORA = 3_600_000;

type Midia = NonNullable<AberturaDePost["midia"]>;

function item(
  id: string,
  nome: string,
  midia: Partial<Midia> | undefined,
  autorId = "01ANA",
): TopicoSnapshot {
  return {
    id,
    nome,
    paiId: "01GALERIA",
    serverId: "01SRV",
    donoId: autorId,
    aberturaId: undefined,
    arquivado: false,
    fixado: false,
    emAnalise: false,
    tags: [],
    seguidores: [],
    seguindo: false,
    respostas: 0,
    ultimaEm: 0,
    ultimoAutorId: undefined,
    abertura: {
      id: id + "M",
      autorId,
      texto: "",
      noTopico: true,
      midia: midia && {
        url: undefined,
        nome: "a.png",
        tipo: "imagem",
        largura: undefined,
        altura: undefined,
        spoiler: false,
        tamanho: undefined,
        ...midia,
      },
      reacao: undefined,
    },
  };
}

const imagemHoje = item(ulid(AGORA - 1 * HORA), "Rail com pastas", { tipo: "imagem", tamanho: 1_000_000 });
const videoHoje = item(ulid(AGORA - 2 * HORA), "Gravação do arraste", { tipo: "video", tamanho: 1_400_000 }, "01TEO");
const gifOntem = item(ulid(AGORA - 20 * HORA), "Overlay in-game", { tipo: "gif" });
const semMidiaOntem = item(ulid(AGORA - 22 * HORA), "Sem anexo", undefined);

// A lista do canal vem por ÚLTIMA ATIVIDADE — aqui de propósito fora da
// ordem de publicação, que é a que a galeria usa.
const ids = [gifOntem.id, imagemHoje.id, semMidiaOntem.id, videoHoje.id];
const porId = new Map([imagemHoje, videoHoje, gifOntem, semMidiaOntem].map((t) => [t.id, t]));
const ler = (id: string) => porId.get(id);
const nomes: Record<string, string> = { "01ANA": "Marina", "01TEO": "Téo" };
const autor = (id: string) => nomes[id];

const recortar = (filtro: "tudo" | "imagens" | "videos" | "gifs", busca = "") =>
  recortarGaleria(ids, ler, autor, { filtro, busca, agora: AGORA });

describe("recortarGaleria", () => {
  it("agrupa por dia de PUBLICAÇÃO, mais novo primeiro", () => {
    const { grupos } = recortar("tudo");
    expect(grupos.map(({ rotulo, ids }) => ({ rotulo, ids }))).toEqual([
      { rotulo: "Hoje", ids: [imagemHoje.id, videoHoje.id] },
      { rotulo: "Ontem", ids: [gifOntem.id, semMidiaOntem.id] },
    ]);
    // A chave é o dia, e não o rótulo: "Hoje" vira "Ontem" à meia-noite e a
    // linha do virtualizador não pode trocar de identidade por isso.
    expect(new Set(grupos.map((g) => g.chave)).size).toBe(2);
  });

  it("imagens exclui GIF; cada filtro só o seu tipo; sem mídia só em Tudo", () => {
    const so = (f: "imagens" | "videos" | "gifs") =>
      recortar(f).grupos.flatMap((g) => g.ids);
    expect(so("imagens")).toEqual([imagemHoje.id]);
    expect(so("videos")).toEqual([videoHoje.id]);
    expect(so("gifs")).toEqual([gifOntem.id]);
    expect(recortar("tudo").visiveis).toBe(4);
  });

  it("busca por legenda OU por nome do autor, sem caixa", () => {
    expect(recortar("tudo", "  OVERLAY ").grupos.flatMap((g) => g.ids)).toEqual([gifOntem.id]);
    expect(recortar("tudo", "téo").grupos.flatMap((g) => g.ids)).toEqual([videoHoje.id]);
  });

  it("dia sem nenhum item no recorte não vira grupo vazio", () => {
    const { grupos, visiveis } = recortar("videos");
    expect(grupos.map((g) => g.rotulo)).toEqual(["Hoje"]);
    expect(visiveis).toBe(1);
  });
});

describe("totalDaGaleria", () => {
  it("soma só os tamanhos medidos, do canal inteiro", () => {
    expect(totalDaGaleria(ids, ler)).toBe("4 itens · 2,4 MB");
  });

  it("sem nenhum tamanho conhecido, não afirma peso", () => {
    expect(totalDaGaleria([gifOntem.id], ler)).toBe("1 item");
  });
});

describe("linhasDaGrade", () => {
  it("rótulo antes de cada grupo e itens partidos pelas colunas", () => {
    const linhas = linhasDaGrade(
      [
        { chave: "d1", rotulo: "Hoje", ids: ["a", "b", "c"] },
        { chave: "d2", rotulo: "Ontem", ids: ["d"] },
      ],
      2,
    );
    expect(linhas).toEqual([
      { tipo: "rotulo", chave: "r:d1", rotulo: "Hoje" },
      { tipo: "itens", chave: "a:2", ids: ["a", "b"] },
      { tipo: "itens", chave: "c:2", ids: ["c"] },
      { tipo: "rotulo", chave: "r:d2", rotulo: "Ontem" },
      { tipo: "itens", chave: "d:2", ids: ["d"] },
    ]);
  });

  it("grupo sem rótulo não gera linha de rótulo; grupo vazio some", () => {
    const linhas = linhasDaGrade(
      [
        { chave: "", rotulo: undefined, ids: ["a", "b"] },
        { chave: "x", rotulo: "Vazio", ids: [] },
      ],
      0,
    );
    expect(linhas).toEqual([
      { tipo: "itens", chave: "a:1", ids: ["a"] },
      { tipo: "itens", chave: "b:1", ids: ["b"] },
    ]);
  });
});

describe("seloDaMidia", () => {
  it("vídeo mostra a duração medida; GIF mostra GIF; imagem não tem selo", () => {
    expect(seloDaMidia("video", 12.4)).toBe("0:12");
    expect(seloDaMidia("video", 75)).toBe("1:15");
    expect(seloDaMidia("gif", 3)).toBe("GIF");
    expect(seloDaMidia("imagem", undefined)).toBeUndefined();
    expect(seloDaMidia(undefined, undefined)).toBeUndefined();
  });

  it("sem duração conhecida, diz o tipo — nunca 0:00", () => {
    expect(seloDaMidia("video", undefined)).toBe("VÍDEO");
    expect(seloDaMidia("video", Number.NaN)).toBe("VÍDEO");
    expect(seloDaMidia("video", Number.POSITIVE_INFINITY)).toBe("VÍDEO");
    expect(seloDaMidia("video", 0)).toBe("VÍDEO");
  });
});

describe("duração lembrada por URL", () => {
  it("sobrevive à célula: quem remonta lê o que já foi medido", () => {
    expect(duracaoConhecida("https://m/a.mp4")).toBeUndefined();
    lembrarDuracao("https://m/a.mp4", 12);
    expect(duracaoConhecida("https://m/a.mp4")).toBe(12);
    expect(duracaoConhecida(undefined)).toBeUndefined();
  });

  it("não guarda o que não é duração", () => {
    lembrarDuracao("https://m/b.mp4", Number.POSITIVE_INFINITY);
    lembrarDuracao("https://m/c.mp4", Number.NaN);
    expect(duracaoConhecida("https://m/b.mp4")).toBeUndefined();
    expect(duracaoConhecida("https://m/c.mp4")).toBeUndefined();
  });
});
