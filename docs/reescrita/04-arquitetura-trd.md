# Vortex v1 — arquitetura e TRD da reescrita da interface

> Fontes: `00-decisoes.md`, `01-inventario-da-logica.md`, `02-prd.md`,
> `03-brief-de-design.md` e o design system v1 (tokens, receita de vidro, 12
> componentes). Nada aqui reabre decisão desses documentos. Fatos do
> repositório foram conferidos em 2026-10-07 na branch
> `integracao/desktop-voz`. O que não está decidido está na §12.

## 1. Visão geral

Três pacotes de produto no workspace `client/`, mais a casca Electron, que não
muda de lugar:

```
                 ┌──────────────────────────── client/packages/ ───────────────────────────┐
                 │                                                                          │
 Electron 44     │   app (NOVO)                         client (ATUAL, congelado)           │
 vendor/stoat-   │   interface v1: shell, jornadas,     interface velha; só muda import     │
 desktop/        │   design system, catálogo de texto   no PR de extração; sai no cutover   │
 carrega a URL ──┼──►      │                                      │                          │
 (VORTEX_APP_URL)│         └──────────────┬───────────────────────┘                          │
 preload: ponte  │                        ▼  (só UI → núcleo)                                │
 IPC enumerada   │   nucleo (NOVO, extraído)                                                 │
                 │   sdk/ · store/ · lib/ · markdown/ · tema/ · notificacao/ · rota/ · som/  │
                 │   preset/ · arnes/ (firehose, frames, stats)                              │
                 │                        │  (só nucleo/src/sdk/ importa)                    │
                 │                        ▼                                                  │
                 │   stoat.js (gitlink → stoatchat/javascript-client-sdk @ 30b8505)          │
                 └──────────────────────────────────────────────────────────────────────────┘
                                          │ HTTP + WebSocket          │ WebRTC
                                          ▼                           ▼
                           server/: delta (api) · bonfire (events)   LiveKit
```

**Regras de direção (todas com lint, não com prosa):**

| Regra | Mecanismo |
| --- | --- |
| UI depende do núcleo; o núcleo nunca importa de `app` nem de `client` | `nucleo` não declara os dois em `package.json`; com `nodeLinker: isolated` (já no `pnpm-workspace.yaml`) o import nem resolve |
| `stoat.js` e `solid-js` só dentro de `nucleo/src/sdk/` | `no-restricted-imports` copiado da regra atual (`eslint.config.mjs`, bloco "A fronteira do SDK"), agora nos três pacotes |
| `@radix-ui/*` só em `app/src/ui/primitivos/` | mesma regra que hoje confina Radix a `components/ui/` |
| Ícones só via `app/src/ui/icones.tsx` | regra de grupo de pacote, como hoje para `@remixicon/*` |
| `react` no núcleo só em `store/hooks.ts` e nos arquivos de hook listados | `react` como `peerDependency` do núcleo + lint por arquivo |
| Texto visível só no catálogo (`app/src/textos/`) | teste de jargão + lint contra literal de string em JSX fora do catálogo |

A casca (`vendor/stoat-desktop`, Electron 44, `contextIsolation: true`,
`nodeIntegration: false`, preload `ponteDoVortex`) carrega uma URL remota
(`src/native/enderecoDoApp.ts`, `VORTEX_APP_URL` ou `--force-server`). Ela não
importa código do cliente; continua sendo casca fina. A interface nova roda
nela trocando só a URL apontada (no cutover, a mesma URL passa a servir o
`app`).

## 2. Pacotes e estrutura de pastas

**Nomes.** A convenção do workspace é nome curto sem escopo (`client`,
`stoat.js`). Propostas: `client/packages/nucleo` (nome `nucleo`) e
`client/packages/app` (nome `app`). Português como o resto do código; sem
escopo porque nada é publicado.

**`nucleo/`** — a pasta `src/` atual menos as pastas de interface, sem mudar a
estrutura interna (o diff do PR de extração precisa ser um `git mv`):

```
nucleo/src/
  sdk/          55 arquivos, ~21k linhas, 58 testes (adapter, chamada, motorDeVoz…)
  store/        63 arquivos, 24 testes (+ hooks.ts: a superfície React)
  lib/ markdown/ tema/ notificacao/ rota/ som/ preset/
  ui-logica/    toastStore, filtros (busca), processamento + ruidoForte (voz),
                modelo (overlay), tomDePele (seletores)
  arnes/        firehose, frames, stats, rede, prepend, arnesAtivo (só dev)
  testes/       documento.ts (setup atual)
  index.ts      sem barrel gigante: exports por subcaminho (ver §4)
```

