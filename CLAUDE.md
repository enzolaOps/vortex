# Vortex

Cliente de chat em tempo real, fork do Stoat (ex-Revolt). App denso, dark-first,
aberto o dia inteiro: legibilidade e baixo ruído ganham de impacto. Web e
Electron compartilham 100% da interface. O Vortex diverge do Stoat como
**produto**, mas continua falando o protocolo Stoat.

Este arquivo é curto de propósito. O porquê de cada decisão, o PRD, o design e
a segurança estão em `docs/reescrita/` — leia lá, não aqui. O histórico de fases
e pendências está no git.

## Monorepo

```text
client/                  pnpm workspace (lockfile próprio)
  packages/app/          a interface (React 19, Vite, Tailwind v4, Radix, Lucide)
  packages/nucleo/       lógica sem UI: sdk/ (adapter), store/, markdown/, rota/, som/, tema/cor, arnes/
  packages/stoat.js/     SDK do protocolo (submodule). Precisa de `pnpm build` antes de tudo
server/                  backend Rust (fork do stoatchat). Só `delta` (API) e `bonfire` (events) são publicados
brand/                   marca (vortex-simbolo, -cor, logotipo, icone-app) e `generate.mjs`, que gera os ícones do desktop
desktop/                 casca Electron, produto. Carrega o app por URL (`VORTEX_APP_URL`). Lockfile próprio. Não mora em `client/`
vendor/stoat-web/        upstream Solid: SÓ referência. Nunca construído. `scripts/ci/fronteiras.sh` reprova o contrário
docs/reescrita/          decisões, PRD, brief de design, TRD, segurança
```

- `app` consome `nucleo` como fonte TS. `stoat.js` só pode ser importado dentro
  de `nucleo/src/sdk/` (lint de boundary): o SDK é transporte, não fundação.
  Tipos de domínio são declarados pelo app, nunca derivados dos do SDK.
  `@radix-ui/*` só em `app/src/ui/primitivos/` e ícones só via `app/src/ui/icones.tsx` (lint).
- Comandos, a partir de `client/`: `pnpm run check` (build do stoat.js, depois
  typecheck, lint, guardas, testes e build de `nucleo` e `app`). Por pacote:
  `pnpm --filter app <script>`.

## As leis

Colidiu com uma, pare e levante a questão em vez de contornar.

1. **Estado fora do React, com subscrição por entidade.** Store module-level +
   `useSyncExternalStore` keyed por ID; nunca dado de entidade em Context.
   Update não-escopado que atinge milhares de linhas é o que mata o app, não o
   custo de render. `getSnapshot` devolve referência cacheada (sem `.map`,
   `.filter` ou spread dentro dele). Estado efêmero (typing, presença, quem
   fala) vai em store separado com throttle na fronteira do adapter.
2. **Virtualização desde a primeira linha** (TanStack Virtual). Retrofit é
   reescrita da tela.
3. **`minmax(0, 1fr)` no grid e teto de largura na coluna de mensagem.** `1fr`
   sozinho respeita o `min-content` e uma URL longa estoura o layout.
4. **Zero valor mágico em componente.** Só tokens semânticos (CSS custom
   properties, camada que o tema de usuário sobrescreve); arbitrary values são
   proibidos por lint.
5. **Biblioteca para o genérico, código seu para o específico.** Radix para
   primitivos, Lucide para ícones, `livekit-client` para transporte de voz.

A antiga lei nº 6 ("todo componente nasce movível", para o layout de slots
reorganizável) caiu com a reescrita: layout customizável está fora do produto
(`docs/reescrita/02-prd.md`, não-objetivos). Container query continua sendo o
jeito certo de um componente reagir ao próprio espaço.

React Compiler está ativo: escreva código idiomático, meça antes de otimizar,
e trate erro de lint do compiler como código errado, não como regra a desligar.

## Os cinco erros silenciosos

Nenhum dá erro; todos degradam em silêncio.

