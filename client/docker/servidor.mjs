import { createServer } from "node:http";

import sirv from "sirv";

/**
 * O servidor estático da imagem do cliente.
 *
 * ⚠ **Existe porque as duas metades do `dist` precisam de políticas de cache
 * OPOSTAS, e o `sirv-cli` só tem a global.** Ele oferece `--maxage` e
 * `--immutable`, e os dois valem para tudo — o que obrigaria a escolher entre
 * nunca cachear os assets ou cachear o `index.html`. As duas escolhas são
 * ruins, e a segunda é a que estava no ar.
 *
 * ⚠ **O que estava acontecendo, medido:** a resposta não trazia
 * `Cache-Control` NEM `ETag` — só `Last-Modified`. Sem diretiva, o navegador
 * aplica cache heurístico e inventa uma validade, tipicamente 10% do tempo
 * desde a última modificação. Ou seja: quem decidia por quanto tempo a versão
 * velha continuava no ar era o navegador, não nós. Custou três recargas com
 * cache-buster na mão durante a verificação de hoje, e num deploy de verdade
 * custa uma aba aberta rodando código antigo por tempo indeterminado.
 *
 * As duas metades:
 *
 * - **`/assets/*` é imutável por um ano.** O Vite põe o hash do CONTEÚDO no
 *   nome — conferido no `dist` publicado: zero arquivos sem hash ali dentro —,
 *   então o arquivo naquele endereço nunca muda. Conteúdo novo é nome novo, e
 *   revalidar seria uma ida à rede para ouvir "não mudou" sobre algo que não
 *   pode mudar.
 *
 * - **Todo o resto revalida sempre.** `index.html` é o índice que aponta para
 *   os hashes; se ele ficar velho, a pessoa continua carregando o bundle
 *   anterior mesmo com o novo publicado ao lado. `mark.svg` cai na mesma regra
 *   por não ter hash.
 *
 * ⚠ **`no-cache` não é "não guarde", é "guarde e pergunte".** Com o `ETag`
 * ligado, a revalidação do `index.html` custa um 304 sem corpo. `no-store`
 * seria o download inteiro a cada navegação, para nada.
 */

const PORTA = Number(process.env.PORT ?? 5000);

/** Um ano em segundos — o teto que a RFC recomenda para `max-age`. */
const UM_ANO = 31_536_000;

const servir = sirv("dist", {
  /*
    ⚠ Sem isto o `no-cache` do `index.html` vira download completo a cada
    navegação: `no-cache` obriga a perguntar, e sem validador não há o que
    comparar, então a resposta é sempre 200 com corpo.
  */
  etag: true,

  /* Fallback de SPA — o roteador é do cliente, e `/servidor/x/canal/y` tem de
     chegar nele em vez de virar 404 no disco. Era o `--single` do `sirv-cli`. */
  single: true,

  setHeaders(res, pathname) {
    /*
      Preservado do `--cors` que o comando anterior passava. Mesma origem em
      produção, mas o popout de chamada e a casca Electron carregam por outros
      caminhos, e tirar isto agora seria uma mudança de comportamento embutida
      numa correção de cache.
    */
    res.setHeader("Access-Control-Allow-Origin", "*");

    res.setHeader(
      "Cache-Control",
      pathname.startsWith("/assets/")
        ? `public, max-age=${String(UM_ANO)}, immutable`
        : "no-cache",
    );
  },
});

createServer((req, res) => {
  servir(req, res, () => {
    res.statusCode = 404;
    res.end("Not found");
  });
}).listen(PORTA, "0.0.0.0", () => {
  process.stdout.write(`Vortex em http://0.0.0.0:${String(PORTA)}\n`);
});