**`app/`** — organizado por jornada, não por tipo de arquivo. Layout fixo
(lei 6 caiu), então não há slots nem registro de painéis:

```
app/src/
  main.tsx  App.tsx  rotas.tsx          entrada, portão de sessão, rotas
  shell/          barra de título, dock de servidores, coluna de salas,
                  gaveta de membros, área principal, fundo de vidro
  jornadas/
    sessao/       4.1  entrar, MFA, criar conta, recuperar, QR
    salas/        4.2  visão das salas, sala expandida, lista lateral
    palco/        4.3  palco, miniaturas, grade, cápsula, PiP, destacar
    chat/         4.4  lista virtualizada, linha, composer, anexos
    casa/         4.5  DMs, grupos, amigos, chamada recebida
    config/       4.6  perfil, conta, dispositivos, voz e vídeo, aparência
    admin/        4.7  servidor, canais, convites, cargos, moderação
  ui/
    primitivos/   wrappers Radix (dialog, menus, popover, tooltip, toast, hover card)
    ds/           os 12 componentes do design system
    icones.tsx    ponto único de ícone
  tema/
    tokens.gerado.css   gerado de tokens.json (não editar)
    temas/vidro.css     um arquivo por tema nomeado
    theme.css           @theme do Tailwind apontando para as vars
  textos/         catálogo pt-BR, por jornada; teste de jargão
  arnes/          rota /dev com o contrato do gate (ver §8)
  e2e/            Playwright por jornada
```

**Temas.** `tokens.json` do design system é a fonte. Um script
(`app/scripts/tokens.mjs`) gera `tokens.gerado.css` com as variáveis
`--vx-*` da camada 1 sob `:root[data-tema="vidro"]`; cada tema novo é um
arquivo em `temas/` com o mesmo conjunto de papéis. A paleta personalizada é
um tema derivado em runtime pelo `nucleo/tema/derivar.ts` (que já existe) e
aplicado como variáveis no mesmo seletor. Um teste lê todos os temas
(estáticos e uma varredura da paleta personalizada) e roda a tabela de pares
do design system — com composição de translúcido sobre `backdrop-base` e os
três campos de cor, como o `contraste.mjs` do DS faz. **Sem lista de
exceções:** a `EXCECOES` do app atual não é portada. O teste também confere
que todo papel do DS existe em todo tema e que nenhum tema tem papel a mais.

## 3. Primeiro PR: extração do núcleo

Objetivo: mover a lógica sem mudar comportamento. O app atual continua
idêntico e é a prova.

**Passos:**

1. Criar `client/packages/nucleo` com `package.json` (`stoat.js:
   workspace:^`, `solid-js`, `livekit-client`, `@livekit/track-processors`,
   `@sapphi-red/web-noise-suppressor`, `unified`/`remark-*`, `shiki`, `ulid`;
   `react` como peer), `tsconfig.json` e `vitest.config.ts` com o
   `ssr.resolve.conditions: ["browser", "development"]` e o
   `setupFiles: ["./src/testes/documento.ts"]` copiados do `vite.config.ts`
   atual — **sem** `environment: "jsdom"`, que já foi tentado e desliga a
   condição (o Solid volta ao build de servidor e `createEffect` vira no-op).
2. `git mv` de `sdk/ store/ lib/ markdown/ tema/ notificacao/ rota/ som/
   preset/ testes/` para `nucleo/src/`.
3. `git mv` dos arquivos de lógica em pastas de interface. Os cinco nomeados
   em `00-decisoes.md` mais três que o grafo de imports obriga (o núcleo os
   importa hoje, então sem eles a direção da dependência fica invertida):

   | Arquivo | Quem importa no núcleo |
   | --- | --- |
   | `components/ui/toastStore.ts` (+ teste) | 89 chamadas `toast(` em `sdk/`, `store/`, `lib/`, `notificacao/` |
   | `voz/processamento.ts` (+ teste), `voz/ruidoForte.ts` | `sdk/motorDeVoz.ts` |
   | `busca/filtros.ts` (+ teste) | `sdk/busca.ts`, `store/busca.ts` |
   | `overlay/modelo.ts` (+ teste) | `store/overlay.ts` |
   | `seletores/tomDePele.ts` (+ teste) | `store/tomDePele.ts` |
   | `dev/stats.ts` | `sdk/adapter.ts` |
   | `dev/arnesAtivo.ts` | `sdk/enquetes.ts`, `sdk/eventos.ts`, `notificacao/notificador.ts` |
   | `dev/firehose.ts`, `frames.ts` (+ teste), `rede.ts`, `prepend.ts` | ninguém no núcleo, mas o arnês do app novo precisa deles (§8) |

   Outros `.ts` puros em pastas de interface (`composer/mencao.ts`, `wav.ts`,
   `gravacaoDeVoz.ts`, `paleta/indice.ts`, `forum/*`, `expressoes/*`,
   `eventos/lembretes.ts`, `sessao/forcaDaSenha.ts`, `voz/fundoDeVideo.ts`,
   `voz/atividades/*`) **não** entram no primeiro PR: migram quando a jornada
   que os usa chegar. Isso mantém o PR mecânico.
   `lib/cn.ts` é de interface (`tailwind-merge`) e fica no `client`.
