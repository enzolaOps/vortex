import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
// `vitest/config` e não `vite`: é o que acrescenta a chave `test` ao tipo da
// configuração. Com o `defineConfig` do Vite, o bloco abaixo não compila.
import { defineConfig } from "vitest/config";

/**
 * A Content-Security-Policy, injetada no `index.html`.
 *
 * ⚠ **Ela é regra escrita do briefing que nunca teve mecanismo.** A seção de
 * Electron manda "CSP sem `unsafe-inline`", e a linha do token em
 * `localStorage` a nomeia como metade da defesa: *"a defesa real é não dar o
 * XSS (nada de `innerHTML` com conteúdo de terceiro, CSP sem
 * `unsafe-inline`)"*. A primeira metade existe — o pipeline de markdown não
 * usa `innerHTML`, barra `javascript:` e `data:`, e transforma imagem em
 * link. A segunda nunca foi construída, e nada falhou por isso. Medido no
 * Electron: `eval()` e `<script>` inline executavam, e o próprio Electron
 * avisava no console.
 *
 * ⚠ **No `index.html` e não num cabeçalho, e a razão é de cobertura.** Quem
 * serve o cliente em produção é o `sirv-cli`, que não emite cabeçalho custom;
 * o `vite preview` também não; e a casca Electron carrega uma URL remota, então
 * ela herda o que vier. Uma `<meta>` acompanha o arquivo por todos os três
 * caminhos. O que a meta NÃO consegue — `frame-ancestors`, `report-uri` — pede
 * cabeçalho no Caddy do `pi-infra`, e fica registrado como o passo seguinte.
 *
 * ⚠ **`connect-src` é DERIVADO do alvo do build.** Em produção a API é
 * `location.origin` e `'self'` basta; num build de desenvolvimento contra a
 * pilha local (`VITE_API_URL=http://localhost:8880/api`) ela é outra origem, e
 * um `'self'` seco bloquearia o app inteiro. Derivar da variável que já decide
 * o alvo é a única forma de a política ser estreita nos dois casos sem ninguém
 * afrouxá-la à mão — afrouxar à mão é como uma CSP vira `default-src *`.
 *
 * ⚠ **`style-src` aceita `'unsafe-inline'`, e o script-src NÃO.** São riscos de
 * ordens diferentes: injeção de script rouba o token que mora em
 * `localStorage`; injeção de estilo, no pior caso, desfigura. E o app tem 43
 * usos de `style={{…}}` — gradiente de avatar, trilhas do grid, cor de cargo —
 * que são atributos de estilo e não existem sem isso. Dizer "CSP sem
 * unsafe-inline" e entregar `script-src 'self'` é a parte que importa; fingir
 * que o `style-src` também está fechado seria falso.
 */
