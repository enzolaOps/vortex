import { afterEach, describe, expect, it } from "vitest";
import { ulid } from "ulid";

import {
  CHAVE_SIGO,
  chaveDoCanal,
  chaveDoServidor,
  derivarListas,
  derivarTopico,
  listasDeTopicos,
  nomeDeTopicoDe,
  topicoDaMensagem,
} from "./topicos";
import { anotarCanais, limparMetaDeCanal, type MetaDeTopico } from "./vortexCanal";

/**
 * A derivação das listas de tópicos.
 *
 * É ela que decide o que aparece em cada aba do painel, na tela do fórum e na
 * caixa de entrada — e um recorte errado não dá erro: dá uma aba "Seguindo"
 * mostrando arquivados, ou um post fechado sumindo do fórum.
 */

function meta(extra: Partial<MetaDeTopico> = {}): MetaDeTopico {
  return {
    nome: "t",
    paiId: "01PAI",
    serverId: "01SRV",
    donoId: "01DONO",
    aberturaId: undefined,
    arquivado: false,
    fixado: false,
    tags: [],
    seguidores: [],
    ultimaMensagemId: undefined,
    ultimoAutorId: undefined,
    ...extra,
  };
}

const EU = "01EU";

describe("derivarTopico", () => {
  it("seguindo é eu estar entre os seguidores", () => {
    expect(derivarTopico(ulid(), meta({ seguidores: [EU] }), 3, undefined, EU).seguindo).toBe(true);
    expect(derivarTopico(ulid(), meta({ seguidores: [EU] }), 3, undefined, undefined).seguindo).toBe(
      false,
    );
  });

  it("post desconta a abertura das respostas; tópico de mensagem não", () => {
    const abertura = { id: "01M", autorId: "01A", texto: "", midia: undefined, reacao: undefined };
    const post = derivarTopico(ulid(), meta(), 5, { ...abertura, noTopico: true }, EU);
    const deMensagem = derivarTopico(ulid(), meta(), 5, { ...abertura, noTopico: false }, EU);
    expect(post.respostas).toBe(4);
    expect(deMensagem.respostas).toBe(5);
    // Sem contagem da rede, "não sei" — nunca zero.
    expect(derivarTopico(ulid(), meta(), undefined, undefined, EU).respostas).toBeUndefined();
  });

  it("última atividade vem da última mensagem, e do próprio tópico sem ela", () => {
    const id = ulid(1_000);
    expect(derivarTopico(id, meta(), 0, undefined, EU).ultimaEm).toBe(1_000);
    expect(derivarTopico(id, meta({ ultimaMensagemId: ulid(9_000) }), 0, undefined, EU).ultimaEm).toBe(
      9_000,
    );
  });
});

describe("derivarListas", () => {
  const velho = derivarTopico(ulid(1_000), meta({ seguidores: [EU] }), 0, undefined, EU);
  const novo = derivarTopico(ulid(5_000), meta({ seguidores: [EU] }), 0, undefined, EU);
  const arquivado = derivarTopico(
    ulid(9_000),
    meta({ arquivado: true, seguidores: [EU] }),
    0,
    undefined,
    EU,
  );
  const alheio = derivarTopico(
    ulid(3_000),
    meta({ serverId: "01OUTRO", paiId: "01OUTROPAI" }),
    0,
    undefined,
    EU,
  );

  const listas = derivarListas([velho, arquivado, alheio, novo]);

  it("ordena por última atividade, mais recente primeiro", () => {
    expect(listas.get(chaveDoServidor("01SRV", "ativos"))).toEqual([novo.id, velho.id]);
  });

  it("arquivado sai de ativos e de seguindo, e continua no canal pai", () => {
    expect(listas.get(chaveDoServidor("01SRV", "arquivados"))).toEqual([arquivado.id]);
    expect(listas.get(chaveDoServidor("01SRV", "seguindo"))).toEqual([novo.id, velho.id]);
    expect(listas.get(chaveDoCanal("01PAI"))).toEqual([arquivado.id, novo.id, velho.id]);
  });

  it("o servidor recorta: tópico de outro servidor não entra", () => {
    expect(listas.get(chaveDoServidor("01OUTRO", "ativos"))).toEqual([alheio.id]);
    expect(listas.get(chaveDoServidor("01SRV", "ativos"))).not.toContain(alheio.id);
  });

  it("sigo junta todos os servidores, sem arquivados nem alheios", () => {
    expect(listas.get(CHAVE_SIGO)).toEqual([novo.id, velho.id]);
  });
});