4. No `client`: dependência `nucleo: workspace:^` e reescrita de import
   (`../sdk/adapter` → `nucleo/sdk/adapter`), feita por script com `exports`
   por subcaminho no `package.json` do núcleo. Nenhuma outra mudança.
5. Lint de fronteira replicado nos dois pacotes; `client/package.json` (raiz)
   ganha `build:deps` incluindo o núcleo.

**Verificação (critério de merge):**

- Os 121 arquivos de teste passam, com a mesma contagem de testes (1.237 hoje)
  — o script compara o relatório do Vitest antes e depois.
- `pnpm --filter client check` inteiro verde (typecheck, lint, as nove
  guardas, build).
- Bundle de produção do `client` dentro de ±1% do anterior, e o chunk do
  LiveKit continua separado (o `await import()` de `motorDeVoz` não pode virar
  estático).
- Gate do firehose: A/B no mesmo ambiente, mediana de 3, sem diferença fora do
  espalhamento (o arnês do `/dev` continua no `client` nesse PR).
- O app sobe contra o back-end local e faz login, entra numa sala e manda
  mensagem.

**Riscos:** (a) a condição de resolução do Solid se perder no novo
`vitest.config.ts` — testes reativos (`voz`, `fixadas`, `reacoes`,
`reconciliacao`) são o detector; (b) estado module-level duplicado se o
`client` resolver o núcleo por dois caminhos (fonte e `dist`) — o núcleo é
consumido **só como fonte TS** via `exports`, sem build próprio; (c) o
`Dockerfile` do cliente copia `client/packages/` inteiro, então continua
funcionando, mas o job de imagem precisa ser rodado no PR.

## 4. Camada de estado e a ponte

A arquitetura das leis 1–5 vale inteira (a lei 6 caiu com o layout fixo):

```
stoat.js (signals Solid) → adapter (nucleo/sdk) → stores module-level
  (Map<id, snapshot> + emissor por id) → useSyncExternalStore → componentes
```

**O que o `app` consome:** apenas
- hooks de `nucleo/store/hooks` (hoje 37: `useMessage`,
  `useChannelMessageIds`, `usePresence`, `useTyping`, `useServer`,
  `useCanaisDeVoz`, `useVozDoCanal`, `useMembrosOnline`, `useConversas`,
  `usePessoa`, `useLocal`…), cada um keyed por ID;
- comandos de `nucleo/sdk/*` (funções assíncronas: `entrarNaChamada`,
  `enviarMensagem`, `pedirAmizade`…), que devolvem resultado tipado;
- tipos de domínio de `nucleo/sdk/domain.ts`.

Hooks novos da reescrita moram no núcleo, com o mesmo padrão: coleção assina
lista de IDs, entidade assina a si mesma, `getSnapshot` devolve referência
cacheada (`assertStable` em dev continua). Estado efêmero (fala, digitando)
segue em `createEphemeralStore` com throttle na fronteira.

**Continua proibido:** dado de entidade em Context; montar objeto dentro de
`getSnapshot`; importar `stoat.js`/`solid-js` fora de `nucleo/src/sdk/`;
derivar tipo de domínio do SDK; ordenar ou varrer coleção por evento quando a
ordem só é observável ao abrir a tela; Radix por linha de lista (o menu de
contexto fica no nível da lista, com alvo no store, como hoje).

**Texto na lógica.** As 89 chamadas `toast(...)` do núcleo carregam frases em
português. Isso fura o "todo texto num lugar". Decisão: o núcleo passa a
emitir **avisos tipados** (`{ tipo: "falhaAoEntrarNaChamada", motivo }`) e o
`app` traduz pelo catálogo. A migração é por jornada, quando o arquivo for
tocado; o teste de jargão roda também sobre as strings literais restantes do
núcleo até elas acabarem.

**Stores que morrem no cutover:** `store/layout.ts`, `store/drawer.ts`,
`store/edicao.ts` e `preset/` existem para o layout customizável. O `app` não
os importa (lint), e eles saem junto com o `client`.

## 5. Voz e tela

