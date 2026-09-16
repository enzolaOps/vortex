/**
 * Atividades compartilhadas — `/channels/:id/activity` e os eventos
 * `ActivityUpdate`/`ActivityOp` do fork.
 *
 * O `stoat.js` não conhece nenhum dos dois eventos (ele os ignora ao hidratar),
 * então eles são lidos do evento CRU, como `can_publish` no adapter. Toda forma
 * do protocolo morre aqui: fora deste arquivo só existem `SessaoDeAtividade` e
 * `OperacaoDeAtividade`.
 */
import { client } from "./client";
import { tipoDoErro } from "./erros";
import {
  anexarOperacao,
  definirSessao,
  TETO_DA_OPERACAO,
  type OperacaoDeAtividade,
  type SessaoDeAtividade,
} from "../store/atividades";

type OpCrua = { user: string; at: number; op: string; snapshot?: boolean };
type SessaoCrua = {
  _id: string;
  channel_id: string;
  kind: string;
  host: string;
  started_at: number;
  ops?: readonly OpCrua[];
};

function operacao(o: OpCrua): OperacaoDeAtividade {
  return { usuario: o.user, em: o.at, op: o.op, snapshot: o.snapshot === true };
}

function sessao(s: SessaoCrua): SessaoDeAtividade {
  return {
    id: s._id,
    channelId: s.channel_id,
    tipo: s.kind,
    anfitriao: s.host,
    iniciadaEm: s.started_at,
  };
}

/** Aplica um evento cru. Exposto para o teste. */
export function aplicarEventoDeAtividade(evento: unknown): void {
  const e = evento as {
    type?: string;
    channel_id?: string;
    activity?: SessaoCrua | null;
    activity_id?: string;
    op?: OpCrua;
  };
  if (typeof e.channel_id !== "string") return;

  if (e.type === "ActivityUpdate") {
    const s = e.activity ?? undefined;
    definirSessao(e.channel_id, s ? sessao(s) : undefined, (s?.ops ?? []).map(operacao));
  } else if (e.type === "ActivityOp" && e.op && typeof e.activity_id === "string") {
    if (typeof e.op.op !== "string") return;
    anexarOperacao(e.channel_id, e.activity_id, operacao(e.op));
  }
}

let ligado = false;

export function ligarAtividades(): void {
  if (ligado) return;
  ligado = true;
  client.events.on("event", aplicarEventoDeAtividade);
}

/**
 * A atividade em curso, com o registro. Chamado ao abrir a grade: quem entra
 * na sala depois de a atividade começar não recebeu o `ActivityUpdate`.
 */
export async function buscarAtividade(channelId: string): Promise<void> {
  try {
    const s = (await client.api.get(
      `/channels/${channelId}/activity` as never,
    )) as unknown as SessaoCrua;
    definirSessao(channelId, sessao(s), (s.ops ?? []).map(operacao));
  } catch (e) {
    if (tipoDoErro(e) === "NotFound") definirSessao(channelId, undefined);
    else throw e;
  }
}

export async function iniciarAtividade(channelId: string, tipo: string): Promise<void> {
  const s = (await client.api.post(
    `/channels/${channelId}/activity` as never,
    { kind: tipo } as never,
  )) as unknown as SessaoCrua;
  definirSessao(channelId, sessao(s), (s.ops ?? []).map(operacao));
}

export async function encerrarAtividade(channelId: string): Promise<void> {
  await client.api.delete(`/channels/${channelId}/activity` as never);
  definirSessao(channelId, undefined);
}

/** A operação cabe no teto do servidor? Conta BYTES, como ele. */
export function operacaoCabe(op: string): boolean {
  return op.length > 0 && new TextEncoder().encode(op).length <= TETO_DA_OPERACAO;
}

/**
 * Manda uma operação. Não é anexada localmente: o servidor a devolve pelo
 * socket a todo mundo na sala, inclusive a quem mandou, e o host deduplica
 * pelo `id` que ele mesmo põe na carga. Anexar aqui E receber o eco daria a
 * mesma operação duas vezes no registro de quem entra depois.
 */
export async function enviarOperacao(
  channelId: string,
  atividadeId: string,
  op: string,
  snapshot: boolean,
): Promise<void> {
  if (!operacaoCabe(op)) return;
  await client.api.post(
    `/channels/${channelId}/activity/op` as never,
    { activity_id: atividadeId, op, snapshot } as never,
  );
}
