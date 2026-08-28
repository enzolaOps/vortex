import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, SERVER_ID, seed } from "../dev/firehose";
import {
  channels,
  definirCanalAberto,
  marcarCanalLido,
  membrosOffline,
  membrosOnline,
  registrarServidor,
  secoesOnline,
  semearPresenca,
  servers,
} from "./adapter";
import { client } from "./client";
import { SEM_CARGO } from "./domain";

/**
 * As invariantes das colunas laterais.
 *
 * Nenhuma delas dá erro quando quebra, e as duas primeiras degradam de formas
 * particularmente traiçoeiras: contar não-lida no canal aberto produz um badge
 * que nunca zera (e a pessoa aprende a ignorar o badge), e reordenar a member
 * list a cada evento de presença produz jank que só aparece em servidor grande
 * — invisível em desenvolvimento, exatamente como diz o briefing.
 */

const PRESENCAS_DO_ARNES = ["online", "online", "idle", "dnd", "offline"] as const;

const GERAL = "01JQ0000000000000000000010";
const LINKS = "01JQ0000000000000000000011";

/**
 * A fila de rAF NÃO é zerada entre testes — e isso é a correção, não o
 * descuido.
 *
 * O `flushHandle` do adapter é module-level e sobrevive ao teste que o
 * agendou. Trocar a fila por uma nova no `beforeEach` dessincroniza os dois:
 * o adapter continua achando que tem um frame pendente, `agendarFlush` vira
 * `??=` sobre um valor definido, e nenhuma publicação seguinte é agendada —
 * o teste seguinte mede um sistema que parou de publicar e conclui que o
 * código está errado.
 *
 * Foi exatamente o que aconteceu ao escrever isto. É a mesma família do erro
 * de linha de base do prepend: quando o instrumento guarda estado, resetar
 * metade dele é pior que não resetar nada.
 */
const pendentes: FrameRequestCallback[] = [];

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function virarFrame() {
  const fila = pendentes.splice(0, pendentes.length);
  for (const cb of fila) cb(0);
}

/** Assinar é o que faz o snapshot existir — o store não guarda o que ninguém vê. */
function assinar(
  store: { subscriber(id: string): (l: () => void) => () => void },
  id: string,
) {
  const notificado = vi.fn();
  store.subscriber(id)(notificado);
  return notificado;
}

let contador = 0;

function falar(channelId: string, conteudo = "oi") {
  const id = `01JQ000000000000000009${String(contador++).padStart(4, "0")}`;
  client.messages.getOrCreate(
    id,
    { _id: id, channel: channelId, author: "01JQ0000000000000001000005", content: conteudo },
    true,
  );
  return id;
}

describe("não-lidas", () => {
  beforeEach(async () => {
    await seed(4);
    // Zera o que corridas anteriores dentro do mesmo arquivo deixaram.
    for (const id of [CHANNEL_ID, GERAL, LINKS]) marcarCanalLido(id);
  });

  it("canal ABERTO nunca acumula", () => {
    assinar(channels, CHANNEL_ID);
    definirCanalAberto(CHANNEL_ID);

    falar(CHANNEL_ID);
    falar(CHANNEL_ID);

    expect(channels.peek(CHANNEL_ID)?.naoLidas).toBe(0);
  });

  it("canal fechado acumula, e o servidor soma", () => {
    assinar(channels, GERAL);
    assinar(servers, SERVER_ID);
    definirCanalAberto(CHANNEL_ID);

    falar(GERAL);
    falar(GERAL);

    expect(channels.peek(GERAL)?.naoLidas).toBe(2);
    expect(servers.peek(SERVER_ID)?.naoLidas).toBe(2);
  });

  it("abrir o canal zera ele E baixa o total do servidor", () => {
    assinar(channels, GERAL);
    assinar(channels, LINKS);
    assinar(servers, SERVER_ID);
    definirCanalAberto(CHANNEL_ID);

    falar(GERAL);
    falar(LINKS);
    expect(servers.peek(SERVER_ID)?.naoLidas).toBe(2);

    definirCanalAberto(GERAL);

    expect(channels.peek(GERAL)?.naoLidas).toBe(0);
    // O outro canal continua não lido — zerar o servidor inteiro ao abrir um
    // canal é o bug clássico deste rollup.
    expect(channels.peek(LINKS)?.naoLidas).toBe(1);
    expect(servers.peek(SERVER_ID)?.naoLidas).toBe(1);
  });

  it("menção conta separado, e só quando é a mim", () => {
    assinar(channels, GERAL);
    definirCanalAberto(CHANNEL_ID);

    falar(GERAL, "assunto qualquer");
    falar(GERAL, "<@01JQ0000000000000001000000> olha isso");

    expect(channels.peek(GERAL)?.naoLidas).toBe(2);
    expect(channels.peek(GERAL)?.mencoes).toBe(1);
  });
});