function cspDoVortex(): Plugin {
  /*
    ⚠ **O env RESOLVIDO do Vite, e não `process.env` — a derivação nunca
    funcionou em dev por causa disso.**

    O Vite carrega `.env`, `.env.local` e afins em `config.env`, não no
    `process.env` do processo. Lendo o segundo, `VITE_DEV_API_URL` vinha
    vazio, `connect-src` caía em `'self'` seco, e o app não conseguia falar
    com a instância local. Medido no console:

      Connecting to 'http://localhost:8880/api/?' violates the following
      Content Security Policy directive: "connect-src 'self'"

    Em produção passava despercebido porque lá a API é `location.origin` e
    `'self'` é a resposta certa — a política estava correta pelo motivo
    errado, e só quebrava onde ninguém a mede.
  */
  let env: Record<string, string> = {};

  return {
    name: "vortex-csp",

    configResolved(cfg) {
      env = cfg.env as Record<string, string>;
    },

    transformIndexHtml(html, ctx) {
      const alvo = (ctx.server ? env.VITE_DEV_API_URL : env.VITE_API_URL) ?? "";
      /*
        ⚠ **Duas listas, e não uma.** `connect-src` precisa do socket, que é
        origem SEPARADA (`ws:` não casa com `http:`); `img-src` e `media-src`
        precisam só da origem HTTP, onde mora o `autumn`. Uma lista só poria
        `ws://…` dentro de `img-src` — inofensivo e sem sentido, do tipo que
        faz quem lê a política adiante desconfiar dela inteira.
      */
      const origens = new Set<string>();
      const extras = new Set<string>();
      if (alvo) {
        try {
          const u = new URL(alvo);
          origens.add(u.origin);
          extras.add(u.origin);
          /* O socket vive no mesmo host por uma rota (`/ws`), mas com esquema
             próprio — e `connect-src` trata `ws:` como origem separada de
             `http:`. Sem esta linha o app conecta a API e nunca o socket. */
          extras.add(`${u.protocol === "https:" ? "wss" : "ws"}://${u.host}`);
        } catch {
          /* URL inválida é problema do build, não desta política: o
             `sdk/config.ts` falha adiante com mensagem melhor. */
        }
      }

      const politica = [
        "default-src 'self'",
        /*
          ⚠ **Em DEV o `script-src` aceita inline, e sem isso o app não monta.**

          O Vite injeta o preâmbulo do React Refresh como script INLINE no
          `index.html` do dev server. Com `script-src 'self'` ele é bloqueado,
          `$RefreshReg$` nunca é definido, e o primeiro módulo transformado que
          o referencia lança ANTES de `createRoot`. Medido: `#root` com zero
          filhos, body vazio, e no console
          `Uncaught ReferenceError: $RefreshReg$ is not defined`.

          ⚠ **Produção não muda, e é por isso que ninguém viu.** O build não
          tem preâmbulo, então `pnpm check` passava: ele CONSTRÓI, e construir
          não exercita o dev server. É a mesma família do "medir com o
          instrumento desligado" que esta base já registra cinco vezes — a
          guarda cobre o artefato e não o ambiente onde se trabalha.

          Relaxa só esta diretiva, e só aqui. Desligar a `<meta>` inteira em
          dev seria mais simples e pior: `img-src`, `connect-src` e
          `media-src` deixariam de ser exercitados justamente onde os erros
          aparecem primeiro — foi bloqueando avatar e fonte que as duas linhas
          acima foram descobertas.
        */
        ctx.server ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        /* `data:` para o gradiente do avatar quando ele vira SVG embutido;
           `blob:` para anexo que a pessoa acabou de escolher e ainda não subiu. */
        /* ⚠ **Sem `https:`, e é decisão que tem data de validade.** O markdown
           deste cliente transforma `![](url)` em LINK justamente para o
           navegador não buscar URL de terceiro sozinho. Quando os embeds
           existirem — são pendência registrada —, eles trazem imagem remota e
           esta linha precisa de `https:`. Até lá, fechado é o certo.

           ⚠ **A ORIGEM DA INSTÂNCIA entra aqui, e a falta dela era um defeito
           silencioso.** O comentário anterior dizia "em produção toda imagem
           vem do `autumn` na MESMA origem" — verdade no contêiner, onde o
           Caddy serve cliente e API no mesmo domínio, e FALSA em todo outro
           arranjo. Com `VITE_API_URL` apontando para outra origem — que é o
           caso da casca de desenvolvimento, cliente em `:4175` e API em
           `:8880` —, `autumn` fica cross-origin e TODO ícone de servidor e
           TODO avatar era bloqueado.

           O sintoma não parecia CSP: os ladrilhos caíam no gradiente com as
           iniciais, que é exatamente o fallback correto para "esta pessoa não
           tem foto". Um servidor chamado "Com Icone" aparecia como "CI". Só o
           console dizia a verdade.

           Não é afrouxar a política: é a MESMA origem que `connect-src` já
           recebia, pela mesma razão e computada uma vez só. `media-src` vai
           junto — mensagem de voz e anexo de áudio vêm do mesmo lugar. */
        ["img-src 'self' data: blob:", ...origens].join(" "),
        ["media-src 'self' blob:", ...origens].join(" "),
        /* ⚠ `data:` é OBRIGATÓRIO, e descobri bloqueando o app: o Vite embute
           asset abaixo de 4 kB como data URI, e um subconjunto de fonte caiu
           nessa faixa. Com `font-src 'self'` seco o texto perdia a fonte e o
           console acusava — a política ficava "correta" e o produto errado. */
        "font-src 'self' data:",
        ["connect-src 'self'", ...extras].join(" "),
        /* Nada disto existe no produto, e declarar o vazio é o que impede que
           passe a existir por acidente: o `<iframe>` do Discover do upstream
           foi removido de propósito. */
        "frame-src 'none'",
        "object-src 'none'",
        "worker-src 'self' blob:",
        /* `base-uri` é o furo que quase todo mundo esquece: um `<base>`
           injetado reescreve o destino de TODO caminho relativo da página. */
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ");

      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: politica },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

/**
 * Serve `brand/mark.svg` como `/mark.svg`, em dev e no build.
 *
 * `brand/` fica fora da raiz desta ilha. As saídas
 * óbvias seriam copiar o arquivo para `public/` ou abrir `server.fs.allow`
 * para fora da raiz; a primeira cria uma cópia que deriva da fonte, e o
 * arquivo de marca JÁ carrega esse risco entre as três peças. Não vale
 * adicionar uma quarta.
 *
 * Lendo direto da fonte, trocar a marca é trocar um arquivo.
 */
function marcaDoVortex(): Plugin {
  const origem = fileURLToPath(new URL("../../../brand/mark.svg", import.meta.url));

  return {
    name: "vortex-marca",

    configureServer(server) {
      server.middlewares.use("/mark.svg", (_req, res) => {
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "no-cache");
        res.end(readFileSync(origem));
      });
    },

    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "mark.svg",
        source: readFileSync(origem),
      });
    },
  };
}

