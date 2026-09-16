/**
 * Acesso e segurança do servidor — protocolo → domínio.
 *
 * ⚠ **Nada disto existe no Stoat; é superfície do FORK do serviço `api`.** O
 * servidor do Vortex ganhou `security` em `Server` (modo de entrada, e-mail
 * verificado, nível de verificação, DM entre membros, filtro de convites e a
 * emergência), a fila de pedidos de entrada e os eventos
 * `ServerJoinRequestCreate`/`ServerJoinRequestDelete`. Tudo aditivo: servidor
 * sem `security` se comporta como o Stoat, e `politicaDe(undefined)` devolve
 * exatamente essa política.
 *
 * ⚠ **O SDK descarta `security`, e a leitura é pelo evento CRU.** A hidratação
 * de `server` do `stoat.js` lista os campos que conhece, e este não é um
 * deles — é a mesma situação de `can_publish` em `adapter.ts`, com a mesma
 * saída: `client.events.on("event")` recebe o payload antes da hidratação.
 * Patchar o submodule criaria um fork do SDK para manter.
 *
 * Stores próprios e não campo em `ServerSnapshot`: quem lê a política são
 * duas páginas de configuração, e pendurá-la no snapshot do servidor
 * republicaria o rail inteiro a cada interruptor.
 */
import { decodeTime } from "ulid";

import { client } from "./client";
import { motivoDoErro } from "./erros";
import { toast } from "../components/ui/toastStore";
import { createEntityStore } from "../store/entities";
import { sigla } from "../lib/sigla";

/* ------------------------------------------------------------ domínio */

export type ModoDeEntrada = "convite" | "aprovacao" | "fechado";

/**
 * ⚠ **Quatro, e o design desenha cinco.** "Muito alto · telefone verificado"
 * depende de telefone na conta, e o sistema de contas do Stoat não tem
 * telefone — nem campo, nem verificação. Fica fora da união em vez de virar um
 * valor que o servidor aceitaria e não saberia aplicar.
 */
export type NivelDeVerificacao = "nenhum" | "baixo" | "medio" | "alto";

export type Emergencia = {
  /** Quando as ações expiram sozinhas, em ms. */
  readonly ateMs: number;
  readonly pausaConvites: boolean;
  readonly silenciaTodos: boolean;
  readonly congelaEntradas: boolean;
};

export type PoliticaDoServidor = {
  readonly modo: ModoDeEntrada;
  readonly exigeEmailVerificado: boolean;
  readonly nivel: NivelDeVerificacao;
  readonly dmEntreMembros: boolean;
  readonly filtraConvitesEmDm: boolean;
  /**
   * A emergência como o servidor a guardou — PODE ter expirado. Quem desenha
   * pergunta a `emergenciaVigente`, que é onde o relógio entra.
   */
  readonly emergencia: Emergencia | undefined;
};

/** O que muda numa edição. As chaves ausentes ficam como estão. */
export type MudancaDePolitica = Partial<
  Pick<
    PoliticaDoServidor,
    "modo" | "exigeEmailVerificado" | "nivel" | "dmEntreMembros" | "filtraConvitesEmDm"
  >
>;

/* --------------------------------------------------------- tradução */

const MODO: Record<string, ModoDeEntrada> = {
  Invite: "convite",
  Approval: "aprovacao",
  Closed: "fechado",
};
const MODO_DE_VOLTA: Record<ModoDeEntrada, string> = {
  convite: "Invite",
  aprovacao: "Approval",
  fechado: "Closed",
};

const NIVEL: Record<string, NivelDeVerificacao> = {
  None: "nenhum",
  Low: "baixo",
  Medium: "medio",
  High: "alto",
};
const NIVEL_DE_VOLTA: Record<NivelDeVerificacao, string> = {
  nenhum: "None",
  baixo: "Low",
  medio: "Medium",
  alto: "High",
};

/**
 * A política do servidor, a partir do `security` cru.
 *
 * Ausente e malformado viram o PADRÃO, que é o comportamento do Stoat — nunca
 * uma política mais fechada inventada pelo cliente. Um valor de enum que este
 * cliente não conhece (servidor mais novo) também cai no padrão em vez de
 * quebrar a página.
 */