describe("member list e presença", () => {
  beforeEach(async () => {
    await seed(4);
    // Drena o que os testes de não-lida deixaram agendado, devolvendo o
    // `flushHandle` do adapter para `undefined`.
    virarFrame();
  });

  it("registro publica os dois baldes de uma vez, sem esperar frame", () => {
    // `registrarServidor` roda no setup do mundo, dentro do `seed`.
    const online = membrosOnline.peek(SERVER_ID) ?? [];
    const offline = membrosOffline.peek(SERVER_ID) ?? [];

    expect(online.length).toBeGreaterThan(0);
    expect(offline.length).toBeGreaterThan(0);
    expect(online.length + offline.length).toBe(40);
  });

  /**
   * Ordena pelo nome EXIBIDO, não pelo username.
   *
   * A versão anterior deste teste comparava `username`, e continuou passando
   * depois de o apelido entrar — porque o apelido do arnês é o username mais um
   * sufixo, e sufixo não muda a ordem relativa. Passava por sorte, guardando
   * uma invariante que já não era a certa.
   *
   * O que quebra de verdade: a coluna mostrar "Ana-vx" e ordenar por outra
   * coisa faz a pessoa apelidada aparecer fora de ordem alfabética, sem nada
   * na tela explicando por quê.
   */
  it("cada balde sai ordenado pelo nome EXIBIDO, apelido incluído", () => {
    const online = membrosOnline.peek(SERVER_ID) ?? [];
    const exibido = (id: string) =>
      client.serverMembers.getByKey({ server: SERVER_ID, user: id })
        ?.nickname ||
      client.users.get(id)?.username ||
      id;

    const nomes = online.map(exibido);
    const ordenados = [...nomes].sort((a, b) =>
      new Intl.Collator("pt-BR", { sensitivity: "base" }).compare(a, b),
    );
    expect(nomes).toEqual(ordenados);

    // O arnês precisa REALMENTE ter apelidos, senão o teste acima é vácuo.
    expect(nomes.some((n) => n.endsWith("-vx"))).toBe(true);
  });

  it("presença que NÃO troca de balde não republica a lista", () => {
    const notificado = assinar(membrosOnline, SERVER_ID);
    const alguem = (membrosOnline.peek(SERVER_ID) ?? [])[0]!;
    const user = client.users.get(alguem)!;

    // online → idle → dnd: os três moram no mesmo balde. A member list não
    // tem motivo para reordenar, e é isso que a faz sobreviver ao firehose.
    for (const presenca of ["Idle", "Busy", "Online"] as const) {
      client.users.updateUnderlyingObject(alguem, {
        status: { presence: presenca },
      } as never);
      client.emit("userUpdate", user, {} as never);
    }
    virarFrame();

    expect(notificado).not.toHaveBeenCalled();
  });

  it("trocar de balde republica — uma vez por frame, não por evento", () => {
    const notificado = assinar(membrosOnline, SERVER_ID);
    const antes = (membrosOnline.peek(SERVER_ID) ?? []).length;

    const dois = (membrosOnline.peek(SERVER_ID) ?? []).slice(0, 2);
    for (const id of dois) {
      const user = client.users.get(id)!;
      client.users.updateUnderlyingObject(id, {
        status: { presence: "Invisible" },
      } as never);
      client.emit("userUpdate", user, {} as never);
    }

    // Ainda nada: a publicação espera o frame.
    expect(notificado).not.toHaveBeenCalled();

    virarFrame();

    // Duas saídas, UMA publicação.
    expect(notificado).toHaveBeenCalledTimes(1);
    expect((membrosOnline.peek(SERVER_ID) ?? []).length).toBe(antes - 2);
  });
});

/**
 * Seções de cargo na member list.
 *
 * A pergunta que estas asserções respondem não é "aparece?" — é "a seção
 * sobrevive à decisão dos dois baldes?". Presença é 55% da carga do firehose,
 * e uma seção por ESTADO faria toda piscada reordenar. Cargo não pisca, e é
 * por isso que seccionar por cargo é seguro onde seccionar por presença não
 * seria.
 */
