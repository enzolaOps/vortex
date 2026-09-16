/**
 * Exportar os dados da conta — `/auth/export` do fork.
 *
 * O Stoat não tem exportação, nem o upstream. O servidor enfileira, gera um
 * ZIP em disco com uma exportação por vez, e devolve um link que vale 48 h
 * (e manda por e-mail quando a instância tem SMTP). Ver
 * `server/crates/delta/src/routes/export`.
 */
import { formatarBytes } from "../lib/bytes";
import { client } from "./client";
import { API_URL } from "./config";
import { tipoDoErro } from "./erros";

export type FaseDaExportacao = "naFila" | "gerando" | "pronta" | "falhou";

export type Exportacao = {
  readonly fase: FaseDaExportacao;
  /** Unix ms do pedido. */
  readonly pedidaEm: number;
  readonly mensagens: number;
  /** Unix ms a partir do qual um pedido novo é aceito. */
  readonly proximoPedidoEm: number;
  /** Só quando `pronta`. */
  readonly link: string | undefined;
  readonly expiraEm: number | undefined;
  readonly tamanhoTexto: string | undefined;
  readonly enviadaPorEmail: boolean;
};

type Corpo = {
  state: "Queued" | "Running" | "Ready" | "Failed";
  requested_at: number;
  messages: number;
  next_request_at: number;
  expires_at?: number;
  size?: number;
  download?: string;
  emailed: boolean;
};

const FASE: Record<Corpo["state"], FaseDaExportacao> = {
  Queued: "naFila",
  Running: "gerando",
  Ready: "pronta",
  Failed: "falhou",
};

export function traduzirExportacao(c: Corpo): Exportacao {
  const pronta = c.state === "Ready" && c.download !== undefined;
  return {
    fase: FASE[c.state],
    pedidaEm: c.requested_at,
    mensagens: c.messages,
    proximoPedidoEm: c.next_request_at,
    // O último segmento é só o nome com que o navegador salva o arquivo.
    link: pronta
      ? `${API_URL}/auth/export/download/${c.download}/vortex-dados.zip`
      : undefined,
    expiraEm: pronta ? c.expires_at : undefined,
    tamanhoTexto: c.size !== undefined ? formatarBytes(c.size) : undefined,
    enviadaPorEmail: c.emailed,
  };
}

/** O último pedido, `null` se nunca houve, `undefined` se não deu para saber. */
export async function lerExportacao(): Promise<Exportacao | null | undefined> {
  try {
    const c = (await client.api.get("/auth/export/status" as never)) as unknown as Corpo;
    return traduzirExportacao(c);
  } catch (e) {
    return tipoDoErro(e) === "NotFound" ? null : undefined;
  }
}

export async function pedirExportacao(): Promise<Exportacao> {
  const c = (await client.api.post("/auth/export/request" as never)) as Corpo;
  return traduzirExportacao(c);
}

/**
 * Quanto uma exportação pode ficar na fila ou gerando antes de ser tida como
 * morta — o `TRAVADA_MS` do servidor. A fila mora na memória da API; se ela
 * reinicia no meio, o estado fica "gerando" para sempre, e o servidor passa a
 * aceitar um pedido novo depois deste prazo. A tela precisa saber o mesmo, ou
 * o botão ficaria girando sobre um trabalho que ninguém mais faz.
 */
export const TRAVADA_MS = 6 * 60 * 60 * 1000;

export type AcaoDaExportacao = "solicitar" | "gerando" | "baixar" | "aguardar";

const DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * O que a linha diz e qual botão ela mostra.
 *
 * Função pura e não JSX, para o teste cobrir as quatro fases sem montar a
 * página: é aqui que "posso pedir de novo?" é decidido, e errar isso ou
 * esconde o link de quem acabou de gerar, ou deixa pedir um segundo arquivo
 * que o servidor recusa em silêncio (ele devolve o estado atual).
 */
export function descreverExportacao(
  e: Exportacao | null,
  agora: number,
): { readonly detalhe: string; readonly acao: AcaoDaExportacao } {
  const padrao = "Mensagens, servidores e configurações em JSON · até 48 h";
  if (e === null) return { detalhe: padrao, acao: "solicitar" };

  const emCurso = e.fase === "naFila" || e.fase === "gerando";
  if (emCurso && agora - e.pedidaEm >= TRAVADA_MS) {
    return { detalhe: "A geração parou no meio. Peça de novo.", acao: "solicitar" };
  }

  if (e.fase === "naFila") {
    return { detalhe: "Na fila — uma exportação por vez neste servidor", acao: "gerando" };
  }
  if (e.fase === "gerando") {
    return {
      detalhe: `Gerando o arquivo · ${e.mensagens.toLocaleString("pt-BR")} mensagens até agora`,
      acao: "gerando",
    };
  }
  if (e.fase === "falhou") {
    return { detalhe: "Não deu para gerar o arquivo. Tente de novo.", acao: "solicitar" };
  }

  const vale = e.link !== undefined && e.expiraEm !== undefined && agora < e.expiraEm;
  if (vale) {
    const partes = [
      "Pronto",
      e.tamanhoTexto,
      `link vale até ${DATA.format(e.expiraEm)}`,
      e.enviadaPorEmail ? "enviado por e-mail" : undefined,
    ].filter((p): p is string => p !== undefined);
    return { detalhe: partes.join(" · "), acao: "baixar" };
  }

  if (agora < e.proximoPedidoEm) {
    return {
      detalhe: `O link venceu. Um pedido novo a partir de ${DATA.format(e.proximoPedidoEm)}`,
      acao: "aguardar",
    };
  }
  return { detalhe: padrao, acao: "solicitar" };
}