**Motor.** Reaproveitado sem reescrita: `sdk/motorDeVoz.ts` (carregado por
`await import()` — o LiveKit, ~517 kB, continua fora do carregamento inicial),
`sdk/chamada.ts`, `sdk/assinaturaDeVideo.ts`, `sdk/seletorDeTela.ts`,
`store/palcoDeVoz.ts`, `store/video.ts`, `store/volumesDeVoz.ts`,
`store/preferenciasDeVoz.ts`, `store/popout.ts`, `store/qualidadeDaTela.ts`.

**Modelo de assinatura do palco.** `autoSubscribe: false` continua. Um único
hook `useAssinaturaDeVideo(chave, { visivel, papel })` com contagem de
referências no núcleo decide a camada de simulcast:

| Onde o vídeo aparece | Assinatura |
| --- | --- |
| Foco no palco | camada alta (ou a escolhida: auto/alta/média) |
| Miniatura visível | camada baixa |
| Grade | camada média, baixa acima de 6 vídeos |
| PiP no app ou destacado | camada média |
| Fora da tela (grade rolada, miniatura escondida, aba oculta sem PiP) | desassinado |
| "Só áudio" escolhido | desassinado |

Visibilidade vem de `IntersectionObserver` + `document.visibilityState`. A
mesma `MediaStreamTrack` pode ser anexada a vários `<video>`; trocar do palco
para o PiP não reassina.

**PiP no app e "destacar".** O PiP padrão é um componente React flutuante
(`ui/ds` sobre `surface-overlay` + `elev-3`), igual na web e no desktop,
arrastável, que nunca cobre o composer. "Destacar" abre uma janela fora do app:

| Ambiente | Mecanismo | Controles próprios |
| --- | --- | --- |
| Chrome/Edge 116+ | Document Picture-in-Picture (`documentPictureInPicture.requestWindow`) com portal React para o documento da janela | sim |
| Electron | `window.open` de mesma origem, interceptado por `setWindowOpenHandler` na casca, que devolve `BrowserWindow` sem moldura com `alwaysOnTop` (mesmo nível que o overlay atual usa). A janela filha roda no mesmo processo de renderização, então o portal React e a `MediaStreamTrack` funcionam sem segunda conexão LiveKit | sim |
| Sem nenhum dos dois (Firefox) | o botão "destacar" **não é renderizado**; PiP no app continua | — |

**Recomendação:** essa abstração única (`abrirJanelaDestacada(): Window`), e
não o PiP nativo de `<video>`. O nativo só tem play/pause, não mostra quem
fala nem permite trocar de transmissão, e é um por vez. A alternativa de uma
`BrowserWindow` separada carregando uma rota `/pip` foi descartada: seria
outro processo, e assistir exigiria uma segunda participação no LiveKit. O
canal IPC novo (pedir/retirar `alwaysOnTop` da janela filha) entra na lista
enumerada do preload e é validado no main; o detalhe vai para o documento de
segurança. **Precisa de spike** (1 dia) confirmando, no Electron 44, que a
filha de `window.open` com `sandbox` continua scriptável pela página mãe.

**Eventos de voz no stoat.js (pergunta aberta nº 7 do PRD).** Fatos: os
handlers de `VoiceChannelJoin`, `VoiceChannelLeave` e `UserVoiceStateUpdate`
em `stoat.js/src/events/v1.ts` mutam `channel.voiceParticipants` e têm
`// todo: event`; `VoiceChannelMove` e `UserMoveVoiceChannel` são `// todo` e
**não fazem nada**. E o servidor não emite `VoiceChannelLeave` quando a pessoa
é movida (`voice-ingress/src/api.rs`, `participant_left`). Logo, "mover de
sala" (jornada 4.7) deixa hoje um fantasma na sala de origem, com qualquer
uma das opções que só observam o `ReactiveMap`. Além disso, o gitlink aponta
para o upstream `stoatchat/javascript-client-sdk`, não para um fork.

| Opção | Custo | Cobre mover? | Risco |
| --- | --- | --- | --- |
| A. Continuar observando o `ReactiveMap` com mais testes | baixo | não | depende de detalhe interno do SDK; mover segue quebrado |
| B. Fork do stoat.js emitindo eventos | criar e manter um fork, rebase a cada atualização | só se o fork também implementar mover | divergência permanente do SDK |
| C. **Ler o evento cru no adapter** (`client.events.on("event")`), como o adapter já faz para `can_publish`, tópicos, enquetes e a superfície Vortex | médio, tudo dentro de `nucleo/sdk/` | **sim** | nenhum novo: é o padrão existente |

