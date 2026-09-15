import { decodeTime } from "ulid";

import { client } from "./client";
import { toast } from "../components/ui/toastStore";

/**
 * Busca de mensagens — a camada anticorrupção.
 *
 * ⚠ **O que o protocolo TEM:** `query`, `sort` (Relevance/Latest/Oldest),
 * `limit` e os cursores `before`/`after`. É `POST /channels/{id}/search`, e
 * `stoat.js` o expõe como `Channel.search`.
 *
 * ⚠ **O que ele NÃO tem, e a tela desenha:** filtro por autor (`de:marina`) e
 * por tipo de anexo (`tem:arquivo`). Os dois estão no registro de pendências.
 *
 * **Busca no servidor inteiro é do fork** (`POST /servers/{id}/search`, serviço
 * `api` do Vortex): mesmos parâmetros e cursores, e o SERVIDOR tira da consulta
 * os canais que a pessoa não pode ler antes de ir ao banco. Varrer N canais no
 * cliente seriam N chamadas e uma ordenação que nenhuma delas conhece — por
 * isso a rota, e não um laço aqui. Um servidor Stoat de fábrica responde 404,
 * que chega à tela como falha de busca, não como "nada encontrado". Fazer o filtro no cliente seria pior
 * que não tê-lo: a busca devolve uma página de resultados, então filtrar
 * depois esvaziaria páginas inteiras e a contagem mentiria.
 *
 * ⚠ **Paginação é por CURSOR, não por página.** O protocolo não sabe "página
 * 3"; sabe "antes desta mensagem". O store guarda a pilha de cursores, que é o
 * que permite os números 1·2·3 do design — só se chega à 3 passando pela 2, e
 * é exatamente isso que o desenho mostra.
 */

/** Um resultado, já em tipo do app. Nada do SDK sai daqui. */
export type ResultadoDeBusca = {
  readonly id: string;
  readonly channelId: string;
  readonly nomeDoCanal: string;
  readonly autorId: string | undefined;
  readonly conteudo: string;
  readonly quando: string;
  /** Só o nome; o peso e a URL não cabem numa prévia de duas linhas. */
  readonly anexo: string | undefined;
};

export type OrdemDeBusca = "recentes" | "relevantes";

/** A grafia do protocolo. Não sai daqui. */
const SORT = {
  recentes: "Latest",
  relevantes: "Relevance",
} as const;

/**
 * 25 por página, do design ("Paginação de 25 em 25, sem scroll infinito").
 *
 * Sem scroll infinito é decisão do design e é a certa aqui: resultado de busca
 * é lista que se VARRE e da qual se sai, não histórico que se percorre. Scroll
 * infinito num painel de 380px esconde quantos resultados existem.
 */
export const POR_PAGINA = 25;

const HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Mensagem crua do protocolo — só o que a prévia usa. Não sai daqui. */
type MensagemCrua = {
  _id: string;
  channel: string;
  author?: string;
  content?: string | null;
  attachments?: { filename?: string }[] | null;
};

/**
 * Traduz a resposta crua da busca de servidor.
 *
 * A rota do fork devolve `BulkMessageResponse` sem hidratar — `Message` do SDK
 * não passa por aqui, então o instante sai do ULID (é o mesmo que o SDK faz em
 * `createdAt`). Aceita as duas formas da resposta: lista pura, ou
 * `{messages}` quando alguém pedir `include_users`.
 */
export function traduzirResultadosCrus(
  resposta: unknown,
  nomeDoCanal: (channelId: string) => string,
): readonly ResultadoDeBusca[] {
  const lista = Array.isArray(resposta)
    ? resposta
    : (resposta as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(lista)) return [];
  return (lista as MensagemCrua[])
    .filter((m) => typeof m?._id === "string" && typeof m.channel === "string")
    .map((m) => {
      let quando = "";
      try {
        quando = HORA.format(decodeTime(m._id));
      } catch {
        /* ID fora da forma ULID: a prévia fica sem hora, e não com a de agora. */
      }
      return {
        id: m._id,
        channelId: m.channel,
        nomeDoCanal: nomeDoCanal(m.channel),
        autorId: m.author,
        conteudo: m.content ?? "",
        quando,
        anexo: m.attachments?.[0]?.filename,
      };
    });
}

/** O servidor do canal, ou nada — DM e grupo não têm onde buscar "no servidor". */
export function servidorDoCanal(channelId: string): string | undefined {
  return client.channels.get(channelId)?.serverId ?? undefined;
}

export async function buscarNoServidor(opcoes: {
  serverId: string;
  consulta: string;
  ordem: OrdemDeBusca;
  antesDe: string | undefined;
}): Promise<readonly ResultadoDeBusca[] | undefined> {
  try {
    const resposta: unknown = await client.api.post(
      `/servers/${opcoes.serverId}/search` as never,
      {
        query: opcoes.consulta,
        sort: SORT[opcoes.ordem],
        limit: POR_PAGINA,
        ...(opcoes.antesDe !== undefined ? { before: opcoes.antesDe } : {}),
      } as never,
    );
    return traduzirResultadosCrus(
      resposta,
      (id) => client.channels.get(id)?.name ?? "canal",
    );
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "A busca no servidor não foi.",
      descricao: e instanceof Error ? e.message : "Tente de novo.",
    });
    return undefined;
  }
}

export async function buscarNoCanal(opcoes: {
  channelId: string;
  consulta: string;
  ordem: OrdemDeBusca;
  /** ID da mensagem antes da qual buscar — a página seguinte. */
  antesDe: string | undefined;
}): Promise<readonly ResultadoDeBusca[] | undefined> {
  const canal = client.channels.get(opcoes.channelId);
  if (!canal) return undefined;

  try {
    const mensagens = await canal.search({
      query: opcoes.consulta,
      sort: SORT[opcoes.ordem],
      limit: POR_PAGINA,
      ...(opcoes.antesDe !== undefined ? { before: opcoes.antesDe } : {}),
    });

    return mensagens.map((m) => ({
      id: m.id,
      channelId: m.channelId,
      /* O nome do canal vem do cache do SDK e não da mensagem: `Message` só
         carrega o ID. Ausente vira o próprio ID truncado — mentir um nome
         seria pior num painel cuja função é dizer ONDE está o resultado. */
      nomeDoCanal: client.channels.get(m.channelId)?.name ?? "canal",
      autorId: m.authorId,
      conteudo: m.content ?? "",
      quando: HORA.format(m.createdAt),
      anexo: m.attachments?.[0]?.filename,
    }));
  } catch (e) {
    /*
      Toast e `undefined`, não exceção: quem chama é um `onChange` de campo, e
      uma promessa rejeitada ali derruba o painel inteiro por causa de uma
      digitação com a rede fora.
    */
    toast({
      tipo: "erro",
      titulo: "A busca não foi.",
      descricao: e instanceof Error ? e.message : "Tente de novo.",
    });
    return undefined;
  }
}
