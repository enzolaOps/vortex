import { client } from "./client";
import { toast } from "../components/ui/toastStore";
import { escolherAutor, type TipoDeConteudo } from "../busca/filtros";

/**
 * Busca de mensagens — a camada anticorrupção.
 *
 * ⚠ **O que o protocolo TEM:** `query`, `sort` (Relevance/Latest/Oldest),
 * `limit` e os cursores `before`/`after`. É `POST /channels/{id}/search`, e
 * `stoat.js` o expõe como `Channel.search`.
 *
 * ⚠ **O que o servidor do Vortex acrescenta:** `author` (`de:marina`) e `has`
 * (`tem:arquivo`). As datas (`antes:`/`depois:`/`durante:`) não precisaram de
 * campo: viram os cursores `before`/`after`, que já existiam. Filtrar no
 * CLIENTE seria pior que não ter filtro — a busca devolve uma página, e
 * filtrar depois esvaziaria páginas inteiras. Buscar em TODOS os canais do
 * servidor segue pendente.
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

/** `tem:` → o `has` do servidor do Vortex. Não sai daqui. */
const HAS: Record<TipoDeConteudo, string> = {
  arquivo: "Attachment",
  imagem: "Image",
  video: "Video",
  audio: "Audio",
  link: "Link",
};

/**
 * `de:nome` → o ID de alguém que a sessão conhece.
 *
 * Varre as pessoas em cache: quem escreveu no canal aparece nele, e buscar
 * alguém que a sessão nunca viu por nome exigiria uma rota que não existe.
 */
export function resolverAutor(nome: string, channelId: string): string | undefined {
  const serverId = client.channels.get(channelId)?.serverId || undefined;
  const candidatos = client.users.toList().map((u) => {
    const apelido = serverId
      ? client.serverMembers.getByKey({ server: serverId, user: u.id })?.nickname
      : undefined;
    return {
      id: u.id,
      nomes: [u.username, u.displayName, apelido].filter(
        (n): n is string => typeof n === "string" && n.length > 0,
      ),
    };
  });
  return escolherAutor(nome, candidatos);
}

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

export async function buscarNoCanal(opcoes: {
  channelId: string;
  /** Texto livre. Vazio é legítimo quando há filtro — "tudo de marina". */
  consulta: string;
  ordem: OrdemDeBusca;
  /** ID da mensagem antes da qual buscar — a página seguinte ou `antes:`. */
  antesDe: string | undefined;
  /** `depois:` e o começo de `durante:`. */
  depoisDe?: string | undefined;
  autorId?: string | undefined;
  tem?: TipoDeConteudo | undefined;
}): Promise<readonly ResultadoDeBusca[] | undefined> {
  const canal = client.channels.get(opcoes.channelId);
  if (!canal) return undefined;

  try {
    const mensagens = await canal.search({
      /* O servidor valida `query` com tamanho mínimo 1: vazio vai AUSENTE. */
      ...(opcoes.consulta.length > 0 ? { query: opcoes.consulta } : {}),
      sort: SORT[opcoes.ordem],
      limit: POR_PAGINA,
      ...(opcoes.antesDe !== undefined ? { before: opcoes.antesDe } : {}),
      ...(opcoes.depoisDe !== undefined ? { after: opcoes.depoisDe } : {}),
      ...(opcoes.autorId !== undefined ? { author: opcoes.autorId } : {}),
      ...(opcoes.tem !== undefined ? { has: HAS[opcoes.tem] } : {}),
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