**Recomendação: C.** O adapter passa a ser a fonte de `vozPorCanal`: semeia de
`Ready.voice_states`, aplica `VoiceChannelJoin/Leave/Move`,
`UserVoiceStateUpdate` e `UserMoveVoiceChannel` do payload cru, e trata todos
como idempotentes (a saída pela rota nova e o webhook do LiveKit podem gerar
dois `Leave` para a mesma pessoa). O `createEffect` sobre o `ReactiveMap`
deixa de existir. Testes: um por tipo de evento, mais a sequência
entrar → mover → sair verificada por mutação. Se um dia o upstream emitir
eventos, troca-se a fonte sem mexer em store nem componente.

## 6. Mudanças de back-end na v1

**Rota de saída de sala** (decidida em `00-decisoes.md`; ADR-002). Só o
serviço `api` (`server/crates/delta`) muda; o evento já existe.

- **Endpoint:** `POST /channels/{target}/leave_call`, ao lado de
  `routes/channels/voice_join.rs`, registrado no OpenAPI com tag `Voice`.
  Sem corpo. Autenticado; age só sobre o próprio usuário.
- **Efeito:** se o usuário não está em voz naquele canal → `204` (idempotente,
  para o cliente poder chamar sem ler estado). Se está: reaproveita
  `remove_user_from_voice_channel` (`core/database/src/voice/mod.rs`), que
  remove o participante no LiveKit (`VoiceClient::remove_user`) e apaga o
  `voice_state`; em seguida publica `EventV1::VoiceChannelLeave { id, user }`
  no canal, sem esperar o webhook.
- **Interação com o webhook:** o `participant_left` do `voice-ingress` chega
  depois, apaga de novo (no-op) e publica outro `Leave`; o cliente é
  idempotente (§5). A lógica de "sala esvaziou" (fim do toque, mensagem de
  sistema) continua no `voice-ingress`, que relê os membros. Não mudar o
  `voice-ingress` evita publicar um terceiro serviço.
- **Cliente:** `sairDaChamada` chama a rota (via `sdk/requisicaoCrua.ts`,
  porque o pacote `stoat-api` não terá o tipo até ser regenerado) e só então
  desconecta o LiveKit; falha da rota não impede a desconexão (o webhook
  continua de fallback).
- **Teste:** teste de rota em Rust (estado apagado, evento publicado, `204`
  quando ausente) e o E2E da 4.2 ("A sai e some da visão de B em ≤ 2 s").
- **Entrega:** a imagem do `delta` já é publicada multi-arquitetura pelo
  `vortex-server-image.yml`; o `pi-infra` troca a tag.

Nenhuma outra jornada da v1 exige back-end: notificações da v1 são do sistema
com o app aberto (sem push), QR usa rotas que o fork já tem, chamada em DM usa
`join_call` e o toque existentes.

## 7. Design system em código

| Camada | Onde | Como |
| --- | --- | --- |
| 1. Tokens | `app/src/tema/` | CSS custom properties `--vx-*` geradas de `tokens.json`, por tema nomeado |
| 2. `@theme` | `theme.css` | Tailwind v4 projeta utilities sobre as vars; escala default do Tailwind desligada (`--color-*: initial`, `--spacing-*: initial`), arbitrary values proibidos por lint (regras portadas) |
| 3. Componentes | `ui/ds/`, jornadas | utilities; CSS Module quando a classe passa de ~2 linhas, usa `backdrop-filter`, keyframes ou container query |

**Vidro.** A receita do DS (`surface-glass` + `blur(28px) saturate(160%)` +
`glass-border` + `shadow-glass-inner` + `elev-2`) vira uma classe única em
`PainelVidro.module.css`, com variantes `padrao/leitura/sobreposto`. Ninguém
mais escreve `backdrop-filter`: uma guarda (`pnpm superficies`, estendida)
reprova a propriedade fora desse arquivo. Custo: `backdrop-filter` em painel
grande repinta quando o que está atrás muda; o palco (`stage`) nunca tem vidro
nem fica atrás de vidro, e os campos de cor são estáticos — por isso o custo é
pago uma vez, não por frame. Medido no gate (§8), não suposto.

**Os 12 componentes** (`Botao`, `Pilula`, `Avatar`, `PilhaDeAvatares`,
`PainelVidro`, `ItemDeSala`, `Mensagem`, `Digitando`, `CampoDeMensagem`,
`WidgetDaSala`, `CapsulaDeControle`, `WidgetDaChamada`) são reescritos em
`ui/ds/` com a API de `components/index.d.ts` do DS como contrato de props —
o `bundle.js` do DS é referência visual, não código copiado. `Mensagem` é a
linha da lista virtualizada e segue as regras da linha atual (`memo`,
subcomponentes que assinam a própria entidade, altura estimada por tipo).
Menus, diálogos, popovers, tooltips, hover card e toast são wrappers Radix em
`ui/primitivos/`, vestidos com `surface-overlay`.