describe("nomeDeTopicoDe", () => {
  it("colapsa espaço e corta com reticências dentro do limite do protocolo", () => {
    expect(nomeDeTopicoDe("  oi\n\nmundo ")).toBe("oi mundo");
    const longo = nomeDeTopicoDe("a".repeat(200));
    expect(longo.length).toBeLessThanOrEqual(60);
    expect(longo.endsWith("…")).toBe(true);
    expect(nomeDeTopicoDe("   ")).toBe("Tópico");
  });

  it("tira menção crua e pontuação de markdown do nome", () => {
    expect(nomeDeTopicoDe("<@01JQ0000000000000001000000> ## revisão do **editor**")).toBe(
      "revisão do editor",
    );
    expect(nomeDeTopicoDe("> citação\n- item")).toBe("citação item");
    // Só menção: não sobra assunto, e o nome não inventa um.
    expect(nomeDeTopicoDe("<@01JQ0000000000000001000000>")).toBe("Tópico");
  });
});

describe("topicoDaMensagem", () => {
  /*
    É o que faz "Criar tópico" numa mensagem que JÁ tem tópico abrir o que
    existe em vez do modal. Errar não dá erro: dá um segundo pedido de nome
    que o servidor responde com o mesmo tópico, ou o tópico de outra mensagem.
  */
  afterEach(() => limparMetaDeCanal());

  const cru = (id: string, parent: string, message: string | undefined) => ({
    _id: id,
    channel_type: "TextChannel",
    server: "01SRV",
    name: "t",
    thread: { parent, owner: "01DONO", ...(message ? { message } : {}) },
  });

  // IDs de verdade: anotar republica, e a última atividade sai do ULID.
  const T1 = ulid();
  const T2 = ulid();

  it("acha pelo par canal pai + mensagem de abertura", () => {
    anotarCanais([cru(T1, "01PAI", "01MSG1"), cru(T2, "01PAI", undefined)]);
    expect(topicoDaMensagem("01PAI", "01MSG1")).toBe(T1);
  });

  it("mensagem sem tópico, ou a mesma mensagem noutro canal, não acha", () => {
    anotarCanais([cru(T1, "01PAI", "01MSG1")]);
    expect(topicoDaMensagem("01PAI", "01MSG2")).toBeUndefined();
    expect(topicoDaMensagem("01OUTRO", "01MSG1")).toBeUndefined();
  });
});

describe("lista do canal", () => {
  /*
    A tela do fórum recorta lendo os snapshots dos posts, e só re-renderiza
    quando a LISTA troca de referência. Fixar ou retagar sem mudar a ordem
    precisa trocá-la — senão o filtro de tag mostra um post que já não a tem.
  */
  afterEach(() => limparMetaDeCanal());

  const T = ulid();
  const cru = (thread: object) => ({
    _id: T,
    channel_type: "TextChannel",
    server: "01SRV",
    name: "t",
    thread: { parent: "01FORUMLISTA", owner: "01DONO", ...thread },
  });

  it("post que muda sem mudar a ordem troca a referência da lista do canal", () => {
    const chave = chaveDoCanal("01FORUMLISTA");
    const soltar = listasDeTopicos.subscriber(chave)(() => {});
    anotarCanais([cru({ tags: ["bug"] })]);
    const antes = listasDeTopicos.getSnapshot(chave);
    expect(antes).toEqual([T]);

    anotarCanais([cru({ tags: [], pinned: true })]);
    const depois = listasDeTopicos.getSnapshot(chave);
    expect(depois).toEqual([T]);
    expect(depois).not.toBe(antes);
    soltar();
  });
});