/*
  A versão, para a tela de Avançado.

  ⚠ Lida do `package.json` em tempo de BUILD e injetada como constante. A
  alternativa — importar o `package.json` no cliente — arrastaria dependências
  e scripts para o bundle por causa de uma string, e o `resolveJsonModule` do
  TypeScript tipa o arquivo inteiro.
*/
const VERSAO: string =
  (
    JSON.parse(
      readFileSync(new URL("./package.json", import.meta.url), "utf8"),
    ) as { version?: string }
  ).version ?? "0.0.0";

export default defineConfig({
  define: {
    __VERSAO__: JSON.stringify(VERSAO),
  },

  /*
    A porta vem do AMBIENTE, com o default do Vite como reserva.

    O `launch.json` fixava `--port 5173 --strictPort`, e a porta ficou presa
    num processo órfão — o servidor de desenvolvimento passou a não subir, com
    uma mensagem sobre conflito de porta em vez de sobre o app. Nada aqui
    precisa de 5173 em particular: este é um SPA que fala PARA um backend, não
    um destino de callback de OAuth nem de webhook, então ninguém de fora
    conhece o número.

    `undefined` e não um número quando `PORT` não existe: assim o Vite escolhe,
    e a configuração não reintroduz o valor fixo que causou o problema.
  */
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },

  plugins: [
    // Regra do projeto: React Compiler ativo desde o dia 1. Uma das duas
    // perguntas do spike é se ele convive com o TanStack Virtual — desligar
    // aqui esvazia o spike.
    react({ compiler: true }),
    tailwindcss(),
    marcaDoVortex(),
    cspDoVortex(),
  ],

  ssr: {
    resolve: {
      /**
       * O `solid-js` do TESTE precisa ser o de navegador, não o de servidor.
       *
       * Em Node, `solid-js` resolve para `dist/server.js` — o build de SSR,
       * onde **`createEffect` é no-op por design**. Medido: um efeito sobre um
       * `createSignal` simples não roda nem uma vez. Sem isto, metade da ponte
       * `stoat.js → React` — a metade REATIVA, que é a razão de o adapter
       * existir — nunca esteve sob teste e silenciosamente não podia estar.
       *
       * Não dá para arrumar no `resolve.conditions` do topo: aquilo vale para
       * o build de produção também, e trocar as condições lá derrubaria a
       * condição `production`. O `ssr.resolve.conditions` atinge só o pipeline
       * que o Vitest usa.
       *
       * ⚠ **Tentei duas vezes trocar isto por algo mais estreito, e as duas
       * falharam de um jeito que vale registrar** — as duas passariam por
       * "mais limpo" numa revisão de código:
       *
       * 1. `environment: "jsdom"`. Com ambiente de navegador o Vitest troca o
       *    pipeline de transformação, ESTAS CONDIÇÕES DEIXAM DE VALER, e o
       *    `solid-js` volta a ser o de servidor. Quatro suítes de efeito
       *    (`fixadas`, `reacoes`, `reconciliacao`, `voz`) passaram a falhar: o
       *    conserto desfazia em silêncio o conserto que devia preservar.
       * 2. Alias nominal do `solid-js` no `test.alias`. O Vitest EXTERNALIZA
       *    dependências de `node_modules`, então o Node as resolve por conta
       *    própria e o alias nem é consultado.
       *
       * A condição é ampla porque a resolução é ampla. O preço dela está logo
       * abaixo, em `setupFiles`.
       */
      conditions: ["browser", "development"],
    },
  },

  test: {
    /**
     * Um `document` para quem resolve como navegador e roda em Node.
     *
     * É o preço da condição acima, e ele só apareceu quando o markdown entrou:
     * o `decode-named-character-reference`, que o micromark usa para
     * decodificar entidades, tem uma build de navegador que toca `document` no
     * ESCOPO DO MÓDULO. Como `sdk/map.ts` passou a importar o analisador,
     * quinze suítes que nada têm com markdown quebravam todas no mesmo
     * `import`.
     */
    setupFiles: ["./src/testes/documento.ts"],
  },
});