**Ícones: Lucide (`lucide-react`).** O DS pede um conjunto de **traço**,
`stroke-width` 1.8, grade 24, pontas redondas, `currentColor`, tamanhos
14/16/18/20. Lucide é exatamente esse modelo (traço configurável, grade 24,
`round`), tem os ícones de voz e tela necessários e importa por ícone. O
`client` usa Remix Icon (`@remixicon/react`), que é desenhado em contorno
preenchido e não aceita espessura de traço — não atende ao DS. O ponto único
(`ui/icones.tsx`) fixa `strokeWidth={1.8}` e `absoluteStrokeWidth`, aceita só
os quatro tamanhos, e o teste atual de "um dono por tamanho" é portado.

**Fontes.** Plus Jakarta Sans e JetBrains Mono **embarcadas** via
`@fontsource-variable/plus-jakarta-sans` e
`@fontsource-variable/jetbrains-mono` (o `client` já usa `@fontsource` para
JetBrains Mono). O README do DS diz "hospedada no Google Fonts", mas isso
quebraria a casca offline e a CSP atual (`font-src 'self' data:`); a família e
os pesos são os do DS, só a origem muda (registrado no ADR-006).

**Textos.** `app/src/textos/<jornada>.ts` exporta objetos tipados (funções
para plural e interpolação, usando `lib/plural.ts`). Componentes recebem texto
só daí. Testes: (1) lista de termos proibidos (nomes de token e store, "fase",
"protocolo", "adapter", "snapshot", "payload", "slot", "preset", "#undefined",
"em breve"…) sobre todo o catálogo e sobre os avisos do núcleo; (2) caixa de
frase em todo rótulo, exceto chaves marcadas `sinal` (badge e label do DS);
(3) lint contra literal de string em JSX fora de `textos/`.

## 8. Requisitos técnicos (TRD)

| Requisito | Alvo | Como se verifica |
| --- | --- | --- |
| Gate do firehose | 500 ev/s de presença, mensagem, digitação e reação, 10k mensagens carregadas; headless sob CPU 4x: frames perdidos ≤ 5% (equivale a p95 ≤ 16,7 ms); display real sem throttle: ≤ 1%; corrida com vazão < 90% é **inválida**, nem aprovada nem reprovada | `pnpm gate` contra build de produção; obrigatório em todo merge que toca store, lista, linha **ou o container da lista** |
| Bundle inicial | ≤ 1.000 kB / 300 kB gzip (o `client` está em ~1.020 / ~304) | `size-limit` no CI, falha o build |
| LiveKit e processadores de voz | fora do chunk inicial | teste que lê o manifesto do build |
| Abertura com sessão salva | shell interativo em ≤ 2 s no Electron (cache quente); sem piscar a tela de login | Playwright mede `performance.mark` |
| Memória em 10h | sem crescimento contínuo com uma chamada e uma transmissão ativas | soak automatizado de 2h (heap a cada 10 min, inclinação ≤ 5 MB/h) + sessão real do dono (métrica do PRD) |
| Teclado e foco | toda ação alcançável por teclado; um anel `focus-ring` único (2px, deslocado 2px) | axe-core em cada E2E + teste de navegador que conta anéis por elemento focado |
| Contraste | 0 pares abaixo do mínimo em todo tema, 0 exceções | teste do §2, no CI |
| Movimento | só `transform`/`opacity`, ≤ 240 ms, `prefers-reduced-motion` respeitado | guarda `pnpm movimento` portada |
| Fantasma de voz | saída refletida em ≤ 2 s | E2E da 4.2 |

**Arnês do gate no `app`.** O `scripts/gate.mjs` atual dirige o `client` em
`localhost:4174/dev` lendo texto de botão ("Semear", "Firehose 500"),
`input[type=checkbox]`, `div[role="log"]` e `span`s com o veredito. O `app`
ganha a própria rota `/dev` (fora do bundle de produção, como hoje via
`arnesAtivo`), usando o gerador de `nucleo/arnes/`. Em vez de raspar texto, o
arnês expõe `window.__vortexGate = { semear, firehose, relatorio }` e o
`gate.mjs` passa a usar essa API (e o caminho do Chrome vem de variável de
ambiente, hoje fixo no cache do puppeteer). A lista de mensagens e o arnês
nascem no marco 1 — virtualização desde a primeira linha, e o gate ativo
antes de qualquer jornada de chat.

**Matriz de suporte.**

| Ambiente | v1 |
| --- | --- |
| Electron 44 (Windows, Linux) | suportado; alvo principal; E2E da 4.3 roda aqui |
| Chrome / Edge, duas últimas estáveis | suportado; "destacar" via Document PiP |
| Firefox atual | voz, tela e chat funcionam; sem "destacar" (botão não aparece) |
| Safari, celular | fora (ver §12) |