export function politicaDe(bruto: unknown): PoliticaDoServidor {
  const s = (typeof bruto === "object" && bruto !== null ? bruto : {}) as {
    join_mode?: unknown;
    require_verified_email?: unknown;
    verification_level?: unknown;
    allow_member_dms?: unknown;
    filter_dm_invites?: unknown;
    emergency?: {
      until?: unknown;
      pause_invites?: unknown;
      silence_everyone?: unknown;
      freeze_joins?: unknown;
    };
  };

  const ateMs =
    typeof s.emergency?.until === "string" ? Date.parse(s.emergency.until) : NaN;

  return {
    modo: MODO[String(s.join_mode)] ?? "convite",
    exigeEmailVerificado: s.require_verified_email === true,
    nivel: NIVEL[String(s.verification_level)] ?? "nenhum",
    dmEntreMembros: s.allow_member_dms === true,
    filtraConvitesEmDm: s.filter_dm_invites === true,
    emergencia:
      s.emergency && Number.isFinite(ateMs)
        ? {
            ateMs,
            pausaConvites: s.emergency.pause_invites === true,
            silenciaTodos: s.emergency.silence_everyone === true,
            congelaEntradas: s.emergency.freeze_joins === true,
          }
        : undefined,
  };
}

/** O corpo de `DataEditServerSecurity` — só as chaves que mudaram. */
export function mudancaParaProtocolo(m: MudancaDePolitica): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (m.modo !== undefined) out.join_mode = MODO_DE_VOLTA[m.modo];
  if (m.exigeEmailVerificado !== undefined) {
    out.require_verified_email = m.exigeEmailVerificado;
  }
  if (m.nivel !== undefined) out.verification_level = NIVEL_DE_VOLTA[m.nivel];
  if (m.dmEntreMembros !== undefined) out.allow_member_dms = m.dmEntreMembros;
  if (m.filtraConvitesEmDm !== undefined) {
    out.filter_dm_invites = m.filtraConvitesEmDm;
  }
  return out;
}

/**
 * A emergência que VALE agora. Expirada conta como ausente — é a mesma regra
 * de `ServerSecurity::active_emergency` no servidor, e as duas precisam
 * concordar, senão a página diria "ativa" para um servidor que já reabriu.
 */
export function emergenciaVigente(
  p: PoliticaDoServidor,
  agoraMs: number,
): Emergencia | undefined {
  return p.emergencia !== undefined && p.emergencia.ateMs > agoraMs
    ? p.emergencia
    : undefined;
}

/* -------------------------------------------------------------- store */

/** A política de quem nunca configurou nada — é o comportamento do Stoat. */
export const POLITICA_PADRAO: PoliticaDoServidor = politicaDe(undefined);

export const politicas = createEntityStore<PoliticaDoServidor>((serverId) => {
  /*
    O `Ready` já semeou quem estava conectado quando a página abriu. A busca
    por REST cobre o arnês e o servidor que chegou depois — e é uma ida só
    por abertura da página.
  */
  void recarregarPolitica(serverId);
});

async function recarregarPolitica(serverId: string): Promise<void> {
  if (client.user === undefined) return;
  try {
    const bruto = (await client.api.get(`/servers/${serverId}` as never)) as {
      security?: unknown;
    };
    politicas.set(serverId, politicaDe(bruto.security));
  } catch {
    /* Sem política lida, a página mostra o padrão. Falhar aqui não merece
       toast: a próxima escrita devolve o servidor inteiro e corrige. */
  }
}

/* ------------------------------------------------------ pedidos */

export type PedidoDeEntrada = {
  readonly userId: string;
  readonly nome: string;
  readonly sigla: string;
  readonly avatarUrl: string | undefined;
  readonly pedidoEmMs: number;
  /** "conta criada há 3 horas", "conta de 2 anos". */
  readonly detalhe: string;
  /**
   * Conta com menos de um dia. É o sinal que o design marca com RISCO, e o
   * único que o cliente sabe sem perguntar nada: o ULID do usuário carrega a
   * data de criação da conta.
   */
  readonly risco: boolean;
};

export type EstadoDaFila = readonly PedidoDeEntrada[] | "carregando" | "falhou";

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** A idade de uma conta em português, arredondada para a maior unidade. */
export function idadeDaConta(criadaMs: number, agoraMs: number): string {
  const ms = Math.max(0, agoraMs - criadaMs);
  const minutos = Math.floor(ms / 60_000);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);
  const anos = Math.floor(dias / 365);
  const meses = Math.floor(dias / 30);

  const plural = (n: number, um: string, varios: string) =>
    `${String(n)} ${n === 1 ? um : varios}`;

  if (anos >= 1) return `conta de ${plural(anos, "ano", "anos")}`;
  if (meses >= 1) return `conta de ${plural(meses, "mês", "meses")}`;
  if (dias >= 1) return `conta de ${plural(dias, "dia", "dias")}`;
  if (horas >= 1) return `conta criada há ${plural(horas, "hora", "horas")}`;
  return `conta criada há ${plural(Math.max(minutos, 1), "minuto", "minutos")}`;
}

