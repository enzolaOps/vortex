/**
 * Entrar com código QR — as cinco rotas `/auth/qr` do fork.
 *
 * O protocolo do Stoat não tem autorização de sessão por outro aparelho; o
 * fork do serviço `api` a acrescentou (ver `server/crates/delta/src/routes/qr`).
 * Nenhuma delas tem método no SDK, então todas passam por `client.api` cru —
 * e nada de forma do protocolo sai deste arquivo.
 *
 * O fluxo, pelos dois lados:
 *
 * - **Aparelho sem sessão** (`pedirQr` → `trocarQr` a cada 2 s): mostra o QR
 *   com o LINK e o código de confirmação. O segredo que troca a autorização
 *   por sessão fica só na memória desta aba.
 * - **Aparelho com sessão** (`verPedidoDeQr` → `autorizarQr`/`recusarQr`):
 *   abre o link, vê o nome e o código, e só aprova se o código bater.
 */
import { client } from "./client";
import { concluirEntradaPorQr } from "./autenticacao";
import { tipoDoErro } from "./erros";
import { postarCru } from "./requisicaoCrua";

/** O nome da sessão que o QR vai criar, na lista de dispositivos da conta. */
const NOME_DO_APARELHO = "Vortex (web · QR)";

export type PedidoDeQr = {
  readonly id: string;
  /** Nunca sai desta aba — nem para a URL, nem para o armazenamento. */
  readonly segredo: string;
  readonly codigo: string;
  /** Unix ms. */
  readonly expiraEm: number;
};

type RespostaDeCriar = {
  id: string;
  secret: string;
  code: string;
  expires_at: number;
};

export async function pedirQr(): Promise<PedidoDeQr> {
  const r = await postarCru<RespostaDeCriar>("/auth/qr/create", {
    friendly_name: NOME_DO_APARELHO,
  });
  return { id: r.id, segredo: r.secret, codigo: r.code, expiraEm: r.expires_at };
}

/**
 * O endereço que vai dentro do QR.
 *
 * O LINK e não o ID cru: uma câmera de celular comum abre link sozinha, e um
 * ID solto obrigaria a pessoa a ter um leitor de QR dentro do próprio Vortex.
 * Carrega só o ID — o segredo não — então fotografar a tela não basta.
 */
export function linkDoQr(id: string): string {
  return `${window.location.origin}/qr/${id}`;
}

export type ResultadoDaTroca = "pendente" | "concluida" | "expirado";

type RespostaDeTroca =
  | { result: "Pending" }
  | { result: "Success"; _id: string; token: string; user_id: string }
  | { result: "Disabled"; user_id: string };

/**
 * Pergunta se alguém já autorizou. `expirado` cobre os três casos em que o
 * pedido deixou de existir — venceu, foi recusado, ou já foi trocado —, porque
 * para a tela os três pedem a mesma coisa: um código novo.
 */
export async function trocarQr(pedido: PedidoDeQr): Promise<ResultadoDaTroca> {
  try {
    const r = await postarCru<RespostaDeTroca>(`/auth/qr/${pedido.id}/exchange`, {
      secret: pedido.segredo,
    });
    if (r.result === "Pending") return "pendente";
    await concluirEntradaPorQr(r);
    return "concluida";
  } catch (e) {
    if (tipoDoErro(e) === "NotFound") return "expirado";
    throw e;
  }
}

export type PedidoParaAutorizar = {
  readonly nome: string;
  readonly codigo: string;
  readonly expiraEm: number;
};

/** O que está prestes a ser autorizado, ou `undefined` se já não vale. */
export async function verPedidoDeQr(
  id: string,
): Promise<PedidoParaAutorizar | undefined> {
  try {
    const r = (await client.api.get(`/auth/qr/${id}` as never)) as unknown as {
      name: string;
      code: string;
      expires_at: number;
    };
    return { nome: r.name, codigo: r.code, expiraEm: r.expires_at };
  } catch (e) {
    if (tipoDoErro(e) === "NotFound") return undefined;
    throw e;
  }
}

export async function autorizarQr(id: string): Promise<void> {
  await client.api.post(`/auth/qr/${id}/approve` as never);
}

export async function recusarQr(id: string): Promise<void> {
  await client.api.delete(`/auth/qr/${id}` as never);
}
