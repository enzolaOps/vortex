import { beforeEach, describe, expect, it } from "vitest";
import { ulid } from "ulid";

import { definirPrivacidade } from "../store/privacidade";
import {
  aceitarSolicitacao,
  limparSolicitacoes,
  recusarSolicitacao,
} from "../store/solicitacoes";
import {
  conversas,
  definirUsuarioLocal,
  publicarConversas,
  RAIZ,
  SOLICITACOES,
} from "./adapter";
import { client } from "./client";

/**
 * A fila de solicitações pela VARREDURA do adapter — a regra pura tem teste
 * próprio; aqui o que se guarda é a tradução do canal do SDK para ela e a
 * separação nas duas listas.
 */

const EU = "01JQEU000000000000000000EU";
const INICIO = Date.now() - 60_000;

function pessoa(id: string, relationship: string): void {
  client.users.getOrCreate(id, {
    _id: id,
    username: id.toLowerCase(),
    discriminator: "0001",
    relationship,
    online: false,
  } as never);
}

/** DM criada `idadeMs` atrás, com uma mensagem agora. */
function dm(outro: string, idadeMs: number): string {
  const id = ulid(Date.now() - idadeMs);
  client.channels.getOrCreate(id, {
    _id: id,
    channel_type: "DirectMessage",
    active: true,
    recipients: [EU, outro],
    last_message_id: ulid(),
  } as never);
  return id;
}

function listas() {
  return {
    coluna: conversas.getSnapshot(RAIZ) ?? [],
    fila: conversas.getSnapshot(SOLICITACOES) ?? [],
  };
}

beforeEach(() => {
  definirUsuarioLocal(EU);
  limparSolicitacoes(INICIO);
  definirPrivacidade({ filtrarDesconhecidos: true });
});

describe("solicitações na varredura de conversas", () => {
  it("desconhecido novo vai para a fila; amigo e conversa antiga, para a coluna", () => {
    pessoa("01JQDESCONHECIDO0000000000", "None");
    pessoa("01JQAMIGO00000000000000000", "Friend");
    pessoa("01JQANTIGO0000000000000000", "None");
    const nova = dm("01JQDESCONHECIDO0000000000", 1_000);
    const amigo = dm("01JQAMIGO00000000000000000", 1_000);
    const antiga = dm("01JQANTIGO0000000000000000", 3_600_000);

    publicarConversas();
    const { coluna, fila } = listas();

    expect(fila).toContain(nova);
    expect(coluna).not.toContain(nova);
    expect(coluna).toEqual(expect.arrayContaining([amigo, antiga]));
    expect(fila).not.toContain(amigo);
    expect(fila).not.toContain(antiga);
  });

  it("aceitar move para a coluna; recusar some das duas", () => {
    pessoa("01JQPEDE000000000000000000", "Incoming");
    pessoa("01JQSPAM000000000000000000", "None");
    const aceita = dm("01JQPEDE000000000000000000", 1_000);
    const recusada = dm("01JQSPAM000000000000000000", 1_000);

    aceitarSolicitacao(aceita);
    recusarSolicitacao(recusada, client.channels.get(recusada)!.lastMessageId);
    publicarConversas();
    const { coluna, fila } = listas();

    expect(coluna).toContain(aceita);
    expect(fila).not.toContain(aceita);
    expect(coluna).not.toContain(recusada);
    expect(fila).not.toContain(recusada);
  });

  it("filtro desligado: tudo na coluna, fila vazia", () => {
    pessoa("01JQOUTRO00000000000000000", "None");
    const id = dm("01JQOUTRO00000000000000000", 1_000);
    definirPrivacidade({ filtrarDesconhecidos: false });
    publicarConversas();
    expect(listas().coluna).toContain(id);
    expect(listas().fila).not.toContain(id);
  });
});