**Segurança.** A base atual continua (CSP por `<meta>` sem `unsafe-inline` em
`script-src`, markdown sem `innerHTML`, IPC enumerado e validado no main,
navegação externa bloqueada). O próximo documento (segurança) trata o canal
IPC da janela destacada, o token em `localStorage`, e confere `sandbox` no
`webPreferences` da janela principal.

## 9. Testes e CI

**Turborepo** na raiz de `client/` (`turbo.json`), sobre o pnpm atual:

| Tarefa | Depende de | Cache | Saídas |
| --- | --- | --- | --- |
| `stoat.js#build` | — | sim | `dist/` |
| `typecheck`, `lint` | `^build` | sim | — |
| `test` | `^build` | sim (entradas: `src/**`, configs) | relatório |
| `contrast`, guardas (`escala`, `movimento`, `sombra`, `vars`, `utilities`) | — | sim | — |
| `build` | `^build` | sim | `dist/` |
| `e2e` | `build` | não | traces |
| `gate` | `build` | não | relatório |

`turbo run test --affected` no PR. Cache local + cache do diretório `.turbo`
no GitHub Actions; sem cache remoto pago.

**Vitest em projetos:**
- `nucleo`: ambiente `node` com a condição `browser` e o `document` de setup —
  exatamente o arranjo atual, que é o que mantém o caminho reativo do Solid
  testável. É onde estão os ~1.200 testes, e onde o ciclo local é rápido.
- `app`: **modo navegador** do Vitest (provider Playwright, Chromium). Testes
  de componente e as invariantes de layout que jsdom não mede (remedição após
  mudar largura, linha medindo 0 px, medida de leitura, um anel de foco,
  estados de cada tela). Não usar jsdom no `app`: importar o núcleo sob jsdom
  traz de volta o Solid de servidor.

**Playwright E2E por jornada** (`app/e2e/4.x-*.spec.ts`), contra a pilha local
do `pi-infra` (`make vortex-local-env && make vortex-local-up`, em
`http://localhost:8880`: API, events, autumn, january, LiveKit, Mongo,
Valkey, RabbitMQ, MinIO, Caddy). Duas contas criadas por API no `globalSetup`
(com verificação de e-mail desligada na configuração local). Dois contextos de
navegador = duas pessoas. Mídia falsa do Chromium
(`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`,
`--auto-select-desktop-capture-source`) para microfone, câmera e tela. A 4.3
roda também na casca via `_electron` do Playwright apontada para o build do
`app`. Cada spec cobre: o caminho da jornada, os quatro estados forçados
(rede cortada por `page.route`, permissão negada por cargo de teste), um
`acionarTodosOsControles()` que clica em tudo que é focável e exige efeito
observável, e as asserções de contexto e exclusão mútua do PRD.

No CI, o job `e2e` precisa do `pi-infra`, que é **privado**: checkout com
deploy key só-leitura. Os serviços usam as imagens publicadas; um PR que muda
o `delta` roda o E2E depois de publicar a imagem de pré-visualização.

**Definição de pronto, automatizada:** jargão (teste), contraste (teste),
controle inerte (lint `ITEM_INERTE` portado + `acionarTodosOsControles`),
quatro estados (registro `estados.ts` por tela, renderizado em modo navegador
e forçado no E2E), back-end real (E2E), gate quando aplicável. Revisão de
texto continua humana.

**Agentes, localmente:** `pnpm turbo test --filter=nucleo` (node, segundos);
`vitest --changed` dentro do pacote; `pnpm e2e -- jornadas/4.4` só da jornada
tocada, com a pilha local já de pé; build antes de qualquer `pnpm gate` (o
gate mede o que estiver servido).

## 10. Plano de execução