1. `getSnapshot` alocando objeto novo: loop de render, aba travando.
2. Dado de entidade em Context: jank em servidor grande, invisível em dev.
3. `minmax(0, 1fr)` faltando: grid estoura com URL longa.
4. Markdown reparseado no render: lento só quando a presença começa a piscar.
5. Listener sem cleanup: vazamento que aparece na sexta hora de sessão.

## Gate do firehose

500 eventos/s de presença/mensagem/typing/reação contra o store, com 10k
mensagens carregadas, segurando 60fps. **Rode antes de qualquer merge que
toque store, lista de mensagens, linha de mensagem ou o container delas.**

```bash
cd client
pnpm --filter app build:gate      # bundle COM o arnês
pnpm --filter app gate:servir     # vite preview em :4174 (outro terminal)
pnpm --filter app gate [url] [throttle]
```

- O gate mede o que estiver **servido**: sem `build:gate` antes, ele aprova o
  bundle anterior.
- Saída: 0 = PASS, 1 = FAIL, 2 = **corrida inválida** (nem aprova nem reprova).
  Vazão do gerador abaixo de **90%** da carga pedida invalida a corrida; com
  jogo ou apps pesados abertos isso é comum. Rode com a máquina limpa, mediana
  de 3 janelas. Veredito por frames perdidos (equivale a p95 ≤ 16,7 ms); os tetos
  estão em `docs/reescrita/04-arquitetura-trd.md`.
- Headless mede JS, layout e escopo de update, não rasterização. Não rode em
  painel de navegador oculto: sem `requestAnimationFrame` o relatório sai vazio.
- Em runner do GitHub a vazão não passa de 90%; o gate é local, com o relatório
  colado no PR.

## Deploy

1. Publicar uma GitHub Release `v*` (corpo vazio; notas vêm dos commits
   convencionais).
2. Os workflows `vortex-client-image` e `vortex-server-image` constroem o que
   mudou desde a tag anterior e publicam no GHCR (`vortex-client`,
   `vortex-server`); `vortex-desktop` empacota a casca e anexa à release.
3. Cada build manda `repository_dispatch` ao `pi-infra` (privado), que abre/atualiza
   o PR `deploy/application-images`. **Merge desse PR = deploy.** A compose do
   servidor usa `VORTEX_SERVER_IMAGE` (a imagem do fork, não a upstream).
4. Só `delta` e `bonfire` são publicados; os demais serviços ficam nas imagens
   upstream. Não republique serviço que não mudou.

Feature que o protocolo não suporta exige mexer em `server/`; enquanto o
backend for upstream, o front-end não precisa de endpoint novo. Endpoint novo
entra no adapter (`nucleo/src/sdk/`), nunca em componente.

## Restrição linux/arm64

O alvo de produção é um Raspberry Pi: tudo roda em `linux/arm64`. A imagem do
cliente é JS e roda em `--platform=$BUILDPLATFORM`; o Rust do servidor é
cross-compilado em runner amd64 (matriz, uma arquitetura por runner, e
`CARGO_PACKAGES` restrito a API e events). Nunca assuma amd64 num Dockerfile.

## Como trabalhar

- Antes de codar, em até 10 linhas: superfície, arquivos que vai abrir e por
  quê, tokens/componentes reutilizados, comportamento por breakpoint, menor
  patch possível. Passos pequenos e verificáveis; padrão existente preservado;
  dependência nova precisa de justificativa; problema fora do escopo vira
  pendência listada, não correção silenciosa.
- Regra executável vale mais que prosa: invariante crítica vira lint, tipo,
  teste ou assertion. Guarda que passa de primeira precisa de mutação para
  provar que enxerga o defeito.
- Medição vale mais que suposição, e instrumento desligado (build velho, painel
  oculto, dev server em vez de produção) reprova o ambiente e culpa o código.
- Interface construída 1:1 com o design (`docs/reescrita/03-brief-de-design.md`).
- Textos de interface em português, sem jargão (há teste de catálogo).
