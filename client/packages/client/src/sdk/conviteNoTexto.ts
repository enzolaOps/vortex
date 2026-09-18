/**
 * O código de convite escrito dentro de uma mensagem, quando há um.
 *
 * ⚠ **Reconhece só as formas que são convite POR CONSTRUÇÃO**, e nunca "o
 * último segmento de qualquer URL": `codigoDe` aceita `abc123` solto porque
 * quem o chama está num campo chamado "Convite", e aqui a entrada é texto que
 * outra pessoa escreveu. Um scanner permissivo transformaria
 * `https://exemplo/artigos/react` num cartão dizendo "Convite para servidor",
 * e o cartão traz um botão que MUDA de servidor.
 *
 * As três formas: o caminho deste app (`/convite/x`), o do upstream
 * (`/invite/x`) e o encurtador (`stt.gg/x`, `vortex.gg/x`) — que é o que o
 * design desenha no chat.
 *
 * ⚠ **Uma varredura linear, sem cache.** Ela roda no mesmo lugar e com o mesmo
 * custo do `content.includes("<@id>")` que decide `mencionaVoce`, e sobre a
 * mesma string. Cachear custaria um `Map` a mais para poupar um passe por um
 * texto que o markdown já percorre inteiro logo ao lado.
 */
const LINK_DE_CONVITE =
  /https?:\/\/(?:[\w.-]+\/(?:convite|invite)\/([A-Za-z0-9_-]{1,64})|(?:stt\.gg|vortex\.gg)\/([A-Za-z0-9_-]{1,64}))/;

export function conviteNoTexto(conteudo: string): string | undefined {
  const m = LINK_DE_CONVITE.exec(conteudo);
  if (m === null) return undefined;
  return m[1] ?? m[2];
}
