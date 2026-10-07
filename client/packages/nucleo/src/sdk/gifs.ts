import type { FonteDeGifs } from "./fonteDeGifs";

/**
 * GIFs — a camada anticorrupção do provedor.
 *
 * ⚠ **O cliente NUNCA fala com Tenor, Klipy ou Giphy, e nunca vê chave de
 * API.** O servidor já tem o proxy: o serviço `gifbox`
 * (`server/crates/services/gifbox`) guarda a chave em `api.security.tenor_key`
 * e expõe `GET /trending`, `GET /search` e `GET /categories` autenticados pelo
 * token de sessão — o mesmo contrato que o cliente Solid consome. Com a chave
 * no cliente, qualquer pessoa com o bundle a teria; com o proxy, ela nem
 * existe deste lado.
 *
 * O que o cliente precisa saber é só ONDE o `gifbox` mora — e isso é lido em
 * `fonteDeGifs.ts`, que fica no bundle inicial. Este arquivo vai no chunk do
 * seletor, carregado só quando ele abre.
 *
 * ⚠ **Sem endereço, NENHUMA chamada sai.** `provedorDaFonte()` devolve
 * `undefined` e o seletor mostra o estado vazio que diz que a instância não
 * configurou GIFs. É o default de propósito: a instância privada padrão não
 * sobe o `gifbox`, e mandar a URL de cada busca para um domínio de terceiro
 * seria decisão de produto tomada por omissão.
 *
 * ⚠ **A prévia passa pelo `january`** (`/proxy?url=`), que já faz isso para
 * embed. Sem ele o navegador buscaria cada `webm` direto na CDN do provedor —
 * o IP de quem abriu o seletor indo junto, e a CSP bloqueando de qualquer
 * forma, porque `media-src` não tem origem de terceiro. É a mesma decisão do
 * markdown, que transforma `![](url)` em link pelo mesmo motivo.
 */

/** Um GIF, na forma do app. O protocolo do provedor não sai daqui. */
export type Gif = {
  readonly id: string;
  /**
   * O que vai na mensagem: o link público do GIF. O `january` gera o embed a
   * partir dele, igual a qualquer link colado.
   */
  readonly url: string;
  /** `webm` pequeno, já pelo proxy — é o que o seletor toca em loop. */
  readonly previa: string;
  readonly largura: number;
  readonly altura: number;
};

export type PaginaDeGifs = {
  readonly gifs: readonly Gif[];
  /** Cursor da próxima página; `undefined` quando acabou. */
  readonly proxima: string | undefined;
};

export type ConsultaDeGif =
  | { readonly tipo: "emAlta" }
  | { readonly tipo: "busca"; readonly termo: string };

export interface ProvedorDeGif {
  buscar(
    consulta: ConsultaDeGif,
    posicao: string | undefined,
    sinal?: AbortSignal,
  ): Promise<PaginaDeGifs>;
}

/**
 * A resposta no formato do `gifbox` (`types.rs`), não no do Tenor.
 * Declarado aqui e não importado de lugar nenhum — o serviço é Rust.
 */
type RespostaDoGifbox = {
  results?: {
    id?: unknown;
    url?: unknown;
    media_formats?: Record<string, { url?: unknown; dimensions?: unknown }>;
  }[];
  next?: unknown;
};

/** Quantos por página. O design mostra ~6 por tela; 30 cobre cinco rolagens. */
export const POR_PAGINA = 30;

/**
 * Locale da busca. Fixo em pt_BR como o resto do app — "deu ruim" só acha o
 * que se espera com o locale certo.
 */
const LOCALE = "pt_BR";

/**
 * Traduz a resposta do `gifbox`.
 *
 * ⚠ **Descarta o item sem formato tocável em vez de lançar.** Uma entrada
 * incompleta num lote de trinta não deve apagar as outras 29; e um item sem
 * dimensão não entra porque é a dimensão que reserva a altura no masonry — sem
 * ela a coluna saltaria quando o vídeo carregasse.
 */
export function traduzirPagina(
  resposta: unknown,
  viaProxy: (url: string) => string,
): PaginaDeGifs {
  const r = (typeof resposta === "object" && resposta !== null
    ? resposta
    : {}) as RespostaDoGifbox;
  const gifs: Gif[] = [];
  for (const item of Array.isArray(r.results) ? r.results : []) {
    const formato = item.media_formats?.tinywebm ?? item.media_formats?.webm;
    const dims = formato?.dimensions;
    if (
      typeof item.id !== "string" ||
      typeof item.url !== "string" ||
      typeof formato?.url !== "string" ||
      !Array.isArray(dims) ||
      typeof dims[0] !== "number" ||
      typeof dims[1] !== "number" ||
      dims[0] <= 0 ||
      dims[1] <= 0
    ) {
      continue;
    }
    gifs.push({
      id: item.id,
      url: item.url,
      previa: viaProxy(formato.url),
      largura: dims[0],
      altura: dims[1],
    });
  }
  return {
    gifs,
    proxima: typeof r.next === "string" && r.next !== "" ? r.next : undefined,
  };
}

export type ConfiguracaoDoGifbox = {
  /** Base do serviço, sem barra final. */
  readonly base: string;
  /** Base do `january`, quando a instância o anuncia. */
  readonly proxy: string | undefined;
  readonly cabecalho: () => [string, string] | undefined;
  readonly buscarNaRede?: typeof fetch;
};

/**
 * O provedor sobre o `gifbox`. Separado da leitura de configuração para o
 * teste montar a requisição sem `client` nenhum.
 */
export function criarProvedorGifbox(cfg: ConfiguracaoDoGifbox): ProvedorDeGif {
  const viaProxy = (url: string) =>
    cfg.proxy === undefined
      ? url
      : `${cfg.proxy}/proxy?url=${encodeURIComponent(url)}`;

  return {
    async buscar(consulta, posicao, sinal) {
      const params = new URLSearchParams({
        locale: LOCALE,
        limit: String(POR_PAGINA),
      });
      if (consulta.tipo === "busca") params.set("query", consulta.termo);
      if (posicao !== undefined) params.set("position", posicao);
      const caminho = consulta.tipo === "busca" ? "search" : "trending";

      const cabecalho = cfg.cabecalho();
      const resposta = await (cfg.buscarNaRede ?? fetch)(
        `${cfg.base}/${caminho}?${params.toString()}`,
        {
          headers: cabecalho ? { [cabecalho[0]]: cabecalho[1] } : {},
          signal: sinal,
        },
      );
      if (!resposta.ok) throw new Error(`gifbox respondeu ${resposta.status}`);
      return traduzirPagina(await resposta.json(), viaProxy);
    },
  };
}

/**
 * O provedor de uma fonte, ou `undefined` quando a instância não configurou
 * GIFs. Sem fonte, nada é montado — e nada que busque na rede existe.
 */
export function provedorDaFonte(fonte: FonteDeGifs | undefined): ProvedorDeGif | undefined {
  if (fonte === undefined) return undefined;
  if (fonte.tipo === "dublado") return fonte.provedor;
  return criarProvedorGifbox(fonte.configuracao);
}
