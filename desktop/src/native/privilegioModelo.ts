/**
 * O que cada janela pode fazer além de desenhar — a DECISÃO, sem Electron.
 *
 * ⚠ **A janela do overlay só desenha o que a principal publica.** Ela não
 * tem sessão, socket nem motivo para falar com a API, abrir janela, navegar
 * ou pedir microfone. Tudo isso é negado por construção, para que um XSS no
 * overlay (que renderiza nome e texto escritos por qualquer pessoa) não tenha
 * o que usar:
 *
 *  - **Sessão própria, só em memória** (`PARTICAO_DO_OVERLAY`, sem `persist:`):
 *    nem cookie, nem cache, nem `localStorage` da principal — e o token mora
 *    no `localStorage` da principal.
 *  - **Rede só para os assets do app**: a origem do app, fora dos caminhos da
 *    API, do socket e do proxy de mídia de terceiros.
 *  - **Nenhuma navegação, nenhuma janela nova, nenhuma permissão.**
 *
 * A principal continua com a regra de sempre (`main.ts`): navegar só dentro
 * da origem do app e abrir link externo no navegador do sistema.
 */

/** Sem `persist:` — a partição vive só na memória desta execução. */
export const PARTICAO_DO_OVERLAY = "vortex-overlay";

/**
 * Caminhos da origem do app que NÃO são assets: a API (`/api`, onde o
 * compose serve o `delta`), o socket (`/ws`) e o proxy que busca URL de
 * terceiros (`/january`). O overlay não fala com nenhum.
 */
export const CAMINHOS_QUE_NAO_SAO_ASSETS: readonly string[] = ["/api", "/ws", "/january"];

function url(bruta: string): URL | undefined {
  try {
    return new URL(bruta);
  } catch {
    return undefined;
  }
}

function dentroDe(caminho: string, prefixo: string): boolean {
  const c = caminho.toLowerCase();
  return c === prefixo || c.startsWith(`${prefixo}/`);
}

/** O overlay pode fazer esta requisição? */
export function requisicaoDoOverlayPermitida(bruta: string, origemDoApp: string): boolean {
  const u = url(bruta);
  if (!u) return false;
  /* Não são rede: conteúdo já na memória do próprio renderer. */
  if (u.protocol === "data:" || u.protocol === "blob:") return true;
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.origin !== origemDoApp) return false;
  return !CAMINHOS_QUE_NAO_SAO_ASSETS.some((p) => dentroDe(u.pathname, p));
}

/** Nenhuma permissão (mídia, notificação, área de transferência…) no overlay. */
export function permissaoDoOverlay(_permissao: string): false {
  return false;
}

/** O overlay nunca navega — nem para a própria origem. */
export function navegacaoDoOverlayPermitida(_url: string): false {
  return false;
}

/** O overlay nunca abre janela, nem manda link para o navegador. */
export function janelaNovaDoOverlay(): { action: "deny" } {
  return { action: "deny" };
}

/**
 * A principal só navega dentro da origem do app. URL que não se deixa ler é
 * recusada — na versão anterior, `new URL` lançando dentro do ouvinte deixava
 * a navegação seguir, porque ninguém chamava `preventDefault`.
 */
export function navegacaoDaPrincipalPermitida(bruta: string, origemDoApp: string): boolean {
  return url(bruta)?.origin === origemDoApp;
}

/** Link que a principal manda para o navegador do sistema em vez de abrir. */
export function abrirNoNavegadorDoSistema(bruta: string): boolean {
  const p = url(bruta)?.protocol;
  return p === "http:" || p === "https:" || p === "mailto:";
}

/* ---------------------------------------------- aplicação, sem Electron */

/** O mínimo de `Session` que a proteção usa. */
export type SessaoConferivel = {
  webRequest: {
    onBeforeRequest(
      filtro: { urls: string[] },
      ouvinte: (
        detalhes: { url: string },
        callback: (resposta: { cancel: boolean }) => void,
      ) => void,
    ): void;
  };
  setPermissionRequestHandler(
    handler: (wc: unknown, permissao: string, callback: (sim: boolean) => void) => void,
  ): void;
  setPermissionCheckHandler(handler: (wc: unknown, permissao: string) => boolean): void;
};

/** O mínimo de `WebContents` que a proteção usa. */
export type ConteudoConferivel = {
  on(evento: "will-navigate" | "will-frame-navigate", ouvinte: (e: { preventDefault(): void; url: string }) => void): unknown;
  setWindowOpenHandler(handler: (detalhes: { url: string }) => { action: "deny" }): void;
};

export function protegerSessaoDoOverlay(sessao: SessaoConferivel, origemDoApp: () => string): void {
  sessao.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (detalhes, callback) =>
    callback({ cancel: !requisicaoDoOverlayPermitida(detalhes.url, origemDoApp()) }),
  );
  sessao.setPermissionRequestHandler((_wc, permissao, callback) =>
    callback(permissaoDoOverlay(permissao)),
  );
  sessao.setPermissionCheckHandler((_wc, permissao) => permissaoDoOverlay(permissao));
}

export function protegerConteudoDoOverlay(conteudo: ConteudoConferivel): void {
  const barrar = (e: { preventDefault(): void; url: string }) => {
    if (!navegacaoDoOverlayPermitida(e.url)) e.preventDefault();
  };
  conteudo.on("will-navigate", barrar);
  conteudo.on("will-frame-navigate", barrar);
  conteudo.setWindowOpenHandler(janelaNovaDoOverlay);
}