/** O pedido cru, com o usuário que veio junto na lista, em domínio. */
export function pedidoDe(
  bruto: { user: string; created_at: string },
  usuario: { username?: string; display_name?: string } | undefined,
  avatarUrl: string | undefined,
  agoraMs: number,
): PedidoDeEntrada {
  let criadaMs: number | undefined;
  try {
    criadaMs = decodeTime(bruto.user);
  } catch {
    criadaMs = undefined;
  }
  const nome = usuario?.display_name ?? usuario?.username ?? bruto.user;
  return {
    userId: bruto.user,
    nome,
    sigla: sigla(nome),
    avatarUrl,
    pedidoEmMs: Date.parse(bruto.created_at),
    detalhe: criadaMs === undefined ? "conta desconhecida" : idadeDaConta(criadaMs, agoraMs),
    risco: criadaMs !== undefined && agoraMs - criadaMs < UM_DIA_MS,
  };
}

export const filas = createEntityStore<EstadoDaFila>((serverId) => {
  void recarregarFila(serverId);
});

async function recarregarFila(serverId: string): Promise<void> {
  if (filas.peek(serverId) === undefined) filas.set(serverId, "carregando");
  try {
    const bruto = (await client.api.get(
      `/servers/${serverId}/join_requests` as never,
    )) as {
      requests: { user: string; created_at: string }[];
      users: {
        _id: string;
        username?: string;
        display_name?: string;
        avatar?: { _id: string; tag?: string };
      }[];
    };
    const agora = Date.now();
    const porId = new Map(bruto.users.map((u) => [u._id, u]));
    filas.set(
      serverId,
      bruto.requests.map((r) =>
        pedidoDe(
          r,
          porId.get(r.user),
          client.users.get(r.user)?.avatarURL,
          agora,
        ),
      ),
    );
  } catch {
    filas.set(serverId, "falhou");
  }
}

/**
 * Quem pode moderar a fila deste servidor.
 *
 * ⚠ **Pelo bit cru, e não por `havePermission`.** `ManageJoinRequests` é bit
 * do fork (44 — 41 a 43 são de eventos e soundboard), e o enum de permissões do SDK
 * não o conhece — `havePermission("ManageJoinRequests")` compararia contra
 * `undefined`. O dono recebe `GrantAll` do cálculo do SDK, então o bit está
 * ligado para ele sem caso especial.
 */
export const BIT_GERENCIAR_PEDIDOS = 1n << 44n;

export function podeModerarPedidos(serverId: string): boolean {
  /* Mesma exceção de `pode()`: sem sessão não há tabela de cargos, e o arnês
     precisa ver a fila para ela ser medida. */
  if (client.user === undefined) return true;
  const servidor = client.servers.get(serverId);
  if (!servidor) return false;
  try {
    return (servidor.permission & BIT_GERENCIAR_PEDIDOS) === BIT_GERENCIAR_PEDIDOS;
  } catch {
    return false;
  }
}

/** Quem pode mexer na política e na emergência — `ManageServer`. */
export function podeGerenciarSeguranca(serverId: string): boolean {
  if (client.user === undefined) return true;
  const servidor = client.servers.get(serverId);
  if (!servidor) return false;
  try {
    return servidor.havePermission("ManageServer");
  } catch {
    return false;
  }
}

/* ------------------------------------------------------ eventos crus */

type EventoCru = {
  type?: string;
  id?: string;
  servers?: { _id?: string; security?: unknown }[];
  server?: { _id?: string; security?: unknown };
  data?: { security?: unknown };
  clear?: string[];
  user?: string;
};

/**
 * Aplica um evento cru aos stores. Exportada para teste: a ligação ao socket
 * é uma linha, e é esta a parte que pode errar.
 */