describe("seções de cargo", () => {
  /**
   * A presença é RESTAURADA aqui, e a razão foi cara de descobrir.
   *
   * Os `describe` anteriores deixam gente offline de propósito, e o estado é
   * module-level: sobrevive ao bloco que o produziu. A primeira versão destes
   * testes rodava sobre esse resto, e a seção `fundação` — que tem um membro
   * só — simplesmente não existia. `comCargo` ficava com UM elemento, e
   * "está ordenado" sobre uma lista de um item é verdade para qualquer
   * ordenação.
   *
   * Passava. E continuou passando quando a ordenação foi invertida de
   * propósito para testar o teste — que é como isto apareceu. Asserção de
   * ordem precisa provar que tem mais de um item para ordenar.
   */
  beforeEach(async () => {
    await seed(4);

    const todos = [
      ...(membrosOnline.peek(SERVER_ID) ?? []),
      ...(membrosOffline.peek(SERVER_ID) ?? []),
    ];
    for (const id of todos) {
      // O índice sai do próprio ID: o arnês os gera sequenciais, e derivar
      // daqui evita repetir o total de membros em dois lugares que podem
      // divergir.
      const i = Number(id.slice(-6));
      semearPresenca(id, i === 0 ? "online" : PRESENCAS_DO_ARNES[i % 5]!);
    }
    // `semearPresenca` só mexe nos mapas; quem republica é o registro.
    registrarServidor(SERVER_ID, todos);
    virarFrame();
  });

  it("sai ordenado por rank, e sem-cargo por último", () => {
    const secoes = secoesOnline.peek(SERVER_ID) ?? [];

    const servidor = client.servers.get(SERVER_ID)!;
    const rank = (id: string) => servidor.roles.get(id)?.rank ?? -1;

    const comCargo = secoes.filter((s) => s.id !== SEM_CARGO);
    // Sem isto a asserção de ordem abaixo é vácua — ver o comentário do
    // `beforeEach`. Duas seções de cargo é o mínimo para haver ordem.
    expect(comCargo.length).toBeGreaterThan(1);

    const ranks = comCargo.map((s) => rank(s.id));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

    // Sem cargo é a última, sempre — qualquer que seja o rank das outras.
    expect(secoes[secoes.length - 1]!.id).toBe(SEM_CARGO);
  });

  /**
   * A distinção que o protocolo faz e que é fácil perder.
   *
   * `hoist: false` significa "colore o nome mas NÃO abre seção". Um código que
   * tratasse todo cargo como seção passaria em qualquer arnês que só tivesse
   * cargos hasteados — por isso o arnês tem um que não é.
   */
  it("cargo NÃO hasteado não abre seção", () => {
    const servidor = client.servers.get(SERVER_ID)!;
    const naoHasteados = [...servidor.roles.entries()]
      .filter(([, cargo]) => !cargo.hoist)
      .map(([id]) => id);

    expect(naoHasteados.length).toBeGreaterThan(0);

    const secoes = secoesOnline.peek(SERVER_ID) ?? [];
    for (const id of naoHasteados) {
      expect(secoes.some((s) => s.id === id)).toBe(false);
    }
  });

  it("as seções cobrem exatamente o balde online, sem sobra nem repetição", () => {
    const online = membrosOnline.peek(SERVER_ID) ?? [];
    const secoes = secoesOnline.peek(SERVER_ID) ?? [];
    const nas = secoes.flatMap((s) => [...s.ids]);

    expect(nas.length).toBe(online.length);
    expect(new Set(nas).size).toBe(online.length);
    expect([...nas].sort()).toEqual([...online].sort());
  });

  it("offline continua um balde só, com cargo ou sem", () => {
    const offline = membrosOffline.peek(SERVER_ID) ?? [];
    const comCargo = offline.filter(
      (id) =>
        (client.serverMembers.getByKey({ server: SERVER_ID, user: id })?.roles
          ?.length ?? 0) > 0,
    );

    // Há gente com cargo entre os ausentes — senão a asserção seria vácua.
    expect(comCargo.length).toBeGreaterThan(0);

    // E nenhuma seção os reivindica: seção é do lado online e de mais nenhum.
    const nas = new Set(
      (secoesOnline.peek(SERVER_ID) ?? []).flatMap((s) => [...s.ids]),
    );
    for (const id of offline) expect(nas.has(id)).toBe(false);
  });

  /**
   * A invariante que a fase 3 comprou com os dois baldes, agora sob seções.
   *
   * `online → idle → dnd` não muda o balde NEM o cargo, então não pode mexer
   * nas seções. Se mexesse, cada piscada de presença republicaria a estrutura
   * inteira da member list — que é o custo que os dois baldes existem para não
   * pagar.
   */
  it("presença dentro do balde online não republica as seções", () => {
    const notificado = assinar(secoesOnline, SERVER_ID);
    const alguem = (membrosOnline.peek(SERVER_ID) ?? [])[0]!;
    const user = client.users.get(alguem)!;

    // O `emit` não é decoração: sem ele nada percorre o caminho de presença, e
    // "não republicou" passaria por não ter acontecido nada. Asserção negativa
    // sem o gatilho é asserção vácua.
    for (const estado of ["Idle", "Busy", "Online"] as const) {
      client.users.updateUnderlyingObject(alguem, {
        status: { presence: estado },
      } as never);
      client.emit("userUpdate", user, {} as never);
    }
    virarFrame();

    expect(notificado).not.toHaveBeenCalled();

    // E o balde continua o mesmo — prova de que o gatilho de fato rodou e a
    // pessoa não saiu do online por acidente.
    expect(membrosOnline.peek(SERVER_ID)).toContain(alguem);
  });
});
