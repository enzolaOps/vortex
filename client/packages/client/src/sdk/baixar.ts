/**
 * Baixar um anexo para o computador.
 *
 * ⚠ **`<a download>` não resolve, e a razão é de ORIGEM.** O `autumn` mora em
 * outra origem que o cliente (outro host na instância local, outro caminho
 * atrás do Caddy), e o navegador IGNORA o atributo `download` de origem
 * cruzada: vira navegação. O servidor até manda `Content-Disposition:
 * attachment` na rota do original — lido em `crates/services/autumn/src/api.rs`,
 * `fetch_file` —, então a navegação acabaria baixando; mas o nome do arquivo
 * seria o que a URL disser, e uma falha (404, rede) viraria uma aba de erro sem
 * nada que a interface consiga contar.
 *
 * O caminho é `fetch` → `Blob` → URL `blob:` desta origem → `<a download>`.
 * Aí o atributo vale, o nome é o que a pessoa viu no rodapé, e a falha chega
 * aqui como exceção, onde o botão pode dizer o que houve. A CSP já permite:
 * `connect-src` recebe a origem da instância (`vite.config.ts`), e o
 * `autumn` responde `Access-Control-Allow-Origin: *` (`CorsLayer` com
 * `allow_origin(Any)`).
 *
 * ⚠ **Na casca Electron o mesmo clique serve**: um `<a download>` para `blob:`
 * dispara o `will-download` do `session`, que é o caminho padrão de download
 * do Electron. Não há verbo novo na ponte, e não deveria haver — "casca fina".
 */

/**
 * A URL que entrega o arquivo com o nome certo.
 *
 * `AnexoSnapshot.url` termina em `/original`, e o `autumn` responde a isso
 * com um redirect PERMANENTE para `/{tag}/{id}/{nome}`. ⚠ **O redirect é
 * absoluto na raiz** (`Redirect::permanent("/{tag}/…")`), então atrás de um
 * proxy que monta o `autumn` num prefixo (`https://dominio/autumn`) ele aponta
 * para fora do prefixo e dá 404. Pedir direto pelo nome evita o salto.
 *
 * O nome vai CODIFICADO: `fetch_file` compara o segmento decodificado com o
 * `filename` guardado, e um `#` ou `?` cru cortaria a URL antes dele.
 *
 * Mora em `sdk/` porque `/original` é forma de protocolo — o componente não
 * deve saber que o sufixo existe.
 */
export function urlDeDownload(url: string, nome: string): string {
  const SUFIXO = "/original";
  if (!url.endsWith(SUFIXO) || nome.trim() === "") return url;
  return `${url.slice(0, -SUFIXO.length)}/${encodeURIComponent(nome)}`;
}

/** A falha, já traduzida para a pessoa. */
export class ErroDeDownload extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeDownload";
  }
}

/** A frase para um status HTTP de falha. Pura, para ter teste. */
export function motivoDoDownload(status: number): string {
  if (status === 404) return "O arquivo não existe mais no servidor.";
  if (status === 401 || status === 403) return "Você não tem acesso a esse arquivo.";
  if (status === 429) return "Muitos pedidos seguidos. Tente de novo em instantes.";
  return "O servidor de arquivos recusou o pedido.";
}

/**
 * Baixa e entrega ao navegador.
 *
 * Resolve quando o arquivo foi ENTREGUE ao navegador — não quando a pessoa
 * escolheu onde salvar, que é diálogo do sistema e não tem evento.
 */
export async function baixarAnexo(
  url: string,
  nome: string,
  sinal?: AbortSignal,
): Promise<void> {
  let resposta: Response;
  try {
    resposta = await fetch(urlDeDownload(url, nome), { signal: sinal });
  } catch {
    if (sinal?.aborted) throw new ErroDeDownload("Download cancelado.");
    throw new ErroDeDownload("Não deu para falar com o servidor de arquivos.");
  }
  if (!resposta.ok) throw new ErroDeDownload(motivoDoDownload(resposta.status));

  const blob = await resposta.blob();
  const endereco = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = endereco;
  a.download = nome;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  /*
    Revogar no mesmo tique cancela o download em alguns navegadores: o clique
    só AGENDA a leitura do blob. Um minuto é folga para qualquer arquivo que o
    `autumn` aceita (20 MB), e sem revogar o blob vive até a aba fechar — o
    erro nº 5 do briefing numa sessão de 8h de quem baixa muita coisa.
  */
  setTimeout(() => URL.revokeObjectURL(endereco), 60_000);
}