export function aplicarEventoCru(e: EventoCru): void {
  switch (e.type) {
    case "Ready":
      for (const s of e.servers ?? []) {
        if (s._id) politicas.set(s._id, politicaDe(s.security));
      }
      return;
    case "ServerCreate":
      if (e.server?._id) politicas.set(e.server._id, politicaDe(e.server.security));
      return;
    case "ServerUpdate":
      if (e.id === undefined) return;
      if (e.data?.security !== undefined) {
        politicas.set(e.id, politicaDe(e.data.security));
      } else if (e.clear?.includes("Security")) {
        politicas.set(e.id, POLITICA_PADRAO);
      }
      return;
    case "ServerJoinRequestCreate":
      /* O evento traz o pedido e não o usuário. Recarregar a lista é uma ida
         por pedido — frequência de ação humana, e a lista volta com o nome
         que a linha precisa. Só quem está olhando a fila paga. */
      if (e.id !== undefined && filas.subscriberCount(e.id) > 0) {
        void recarregarFila(e.id);
      }
      return;
    case "ServerJoinRequestDelete": {
      if (e.id === undefined) return;
      const atual = filas.peek(e.id);
      if (typeof atual === "object") {
        filas.set(
          e.id,
          atual.filter((p) => p.userId !== e.user),
        );
      }
      return;
    }
  }
}

client.events.on("event", (evento: unknown) => {
  aplicarEventoCru(evento as EventoCru);
});

/* ------------------------------------------------------------ escrita */

function falhou(titulo: string, e: unknown): void {
  toast({ tipo: "erro", titulo, descricao: motivoDoErro(e) });
}

/**
 * Muda a política. Otimista: o interruptor responde no clique, e a resposta do
 * servidor — o `Server` inteiro — corrige o que ele tiver decidido diferente.
 */
export async function editarPolitica(
  serverId: string,
  mudanca: MudancaDePolitica,
): Promise<boolean> {
  const antes = politicas.peek(serverId) ?? POLITICA_PADRAO;
  politicas.set(serverId, { ...antes, ...mudanca });
  try {
    const bruto = (await client.api.patch(
      `/servers/${serverId}` as never,
      { security: mudancaParaProtocolo(mudanca) } as never,
    )) as { security?: unknown };
    politicas.set(serverId, politicaDe(bruto.security));
    return true;
  } catch (e) {
    politicas.set(serverId, antes);
    falhou("Não deu para salvar a política.", e);
    return false;
  }
}

async function escreverEmergencia(serverId: string, ativar: boolean): Promise<boolean> {
  try {
    const caminho = `/servers/${serverId}/emergency` as never;
    const bruto = (await (ativar
      ? client.api.put(caminho)
      : client.api.delete(caminho))) as { security?: unknown };
    politicas.set(serverId, politicaDe(bruto.security));
    return true;
  } catch (e) {
    falhou(
      ativar ? "Não deu para ativar a emergência." : "Não deu para encerrar a emergência.",
      e,
    );
    return false;
  }
}

export function ativarEmergencia(serverId: string): Promise<boolean> {
  return escreverEmergencia(serverId, true);
}

export function encerrarEmergencia(serverId: string): Promise<boolean> {
  return escreverEmergencia(serverId, false);
}

/**
 * Aprovar e recusar NÃO são otimistas. Tirar a linha antes da confirmação
 * faria a pessoa achar que aprovou alguém que o servidor recusou — por
 * emergência congelando entradas, por exemplo. A linha sai quando o evento
 * `ServerJoinRequestDelete` chega, ou aqui mesmo quando não há socket.
 */
async function responderPedido(
  serverId: string,
  userId: string,
  aprovar: boolean,
): Promise<boolean> {
  try {
    const caminho = `/servers/${serverId}/join_requests/${userId}` as never;
    await (aprovar ? client.api.put(caminho) : client.api.delete(caminho));
    aplicarEventoCru({ type: "ServerJoinRequestDelete", id: serverId, user: userId });
    return true;
  } catch (e) {
    falhou(aprovar ? "Não deu para aprovar." : "Não deu para recusar.", e);
    return false;
  }
}

export function aprovarPedido(serverId: string, userId: string): Promise<boolean> {
  return responderPedido(serverId, userId, true);
}

export function recusarPedido(serverId: string, userId: string): Promise<boolean> {
  return responderPedido(serverId, userId, false);
}

/**
 * Um por vez, e parando na primeira falha: se a emergência congelou entradas
 * no meio, as próximas falhariam pelo mesmo motivo e empilhariam o mesmo toast.
 */
export async function aprovarTodos(serverId: string): Promise<void> {
  const fila = filas.peek(serverId);
  if (typeof fila !== "object") return;
  for (const p of fila) {
    if (!(await aprovarPedido(serverId, p.userId))) return;
  }
}