| Marco | Conteúdo | Critério de saída |
| --- | --- | --- |
| M0 Extração | PR do §3 | os critérios de verificação do §3 |
| M1 Fundação | Turborepo; `app` com shell fixo (barra de título, dock, coluna de salas, área principal, gaveta); tokens gerados + teste de contraste; catálogo de textos + teste de jargão; Lucide; primitivos Radix; os 12 componentes do DS; lista de mensagens virtualizada + arnês `/dev` + `gate.mjs` novo; Playwright + pilha local no CI | gate passa no `app`; E2E vazio roda no CI; shell renderiza em 1280, 1920 e 2560 sem estouro de grid |
| M2 Back-end e voz | rota `leave_call` (ADR-002); `vozPorCanal` por evento cru (ADR-003); spike da janela destacada (ADR-005). Em paralelo com M1 | teste Rust verde, imagem publicada, testes de evento verificados por mutação, spike com resposta |
| M3 Sessão mínima | entrar, restaurar, sair (parte de 4.1) | E2E entra, recarrega e continua dentro |
| M4 Salas e palco | 4.2 e 4.3, incluindo PiP e destacar | E2Es de 4.2 e 4.3 verdes, inclusive no Electron |
| M5 Chat | 4.4 (chat da sala e canal de texto) | E2E da 4.4 verde; gate verde |
| M6 Casa | 4.5, chamada em DM e notificações mínimas | E2E da 4.5 verde |
| M7 Configurações e admin | 4.6 e 4.7 | E2Es verdes |
| M8 4.1 completa | criar conta, MFA, recuperar, convite sem sessão, QR | E2E da 4.1 verde |
| M9 Cutover | imagem do cliente passa a construir `app`; dia inteiro de uso pelo dono; migração do grupo | métricas do PRD; `client` apagado no mesmo dia, com `layout`/`drawer`/`edicao`/`preset` |

**Paralelização.** Depois de M1: M4 num worktree (4.2 e 4.3 são acopladas e
ficam com um agente, em sequência), M5 noutro (só depende da lista de M1), M2
num terceiro. M6 e M7 começam quando M4 estiver no ar. Cada agente com no
máximo três tarefas e o E2E escrito junto com a tela; agente que toca a lista
ou a linha roda o gate a cada item, não no fim.

## 11. ADRs a escrever

| ADR | Decisão |
| --- | --- |
| ADR-001 Extração do núcleo | Lógica vira o pacote `nucleo`, consumido como fonte TS; o PR é só `git mv` + imports |
| ADR-002 Rota de saída de sala | `POST /channels/{id}/leave_call` no `delta`, remove no LiveKit, apaga o estado e publica `VoiceChannelLeave`; idempotente |
| ADR-003 Eventos de voz | `vozPorCanal` alimentado pelo evento cru no adapter, incluindo mover; sem fork do stoat.js |
| ADR-004 Conjunto de ícones | Lucide com traço 1.8 por um ponto único; Remix sai com o `client` |
| ADR-005 PiP e janela destacada | PiP React no app; destacar via Document PiP na web e `window.open` + `alwaysOnTop` no Electron; sem PiP nativo de `<video>` |
| ADR-006 Temas nomeados e fontes | `tokens.json` → CSS por tema, contraste sem exceções em todo tema; fontes embarcadas via `@fontsource` |
| ADR-007 Turborepo | Turborepo sobre pnpm, cache local + Actions, `--affected` no PR |
| ADR-008 Testes do `app` em modo navegador | Vitest browser mode no `app`, node com condição `browser` no `nucleo`; jsdom fora |
| ADR-009 Avisos tipados no núcleo | O núcleo emite códigos; o texto mora no catálogo do `app` |
| ADR-010 Contrato do gate | Arnês expõe `window.__vortexGate`; `gate.mjs` deixa de raspar texto |

## 12. Decisões para o dono

> **Fechadas em 2026-10-07 — todas as recomendações abaixo aprovadas**, com um
> acréscimo à nº 3: a janela por cima do jogo é **minimalista**, no espírito
> do overlay de jogo do Discord — só quem está na sala e quem fala, controles
> aparecendo ao passar o mouse, a transmissão opcional e pequena. O artboard
> `PipDestacado` foi redesenhado com essa regra.

1. **Endereço de pré-visualização antes da troca.** A troca é única, mas o
   dono precisa usar o `app` antes contra a instância real. Recomendo publicar
   o `app` num endereço separado e privado (ex.: subdomínio `novo.`) a partir
   do M4, sem anunciar ao grupo.
2. **Navegadores.** Recomendo Electron e Chrome/Edge como suportados, Firefox
   como "funciona sem destacar" e Safari fora da v1. Se alguém do grupo usa
   Safari, isso muda.
3. **Janela destacada por cima de jogo em tela cheia.** O nível
   `screen-saver` (o do overlay atual) fica por cima de jogo em tela cheia
   exclusiva, mas pode fazer alguns jogos saírem desse modo. Recomendo o
   nível normal de "sempre no topo" por padrão (funciona com jogo em janela
   sem borda) e não oferecer o outro na v1.
4. **Onde o gate roda.** Em runner do GitHub a vazão costuma ficar abaixo de
   90% e a corrida sai inválida. Recomendo manter o gate local, com o relatório
   colado no PR, e um job de CI só informativo; runner próprio (custo e
   manutenção) só se os relatórios locais virarem gargalo.
5. **Propor a rota de saída ao upstream do Stoat.** Recomendo propor depois
   da v1: se for aceita, o fork diverge menos; se não, nada muda.
