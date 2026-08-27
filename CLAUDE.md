# Vortex — briefing do projeto

> Contexto consolidado das decisões de arquitetura. Leia antes de começar
> qualquer trabalho no repositório. As regras executáveis estão na skill
> `vortex-react`; este documento explica **o porquê** por trás delas, que é o que
> impede alguém de "otimizar" uma decisão sem entender o que ela protege.

---

## O que é

**Vortex** — cliente de chat em tempo real, fork do Stoat (ex-Revolt).

App shell persistente de 4 colunas, denso, dark-first, sessões de 8h+. Não é
landing page nem dashboard. É ferramenta que fica aberta o dia inteiro:
legibilidade e baixo ruído visual ganham de impacto.

Duas plataformas, **um front-end**: web e Electron desktop compartilham 100% dos
componentes.

## Estado atual e objetivo

O upstream é Solid.js. Está sendo portado para **React**, com redesign completo
do front-end.

Três problemas concretos que motivaram o trabalho:

1. Design pobre e inconsistente
2. Layout quebra em ultrawide — texto esticando até 3000px
3. Ausência de sistema de tokens; valores hardcoded espalhados

---

## Stack do upstream — confirmado

Levantado de `web/packages/client`. Inventário do que vai ser substituído — e,
mais útil, do que não precisa ser.

### Os problemas 1 e 3 têm a mesma causa

O upstream usa **Panda CSS** (`jsxFramework: "solid"`). Mas o `panda.config.ts`
**não define token nenhum**: o `theme.extend` contém só `keyframes`.

Quem faz papel de token é o **Material Design 3**, via três dependências
sobrepostas — `@material/material-color-utilities` (gera `--md-sys-color-*` em
runtime), `@material/web` e `mdui` (duas implementações de Material no mesmo
app). Os componentes consomem `var(--md-sys-color-primary-container)` direto.

A paleta não é escolhida, é **derivada em runtime por um algoritmo**. Não há
identidade a inconsistir — há Material Design genérico parafusado num cliente de
chat. E o problema 3 é literal: os tokens não existem na camada de estilo.

Consequência: essa camada não é migrada, é **descartada**. `tokens.css` não é
refinamento do que existe — é a primeira vez que o projeto tem tokens.

### O que atravessa sem reescrita

Conferir antes de reimplementar qualquer um destes. São agnósticos de framework
e custam um wrapper:

- **Composer:** ProseMirror (10 pacotes) + CodeMirror 6 (6)
- **Markdown:** pipeline `unified` (remark/rehype), `shiki`/`lowlight`, `katex`
- **SDK:** `stoat.js`, atrás do adapter

É a maior economia escondida do port, e some do orçamento se alguém começar a
reescrever composer e markdown por reflexo.

### O que não atravessa

Panda, `@material/web`, `mdui`, `material-color-utilities`,
`@minht11/solid-virtual-container`, `@tanstack/solid-query` (troca 1:1 pelo
`react-query`) e os **quatro** sets de ícone que convivem hoje:
`@material-design-icons/svg`, `@material-symbols/svg-400`, `material-symbols` e
`solid-icons`. Misturar sets de ícone é dívida herdada aqui, não risco
hipotético.

Os 23 pacotes `@fontsource/*` são fontes escolhíveis pelo usuário, não a
identidade do produto — decisão independente do par tipográfico do Vortex.

### Submodules

Três no upstream, todos em `web/packages/`:

| Path | Upstream | Atravessa? |
|---|---|---|
| `stoat.js` | `stoatchat/javascript-client-sdk` | **Sim — é o SDK** |
| `solid-livekit-components` | `revoltchat/solid-livekit-components` | Não → `@livekit/components-react` |
| `js-lingui-solid` | `revoltchat/js-lingui-solid` | Não → `@lingui/react` |

Dois dos três existem só para adaptar bibliotecas ao Solid. O port os elimina,
trocando por pacotes oficiais e mantidos — o fork sai do port com **menos**
superfície de manutenção do que tem hoje. É argumento a favor que não estava na
lista original.

`stoat.js` fica, e **mantém reatividade Solid internamente**. Isso não é problema
a resolver, é a premissa da ponte. Encapsular no adapter, nunca remover.

**Existe agora um quarto gitlink:** `web-react/packages/stoat.js`, mesmo upstream
e mesmo commit que o de `web/`. Cada ilha carrega o próprio SDK — cruzar a
fronteira quebraria o lockfile independente. Os dois precisam subir de versão
juntos, e um check em CI falha se divergirem. Ver `enforcement.md` e o README da
ilha.

### Onde o código está

```text
web/packages/client/
├── src/                 entrada, Auth, Interface, LoadingScreen
├── components/          app · auth · client · common · i18n · keybinds
│                        markdown · modal · routing · rtc · state · ui
├── panda.config.ts      descartado no port
└── vite.config.ts
```

`components/state/` e `components/client/` são leitura obrigatória antes do
spike: é onde a reatividade Solid encosta na UI, e portanto o que o adapter
substitui.

---

## Decisões tomadas (e por quê)

### Portar Solid → React

Avaliado a fundo, não assumido. O argumento contra era forte: `stoat.js` tem
reatividade nativa Solid embutida nos objetos do modelo, e o upstream continuaria
mergeável.

Decidido a favor porque: (a) o dev domina React, (b) haverá divergência pesada do
upstream de qualquer forma, então merge tinha valor baixo, (c) ferramental de
profiling do React é muito superior, (d) assistentes de código produzem React
significativamente melhor que Solid.

**O que isso custa e onde pode dar errado:** a ponte `stoat.js` → React é a única
peça capaz de arruinar a decisão. Ver abaixo.

### Radix, não Base UI

O shadcn passou a usar Base UI por padrão em projeto novo. Aqui, não.

Base UI ainda não tem **Context Menu, Hover Card e Toast** — exatamente os três
primitivos que um cliente de chat mais usa. Seguir o default significaria
escrever as três peças mais difíceis à mão.

Reavaliar quando Base UI cobrir os três; a migração é progressiva.

### TanStack Virtual, modo chat

Lista de chat inverte o contrato da virtualização normal. O TanStack Virtual
passou a cobrir essa física diretamente: `anchorTo: 'end'`, `followOnAppend`,
`scrollEndThreshold`, em ordem e container normais.

⚠️ **Pendência aberta:** houve relato de incompatibilidade com o React Compiler,
que é regra do projeto. **Confirmar no spike.** Se conflitar, a alternativa é
`react-virtuoso`.

### React Compiler ativo desde o dia 1

Memoização automática em build. Consequência prática: **pare de otimizar
preventivamente** — escreva código idiomático, meça, intervenha onde o profiler
apontar. Em troca, siga as Rules of React. Lint do compiler reclamando = código
errado, não regra pra desativar.

### Divergência de produto — e o que ela implica no backend

**Decidido:** o Vortex diverge do Stoat como **produto**, continuando a falar o
protocolo Stoat. Não é um cliente Stoat reestilizado, e não é um protocolo novo.

Consequência direta: feature que o protocolo não suporta exige mexer no backend.
Isso não é hipótese remota — é o caminho previsto.

#### O que o backend é hoje

Oito serviços upstream, todos pinados por digest em `v0.15.1`
(`pi-infra/compose/compose.vortex.yml`):

```
api · events · file-server · proxy · crond · pushd · voice-ingress · livekit
```

mais Mongo, Valkey, RabbitMQ, MinIO e Caddy. A única imagem própria hoje é a do
cliente web (`ghcr.io/enzolaops/vortex-web`).

**Não é um monolito.** O VORTEX.md descreve um eventual `server/` como ilha
única, cargo em vez de pnpm. A stack real é outra coisa, e isso é boa notícia:
forkar significa forkar **o serviço dono daquela superfície** e continuar pinando
os outros. Feature de API → `api`. Evento novo no websocket → `events`, quase
sempre com `api` junto. É bem menor que "forkar o backend", e mantém as
atualizações de segurança dos outros serviços vindo de graça.

#### Não construir agora

O VORTEX.md já diz: *"do not create it for tidiness"*. Vale literalmente. **Todo
o roadmap — fases 0 a 4 — é front-end.** Nada nele precisa de backend, inclusive
a fase 4: preset é string que o usuário copia, tema é CSS custom property,
layout vive em store local.

Manter o backend como está não é dívida, é a escolha barata: oito serviços
pinados por digest, correção de segurança de upstream chegando de graça, nada
para construir e nada para manter. O fork é o caminho para **quando** uma
feature forçar — não um item de roadmap.

#### A restrição a conhecer antes de commitar com uma feature de backend

**Tudo roda em `linux/arm64`** — o alvo é um Raspberry Pi, e repositório privado
não recebe runner arm64 nativo.

O cliente web já contorna isso, e o truque está documentado no VORTEX.md: o
Dockerfile pina o estágio de build em `$BUILDPLATFORM` porque esse estágio *"only
emits static JS and CSS, which is the same on every architecture"*. Roda nativo
no runner amd64 e só o runtime, JS puro, é emulado.

**Esse truque não transfere para Rust.** Binário Rust é específico de
arquitetura — não existe estágio neutro para rodar nativo. Sobra cross-compile,
runner próprio ou build no próprio Pi.

Não bloqueia nada hoje. Só não descubra isso no meio da primeira feature de
backend.

#### Por que isso não muda o front-end

Enquanto o backend for upstream não modificado, `stoat.js` continua sendo o
transporte certo — e quando um serviço for forkado, continua sendo, porque o
protocolo é o mesmo com superfície a mais.

A camada anticorrupção em `src/sdk/` é o que faz esse fork seletivo caber depois
sem tocar em componente: endpoint novo entra no adapter, o tipo de domínio já
existe. É exatamente o cenário para o qual ela foi instalada.

### Estilização: Tailwind v4 sobre tokens em CSS puro

A restrição que decidiu: o Stoat suporta **temas de usuário**, trocados em
runtime sem rebuild. Isso eliminou build-time (vanilla-extract, Panda — exigiriam
machinery extra) e runtime JS (styled-components, Emotion — pagam custo por
render, inaceitável na lista virtualizada).

CSS custom properties são a única resposta natural, e o Tailwind v4 é construído
em torno delas.

Arquitetura em três camadas:

```
1. tokens.css        CSS custom properties puras ← tema de usuário sobrescreve aqui
2. @theme            mapeia utilities → as vars da camada 1
3. componentes       utilities; CSS Module onde utility fica ruim
```

**Os tokens não moram no Tailwind.** Ele só projeta utilities em cima. Assim o
tema de usuário nem precisa saber que o Tailwind existe, e trocar de ferramenta
de estilo no futuro não toca a camada cara.

Três regras com lint bloqueando: arbitrary values proibidos; escala de cor
default do Tailwind desativada; espaçamento e raio limitados às escalas do
projeto.

CSS Module quando a `className` passa de ~2 linhas ou exigiria arbitrary value —
grid do shell, container queries densas, keyframes.

### Layout customizável pelo usuário (fase 4, decidido agora)

O cliente terá layout reorganizável, tema escolhível e preset compartilhável.
Demanda comprovada — o BetterDiscord existe porque milhões de pessoas instalam
um mod de cliente só para ter tema e layout.

**Modelo: slots com docking, não posição livre.** Uma HUD de jogo é feita de
widgets independentes; um cliente de chat é um shell de restrições acopladas —
largura da coluna depende das sidebars, composer alinha a ela, virtualização
exige container estável. Drag-anywhere quebra os três.

Coluna de mensagem + composer é **âncora fixa**. Os painéis laterais são slots
que o usuário reordena, troca de lado, redimensiona, esconde e preenche. Slot
vazio colapsa — o que resolve de quebra o aproveitamento de ultrawide.

**Tema: picker no nível do token, nunca do componente.** Cor por componente
destruiria o sistema de tokens, tornaria contraste impossível de garantir e
geraria bugs irreproduzíveis. O usuário escolhe a paleta; o app deriva o resto —
que é exatamente a camada 1 do sistema de estilo, com validação de contraste no
momento da escolha.

**Não construir antes da fundação.** A decisão está registrada agora porque muda
como as fases 2 e 3 são escritas — é toda a lei nº 6.

---

## As seis leis

Determinam se o projeto escala ou apodrece. Colidiu com uma delas, pare e
levante a questão em vez de contornar.

1. **Estado fora do React, com subscrição por entidade.** Store module-level,
   `useSyncExternalStore` keyed por ID. Nunca dado de entidade em Context.
2. **Virtualização desde a primeira linha.** Retrofit é reescrita da tela.
3. **`minmax(0, 1fr)` no grid, `max-inline-size` na coluna de mensagem.**
4. **Zero valor mágico em componente.** Só tokens semânticos, sem arbitrary
   values.
5. **Biblioteca resolve o genérico; você escreve o específico.**
6. **Todo componente nasce movível.** Container query, sem premissa de irmão ou
   de lado, sem dimensão fixa, estado vindo do store.

---

## A ponte stoat.js → React

A peça mais crítica. Não é overhead de migração — é a camada onde a
granularidade de update é decidida, e portanto onde a performance do app é
definida.

```
stoat.js (signals Solid)
   ↓  adapter — assina o SDK, normaliza, emite por ID
store externo (Map<id, snapshot> + emitters)
   ↓  useSyncExternalStore
componentes React
```

**Regra de granularidade:** coleção assina lista de IDs; entidade assina a si
mesma. Editar uma mensagem toca uma linha, não a lista.

**A armadilha:** `getSnapshot` precisa devolver referência cacheada. Montar o
objeto ali dentro = loop infinito, que se manifesta como aba travando, não como
erro. Sem `.map()`, `.filter()` ou spread dentro do getter.

**Estado efêmero** (typing, presença, quem está falando) vai em store separado
com throttle na fronteira do adapter — nunca no store de mensagens.

**O SDK é transporte, não fundação.** O Vortex é produto separado do Stoat, com
features que o Stoat não tem — o `stoat.js` é só como o app fala com o backend
hoje. Por isso os tipos de domínio são **declarados pelo app**, nunca derivados
dos tipos do SDK, e o `stoat.js` só pode ser importado dentro de `src/sdk/`
(lint de boundary, igual ao que confina o Radix). O adapter é camada
anticorrupção: SDK entra, domínio sai.

Sem isso a desvinculação é intenção. A forma do protocolo vaza para todo
componente, não dá erro nenhum, e cobra o preço na primeira feature que o Stoat
não suporta.

Feita direito, isso reconstrói fine-grained reactivity na granularidade de
componente e a diferença pro Solid vira irrelevante. Feita preguiçosamente
(Context com o canal inteiro), jank em servidor grande — invisível em dev.

---

## Performance

60fps = 16,6ms por frame. Render de linha em React é sub-milissegundo.

**O problema nunca é custo unitário de render. É update não-escopado atingindo
milhares de componentes.** Toda otimização real aqui é sobre escopo.

Ordem de investigação quando algo estiver lento:

1. Escopo de update
2. Virtualização e ancoragem
3. Reparse de markdown
4. Decodificação e layout de mídia
5. Bundle

**Gate de merge:** script de firehose sintético — 500 eventos/s de
presença/mensagem/typing/reaction contra o store, com canal de 10k mensagens
carregado, segurando 60fps. Rodar antes de qualquer merge que toque store, lista
ou linha de mensagem.

Regressão de escopo **nunca aparece em uso normal de desenvolvimento**. Só em
servidor grande com usuário real. O firehose é a única forma de pegá-la antes.

---

## Layout — a causa raiz do bug de ultrawide

```css
.shell {
  display: grid;
  grid-template-columns:
    72px                          /* rail */
    clamp(240px, 18vw, 320px)     /* canais */
    minmax(0, 1fr)                /* conteúdo */
    clamp(0px, 20vw, 340px);      /* membros */
}

.message-column { max-inline-size: 1100px; }  /* composer alinhado a isto */
```

`1fr` sozinho é `minmax(auto, 1fr)`, e `auto` respeita o `min-content` do filho —
uma URL longa estoura o grid. **Essa é a causa do comportamento atual.**

Acima de ~2560px, o espaço extra vira função (thread, fixados, perfil), nunca
vazio morto nem texto esticado.

Painéis reagem por container query ao próprio tamanho, não ao da janela. É isso
que faz o mesmo componente funcionar em janela pequena, ultrawide e popout sem
condicional espalhada.

---

## Electron

Casca fina, não segunda aplicação. Divergência atrás de flag de plataforma
resolvido em um lugar só. **No momento em que existir `MessageRow.desktop.tsx`,
o projeto tem dois front-ends e o design diverge em semanas.**

Segurança inegociável — o app renderiza conteúdo enviado por qualquer pessoa:
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload com
API estreita e enumerada, IPC validado no main, navegação externa bloqueada, CSP
sem `unsafe-inline`.

Titlebar custom: todo interativo dentro da região de arraste precisa de `no-drag`
explícito, senão para de responder sem erro.

Websocket vive no processo main, compartilhado. Uma conexão por app, não por
janela.

---

## Roadmap sugerido

### Fase 0 — Spike de de-risco · **concluída**

Antes de commitar meses. Só a lista de mensagens:

- Ponte `stoat.js` → store externo
- Virtualização com âncora
- Firehose sintético

Alvo: 500 eventos/s a 60fps com 10k mensagens carregadas.
**Confirmar aqui a compatibilidade TanStack Virtual + React Compiler.**

No mesmo passo, ligar o enforcement de base (`enforcement.md`): lint contra
índice como `key` e `any` na fronteira do SDK, assertion de estabilidade de
`getSnapshot`, assertion de remedição após mudança de largura do container, e o
firehose como gate de merge. São baratos agora e caros de retrofitar sobre
código já escrito.

A assertion de remedição foi antecipada da fase 2 para cá: ela envolve o mesmo
wrapper de virtualizador que o spike escreve, e mecanismo que chega depois do
código que guarda não guarda nada. A recompensa maior é na fase 4 — mas as
causas de mudança de largura já existem no spike.

A sexta invariante de fase 0 — lockstep dos gitlinks do SDK entre as duas ilhas
— já está mecanizada em CI.

**Segurou.** Resultado no gate (build de produção, CPU 4x, janela válida):
p95 12,5ms · p99 18,8ms · zero long tasks. As duas perguntas que o spike
existia para responder estão respondidas — TanStack Virtual convive com o
React Compiler, e a arquitetura de escopo aguenta a carga.

O que o spike encontrou vale mais que o veredito, e virou invariante com
mecanismo em `enforcement.md`: linha não resolvida medindo 0px, publicação de
coleção por evento (quadrática na carga), carga em massa pelo caminho de
evento (destrói a âncora), corrida de firehose medindo lista parada, e
medição no dev server reprovando o ambiente em vez do código.

**Concluída não é o mesmo que tudo verificado.** Prepend de histórico, mídia,
reconexão, container query e o test runner seguem em aberto — todos listados
em Pendências, nenhum bloqueia a fase 1.

### Fase 1 — Fundação visual · **concluída**

`tokens.css` com a paleta real, `@theme` mapeando, lint contra arbitrary values,
grid do shell, `minmax(0,1fr)` e teto de linha.

Verificado em navegador, não prometido: em janela de 3000px a coluna de mensagem
trava em **1100px exatos** e não há scroll horizontal; em 700px as trilhas ficam
`72px 240px 388px 0px` — a coluna de membros colapsa a zero em vez de deixar
espaço morto, que era o bug que motivou o redesign. Contraste 76/76 pares por
`pnpm contrast`.

Falta só o **elemento de assinatura** da identidade — paleta e par tipográfico
estão fechados. É item de identidade visual, não de fundação, e está nas
pendências.

### Fase 2 — Primitivos · **concluída**

Wrappers Radix em `src/components/ui/`, reestilizados pros tokens: context
menu, dropdown, dialog, popover, tooltip, hover card e toast.

Os três que o Base UI ainda não tem — context menu, hover card e toast — são
justamente os que um cliente de chat mais usa, e são a razão da escolha por
Radix. Quando o Base UI cobrir os três, a decisão é reavaliada; a fronteira de
import é o que mantém essa migração progressiva possível.

O toast guarda estado em store module-level com `useSyncExternalStore`, não em
Context: quem dispara um toast é um handler de erro ou um caminho de
reconexão, e nada disso está numa árvore de componentes. É a lei nº 1 aplicada
fora da lista de mensagens.

A fronteira é mecanismo, não convenção: `@radix-ui/*` só pode ser importado
dentro de `components/ui/`, com os próprios wrappers isentos.

`cn()` usa `extendTailwindMerge` porque a escala de raio deste projeto é
numérica e o `tailwind-merge` de fábrica não a resolve — `pnpm classes`
guarda isso.

### Fase 3 — Superfícies específicas · **concluída**

Message list completa (agrupamento, divisores, estados de envio), composer
(rascunho por canal, envio otimista, digitação), rail de servidores, lista de
canais e member list.

**Escritas sob a lei nº 6** — todo componente já nasce movível, e o shell virou
slots por causa disso: ele não importa mais nenhum painel, só declara onde as
colunas ficam. Cada painel traz a própria container query.

Três decisões que valem além da fase:

**A member list é a única das três colunas laterais virtualizada.** Não é
simetria: rail e lista de canais têm dezenas de itens, esta tem dezenas de
milhares. As duas não virtualizadas renderizam IDs com linha assinando a própria
entidade — a forma que um `useVirtualizer` consome — então o retrofit é trocar o
`.map()`, não reescrever o componente.

**Dois baldes de presença, não quatro seções.** `online → idle → dnd` não move
ninguém de lugar, então a member list não reordena — e presença é 55% da carga
do firehose. Com uma seção por estado, toda piscada custaria `n log n`. É a lei
nº 1 aplicada à ordenação em vez de à subscrição.

**Não-lidas e menções são do cliente.** É a terceira coisa que a camada
anticorrupção comporta sem tocar em componente, depois de `sendState` e do
agrupamento.

⚠ **A justificativa dada aqui estava errada, e a varredura de protocolo em
`concorrentes.md` desmentiu.** Escrevi que "o protocolo tem `unread` booleano; o
Vortex conta". O protocolo tem **`ChannelUnread.lastMessageId`** — o cursor de
leitura, persistido no servidor — e **`messageMentionIds`**, um conjunto de IDs.
O booleano é um getter derivado. Contar no cliente continua certo como
arquitetura; o que não existe é o incremento `+1` por evento ser a fonte da
verdade. Ele nunca viu offline, e a semeadura no `Ready` é item de fase 6.

Duas armadilhas do SDK encontradas verificando em navegador, e mortas na camada
de tradução: `channel.isVoice` não quer dizer "canal de voz do servidor" (é
`true` para DM e Grupo, e depende de um objeto `voice`), e o protocolo **não
tem** `channel_type: "VoiceChannel"` — canal de voz é TextChannel com `voice`.

**Passou no gate.** Sem throttle, mediana de 3 janelas com 10k mensagens e 500
eventos/s: p95 6,4ms (1,05× o refresh), 98,1% dos frames dentro de um intervalo,
**0,1% de frames perdidos contra o teto de 1%**, zero long tasks, vazão cheia.
Espalhamento entre janelas: 0,1% a 0,1%.

Sob CPU 4x fica em ~6% contra o teto de 5% — segue como acompanhamento, não
como bloqueio, e a razão está nas pendências.

**O que a caçada ao gate ensinou vale mais que o veredito**, e virou quatro
invariantes de INSTRUMENTO em `enforcement.md` — dobrando as que já existiam:

- Delta de rAF é intervalo de vsync, não custo de frame. Num display de 160Hz o
  percentil só assume 6,25 · 12,5 · 18,75, e o teto de 16,7ms cai entre degraus.
- Uma janela só não decide diferença pequena. Sob throttle o espalhamento entre
  corridas (0,9pp) ficou maior que o efeito procurado (0,72pp).
- O critério do gate foi reescrito como contagem — `perdidos ≤ 5%` é o mesmo que
  `p95 ≤ 16,7ms`, com prova e teste, e sem a patologia do degrau.
- A vazão do gerador precisa ser reportada: sob 4x ele entregava 441 de 500
  eventos/s, e o gate reprovava com menos carga do que anunciava.

Três hipóteses plausíveis foram testadas e nenhuma foi refutada — o instrumento
não tinha resolução para vê-las. As duas mais baratas (máscara no ponto de
presença, menu por linha) foram removidas ou viraram pendência mesmo assim,
porque custam de qualquer jeito.

### Fase 4 — Customização · **concluída**

Sistema de slots, modo edição, preset versionado e compartilhável, picker de
paleta com validação de contraste. Ver `layout-customization.md`.

**Fundação pronta.** Não é a feature — é o que a referência manda construir
antes dela, e o que o `enforcement.md` marcava como "Fase 4" desde a fase 2:

- **Schema do preset**, com o tipo fazendo o trabalho pesado. `PainelId` é
  união fechada de TIPOS de painel, então "os membros do servidor X" não é
  representável — dado de sessão não precisa ser filtrado porque não pode
  existir. Preset já compartilhado não volta atrás; é a única regra do projeto
  cujo erro não tem conserto.
- **Slot é POSIÇÃO, não objeto com lado.** A referência descreve slots com uma
  propriedade `lado`; aqui o lado é a identidade do slot. Sem `lado` guardado
  não existe o estado inconsistente "slot da coluna 1 do lado fim", então não
  há o que validar. Trocar de lado vira trocar qual painel ocupa qual slot — a
  mesma liberdade com metade dos estados possíveis. A âncora não é um `SlotId`:
  nunca mover deixou de ser regra e virou tipo.
- **Chave desconhecida preservada em profundidade**, mesclando o conhecido
  sobre o bruto de origem, e não com um campo `extras` — que só preservaria
  onde alguém lembrou de colocá-lo.
- **`TokenName` fechado e conferido contra `tokens.css` por teste**, nos dois
  sentidos: token da lista que sumiu do CSS reprova, e cor nova no CSS que
  ninguém classificou também. O default de uma decisão esquecida é "pare".
- **Store de layout** module-level, com o slot assinando sozinho — arrastar uma
  borda vai acordar aquele slot, não os quatro, e nunca a âncora.
- **Shell dirigido por dados.** Verificado em navegador: trocar rail e membros
  de lado dá `240px 240px 1048px 72px`, esconder tudo dá `0px 0px 1600px 0px`
  sem espaço morto, e a 700px o colapso segue o PAINEL membros para onde quer
  que ele tenha ido.

**Modo edição pronto.** Manipulação direta: alça na borda de cada slot,
visibilidade, qual painel vai em qual slot, repor por slot e repor tudo. Sem
botão de aplicar — tudo já vale enquanto se mexe —, então cancelar guarda um
retrato tirado na entrada, e o retrato inclui o bruto de origem: um desfazer
que preserva o que entende e perde o que não entende é pior que não ter
desfazer, porque o dano fica invisível.

As duas armadilhas técnicas da referência estão mecanizadas, e medidas em
navegador:

- **O store não é tocado durante o arraste.** A largura vai direto ao DOM por
  callback do dono do elemento. Medido: arrastando de 240 para 320px, o DOM
  acompanha frame a frame (240 → 280 → 320) e o store fica em **240 o tempo
  todo**; um único commit no drop. Sem isso, cada `pointermove` re-renderizaria
  a lista de mensagens.
- **A lista não remede durante o arraste.** O `ResizeObserver` dela já existia
  e dispararia a cada frame; agora ele adia e `aoTerminarArraste` faz o
  trabalho uma vez. Precisa de evento próprio porque o commit não muda tamanho
  nenhum — a largura já estava no DOM. Confirmado pela altura média das linhas
  mudando com a largura (84 → 87 → 79px).

Teclado faz o mesmo que o ponteiro: `separator` com `aria-valuenow`, setas com
passo de 8px, Shift para salto, Home/End nos extremos. Layout que só se ajusta
com mouse exclui gente do produto inteiro, não de um botão.

**Picker de paleta pronto**, e ele não valida contraste — ele torna contraste
ruim impossível. Quatro controles para vinte tokens: o usuário escolhe matiz,
saturação e cor de ação, o app decide **toda a luminosidade**. Em OKLCH o L é
perceptualmente uniforme, então rampa fixa de L entrega o mesmo contraste em
qualquer matiz, e uma varredura em teste (matiz × matiz de acento × croma ×
modo) prova que nenhuma combinação reprova. Avisar protege quem lê o aviso;
construir assim protege todo mundo.

A varredura achou folga zero na paleta que já estava no ar: `--vx-border-strong`
sobre `--vx-surface-3` media 3,00:1 exatos no escuro — aprovado por sorte, e
qualquer matiz diferente do violáceo original derrubava. Corrigido; a folga
real hoje é 3,45:1.

A lista de pares de contraste era duplicada entre o `pnpm contrast` e o que o
picker precisaria. Agora é uma só (`tema/pares.ts`), e o `pnpm contrast` virou
teste que a importa. O preset carrega a SEMENTE, não os tokens derivados: com
tokens crus, quem recebesse aplicaria uma paleta que ninguém validou.

A fase 4 está **completa**: slots, modo edição, preset versionado e picker.
Falta só o que sempre foi de fase futura — painéis que ainda não existem
(thread, fixados, perfil, voz) entrando na união `PainelId`.

Sistema de slots, modo edição, preset versionado e compartilhável, picker de
paleta com validação de contraste. Ver `layout-customization.md`.


### Fase 5 — Acabamento e superfície de produto · **próxima**

Nasceu como fase de acabamento e **deixou de ser**, por decisão explícita: a
varredura de protocolo em `concorrentes.md` mostrou que dezesseis campos já
chegam pelo fio e são ignorados, e a escolha foi trazer **todos**, features
inclusive. O acabamento continua sendo o esqueleto da fase; o resto pendura
nele.

A fase que o roadmap nunca teve. O polimento era suposto acontecer dentro de
cada fase, e a suposição falhou de forma visível na fase 4: quatro controles
nativos sem estilo em superfície de produto, uma sombra que o design system
proíbe em letras, `:hover` como único dos oito estados num painel e nenhum no
outro.

**O que ela é:** o `review-checklist.md` aplicado superfície por superfície nas
telas da fase 3 — rail, lista de canais, member list, linha de mensagem,
composer. Nenhuma delas passou por essa auditoria.

O alvo concreto, em ordem de valor:

- **Os oito estados** (`default · hover · active · focus-visible · disabled ·
  loading · empty · error`) em cada superfície. Hoje quase nenhuma tem os oito,
  e `empty` e `error` praticamente não existem no app — a lista de mensagens de
  um canal sem histórico renderiza nada, e falha de envio só tem a linha.
- **Ritmo de espaçamento e escala tipográfica** revisados juntos. É o que a
  referência chama de origem de personalidade num app denso, e o que não dá
  para consertar com token novo depois.
- **A lâmina onde ela ainda não chegou.** A assinatura existe no rail, nos
  canais, no segmentado e no painel de edição; falta decidir se ela marca
  também mensagem não lida e canal com menção.

**A fase deixou de ser só polimento.** A análise de concorrentes
(`concorrentes.md`) foi lida e três itens foram **aceitos** como escopo, porque
são baratos e mudam mais a sensação do produto que qualquer ajuste de espaçamento:

- **A paleta de comandos** (`Cmd+K` sobre servidores, canais e pessoas). T1, sem
  rede. Num app denso, a sidebar orienta e a paleta move.
- **Leitura como posição** — primeira não lida, linha de novas mensagens
  persistente, ir para a próxima menção. **T2**: o cursor já existe no protocolo
  (`ChannelUnread.lastMessageId`) e as menções são IDs, não contagem.
- **O canal de voz como sala.** No Stoat um canal de voz é uma *chamada*; aqui
  vira um *lugar*. `Ready.voice_states` já entrega quem está dentro de cada canal
  antes de entrar em qualquer um, e `VoiceChannelJoin`/`Leave` mantêm ao vivo —
  então mostrar a sala é **T2**, não fork de backend. É a única escolhida que
  muda o produto, e não a superfície.

⚠ **A armadilha de escopo do canal de voz:** a lista de participantes muda por
ação humana (baixa frequência, store normal), mas **quem está falando** vem do
LiveKit dezenas de vezes por segundo — é o estado efêmero que a lei nº 1 nomeia.
Anel de fala em store separado e com throttle na fronteira, nunca no store de
canais. Sem isso, canal de voz movimentado repinta a coluna inteira.

Ouvir de fato fica de fora desta fase: é `@livekit/components-react` e sessão de
mídia. Trabalho real, mas os serviços `voice-ingress` e `livekit` já estão de pé
no compose — não é fork.

Os sete itens **T0** da mesma análise também entraram: divisor carregando
contexto em vez de só data (prepara tópico de graça), o ritmo de agrupamento
medido e não chutado, separação por espaço em vez de régua, disciplina contável
de acento, empty state que é o começo do canal, timestamp no gutter em hover — e
a resposta à pergunta aberta abaixo: **a lâmina marca não-lida e não marca
menção**, porque não-lida é posicional e menção é contagem.

#### O que a auditoria de design mudou no método

Uma auditoria completa das superfícies da fase 3 e 4 foi rodada e deu **25/40**,
com quatro P1. Os quatro estão fechados, e os três P2 de paleta também. O
relatório está persistido; o que ficou de fora está na tabela de pendências,
cada item com a medição que decidiu.

O que vale além dos consertos são três regras que a caçada produziu:

- **A auditoria achou mais bug do que design ruim, e todos eram silenciosos.**
  Ritmo de agrupamento em 0px, overlay de modal medindo 0×0, `.ponto` montado
  duas vezes, `aria-label` vazio. Nenhum quebrava nada. É a mesma família do
  `py-0.5`, e a resposta continua sendo mecanismo, não olho.
- **Guarda que passa de primeira precisa de mutação, igual a teste.** O
  `pnpm utilities` estendido aprovou tudo em duas versões seguidas — uma
  varrendo uma lista vazia, outra acusando de morta a regra que segura a
  virtualização. As duas foram pegas plantando uma classe morta de propósito.
  Guarda não testada é decoração com custo de manutenção.
- **Direção de mudança de paleta se decide por orçamento medido, não por
  gosto.** Rankear os pares de contraste por folga sobre o mínimo disse
  exatamente para que lado a rampa podia abrir, e quanto. Sem isso a escolha
  teria sido simétrica e teria estourado o par mais apertado.

**A regra de método que a fase 4 ensinou, e que vale mais que a lista:**
checklist é o penúltimo degrau da ordem de preferência do `enforcement.md`.
Toda vez que um item desta fase puder virar lint, tipo ou teste, ele deve —
foi o que aconteceu com o controle nativo, que virou regra de lint em vez de
mais uma linha para alguém lembrar de conferir.

**Risco aceito nesta ordenação:** parte destas superfícies vai mudar quando o
dado real chegar na fase 6 — mensagem com anexo, avatar de verdade, estado de
reconexão. Polir antes significa retrabalho em algumas delas. A ordem foi
escolhida assim de propósito: o app fica aberto o dia inteiro na frente de
quem o constrói, e incômodo diário cobra juros que retrabalho estimável não
cobra.

#### Os dezesseis campos, e por que a ordem é esta

`T2` responde **de onde vem o dado**, não quanto custa a feature — a
classificação em quatro custos está em `concorrentes.md`. A ordem abaixo é
ditada por duas coisas: o que anda junto com o passe de polimento, e o que
ameaça o gate.

1. **Os sete campos baratos, dentro do passe de cada superfície.** `roleColour`
   e `editedAt` na linha; `nickname`/`avatar` por servidor, `timeout` e
   `hoistedRole` na member list; `orderedChannels` na coluna de canais. Fazê-los
   depois significaria tocar cada superfície duas vezes.
2. **A sala de voz.** Está no grupo barato mas é a maior dele: a linha do canal
   deixa de ser um item e vira um container com participantes.
3. **Cabeçalho de canal e cartão de perfil.** Duas superfícies inéditas, que
   destravam `description`, `banner`, `pronouns` e `status.text` de uma vez. O
   `HoverCard` da fase 2 é o primitivo, ainda sem uso. Nascem movíveis.
4. **`systemMessage`** antes das reações, porque é o mais barato dos itens que
   mudam a altura da linha — e força **uma vez** o trabalho de estimativa de
   altura por tipo, que a pendência de append já pedia.
5. **Respostas com citação.** Mexe na altura da linha e no composer.
6. **Reações.** Por último entre as da linha: é o maior custo de render no
   componente mais quente do app.
7. **Painel de fixados.** `PainelId` novo. Fica por último por ser o mais
   isolado — não encosta no caminho quente.

A **paleta de comandos** é independente e entra em qualquer ponto. **Leitura
como posição** vem depois que a lista parar de mudar de forma.

#### A regra de processo desta fase, e ela não é opcional

**Rodar o firehose a cada item que toca a linha de mensagem OU O CONTAINER
DELA — não uma vez no fim.**

⚠ A regra nasceu estreita demais e cobrou por isso. O passo 3 (cabeçalho de
canal) não tocava a linha, então não pediu firehose — mas tocou o WRAPPER da
lista, e um `block-size` faltando ali fez o container de scroll perder o teto:
o virtualizador montou as dez mil linhas de uma vez. Passou por typecheck,
lint e 145 testes sem um ruído, e só apareceu porque a verificação seguinte
olhou o DOM. Container conta. Três dos itens acima (`systemMessage`, citação, reações) somam custo ao
componente mais quente, e o patamar sob CPU 4x já está em ~6% contra teto de 5%.
Em lote, não há como saber qual deles pagou. E a fase 3 já provou que efeito
pequeno exige mediana de 3 janelas para ser visto: o espalhamento entre corridas
(0,9pp) foi maior que o efeito procurado (0,72pp).

`havePermission()` não entra como item: vira **regra** — nunca renderizar ação
que a pessoa não pode executar. Custa zero adotada agora, e é varredura em todo
componente se adotada depois. Candidata a virar mecanismo, pela ordem do
`enforcement.md`.

**O risco desta escolha, dito uma vez:** a fase cresceu de acabamento para
produto, e o retrabalho da fase 6 cresce junto — reações, citação e perfil todos
mudam quando o dado real chegar. Foi decidido com isso à vista.

### Fase 6 — Rede

Aqui o app fala com um servidor pela primeira vez. **Nada do que existe hoje
já viu um backend:** não há login, não há websocket, e todo dado sai do
firehose sintético. Isso foi escopo declarado — o `CLAUDE.md` diz que as fases
0 a 4 são front-end — e não esquecimento.

É a única fase com risco **desconhecido**. Tudo o mais no projeto é trabalho
conhecido com custo estimável; conectar é onde moram as surpresas.

O que ela cobre, e as armadilhas já mapeadas:

- **Login e sessão.** `definirUsuarioLocal` é placeholder honesto desde a fase
  0; o composer precisa de autor e hoje ele vem do arnês.
- **A mensagem otimista com ID que muda.** Já documentada em `adapter.ts`: o
  SDK só materializa a mensagem quando a resposta volta, com o ID do servidor,
  enquanto a otimista tem ID local. Numa lista com `getItemKey` por ID de
  entidade, isso é a chave da linha mudando debaixo do virtualizador. A
  reconciliação por nonce resolve-se no adapter, sem componente saber.
- **Reconexão.** Sem rede no spike. `conectado()` existe e é consultado nos
  caminhos de fire-and-forget justamente porque `EventClient.send` LANÇA sem
  socket — mas o caminho de volta nunca rodou.
- **Mídia na linha.** Nunca testada. Reservar espaço com `aspect-ratio` a
  partir do metadata do anexo é o que impede layout shift quebrar a ancoragem.
- **Sessão de 8h.** Vazamento só é medível em horas, e o refcount do store
  existe para isso desde a fase 0 sem nunca ter sido exercitado de verdade.

O fork de serviço de backend continua **não sendo item de roadmap** — é o
caminho para QUANDO uma feature forçar. Antes disso, ver a restrição de
`linux/arm64` na § Divergência de produto: o truque do `$BUILDPLATFORM` que
salva o cliente web não transfere para Rust.

---

## Pendências abertas

| Item | Precisa de |
|---|---|
| Identidade visual | **Resolvida.** Paleta pastel em lilás, menta, pêssego e rosa sobre neutro violáceo de croma baixa, claro e escuro, 76/76 pares acima do mínimo. Par tipográfico IBM Plex Sans variável + IBM Plex Mono. E o **elemento de assinatura**, que faltava: a **lâmina** — o traço que afina, tirado da pá da marca (`brand/mark.svg` são três espirais logarítmicas convergindo, com opacidade escalonada 1 / 0,82 / 0,64). A escala de opacidade da marca virou token (`--vx-lamina-1..3`) e é o mecanismo de profundidade em toda a interface, o que faz a regra "profundidade vem de camada, não de sombra" e a identidade serem a mesma coisa. A lâmina marca foco no rail, na lista de canais, no controle segmentado e no painel de edição. |
| TanStack Virtual + React Compiler | **Resolvido no spike.** Compatíveis: o compiler reconhece `useVirtualizer` e pula a memoização daquele componente (`react-hooks/incompatible-library`), sem crash nem UI velha. O custo — os filhos da lista deixam de ser memoizados — é cortado com `memo` no `MessageRow`. Não trocar por `react-virtuoso`. |
| Licença AGPL-3.0 | **Resolvido.** Uso privado — o dev e amigos, todos com acesso ao repositório, que é o que a cláusula de rede da AGPL pede. Reabrir a questão se o Vortex for exposto a terceiros sem acesso ao fonte. Não é aconselhamento jurídico. |
| Brand assets | **Resolvido.** `brand/` é diretório rastreado deste repo, não submodule: `mark.svg`, `wordmark.svg`, `monochrome.svg` + `generate.mjs`. O `.gitmodules` só tem os três de `web/packages/`. `web-react/` consome daí, como `web/` e `desktop/`. |
| Imagem arm64 do backend | **Não bloqueia nada hoje** — todo o roadmap é front-end. Antes de commitar com a primeira feature que precise de backend: como sair imagem `linux/arm64` de serviço Rust forkado. O truque do `$BUILDPLATFORM` que salva o cliente web não transfere para Rust. Ver § Divergência de produto. |
| Monitor acima de 60Hz | **Pergunta aberta, com dado a caminho.** A 160Hz o orçamento por frame é 6,25ms, não 16,7ms — o mesmo trabalho que sobrava tempo a 60Hz estoura. Cliente de chat só paga isso enquanto algo se move (rolagem, append, composer crescendo), e a mediana medida já cabe em um intervalo sob CPU 4x. O que faltava era contar os frames de DOIS intervalos, invisíveis a 60Hz e visíveis a 160Hz: o arnês passou a reportar a distribuição por refresh. Decidir se vira critério depois de ver o número, não antes. |
| Carregamento progressivo (janela deslizante) | **Medido: não resolve o gate.** Semear 1.000 em vez de 10.000 baixou o custo de publicação de 0,57ms para 0,12ms por frame — confirmando que a cópia do array de IDs é O(total) — e o p95 **não se moveu**: 18,7ms nas duas. Logo o driver do gate é custo por frame na janela visível, não o tamanho da lista. Continua valendo como feature por outro motivo: memória de sessão de 8h, `measurementsCache` limitado, e o erro nº 5 do briefing. Não como conserto de performance. |
| `pnpm gate` NÃO constrói | **Armadilha do arnês, já mordeu.** O script mede o que estiver servido em `localhost:4174` — não roda `pnpm build` e não sobe servidor. Rodá-lo depois de mexer no código, sem construir antes, APROVA O BUNDLE ANTERIOR e o relatório parece legítimo. Aconteceu: uma corrida reportou `estimando 73px` com a fonte já em 76. Construir antes de medir, sempre. |
| Vazão real do firehose | O arnês pedia 500 ev/s e nunca reportou quanto entregou. `setInterval(16)` não garante 62 ticks/s sob throttle de 4x, e um gate que entrega metade da carga aprova metade do que afirma. Agora a vazão aparece no relatório — conferir na próxima corrida. |
| Cauda do frame de append | **Quantificada.** Distribuição por refresh a 1.000 mensagens: 86,1% dos frames em 1× · 8,2% em 2× · 4,6% em 3× · 1,1% em 4×+. O p95 cai no balde de 3× por **0,72pp** — 29 frames de 3970. Converter esses 29 para 2× faz o gate passar. Sob CPU 4x, ~2,9% dos frames estouram 16,7ms na montagem de linha de altura variável (medir altura real + reancorar no mesmo frame). Dentro do critério do gate, listado por honestidade. Alavancas: `overscan` menor, estimativa por tipo de mensagem, pré-medição de conteúdo previsível. |
| Estimativa de altura de linha | **Corrigida.** `estimateSize` passou de 44px, que nunca foi medido, para 73px — a altura real medida no arnês é 72,6px. Não acelerou nada (o p95 não se moveu), e a razão de ficar é outra: a estimativa antiga errava ~38px por linha, o que faz a barra de rolagem mentir sobre o tamanho do histórico e dá trabalho de compensação ao virtualizador a cada rolagem. Correção de correção, não de performance. |
| Mídia na linha | **Fase 6.** Nunca testada. Sem imagem no spike. Reservar espaço com `aspect-ratio` a partir do metadata do anexo é o que impede layout shift quebrar a ancoragem. |
| Caminho REATIVO da ponte, sem teste até agora | **Resolvido, e era um buraco.** Em Node o `solid-js` resolve para `dist/server.cjs` — o build de SSR, onde `createEffect` é **no-op por design**. Medido com um `createSignal` simples: o efeito não rodava nem uma vez. Metade da ponte `stoat.js → React`, a metade que é a razão de o adapter existir, nunca esteve sob teste e silenciosamente não podia estar; tudo passava pelo caminho de evento (`client.on`) e pelas leituras ansiosas. Corrigido com `ssr.resolve.conditions` no `vite.config.ts` — mexer no `resolve.conditions` do topo derrubaria a condição `production` do build real. Nenhum teste existente quebrou quando a reatividade acordou. |
| Testes do caminho reativo em `members` e `messages` | **Agora possível, e ainda não escrito.** Os efeitos desses dois stores nunca foram exercitados por teste — o que passava era a leitura ansiosa no momento da subscrição. A sala de voz já tem os seus (`voz.test.ts`, verificados por mutação); os outros dois merecem os mesmos. |
| Estimativa de altura por TIPO de linha | Sem urgência enquanto linha de sistema for rara, mas o relatório do arnês passou a ser o detector: a estimativa única de 76px sobrestima uma linha de sistema, e a barra de rolagem exagera na proporção da frequência delas. |
| Teste de navegador | **vitest instalado**, 19 testes cobrindo store, adapter e toast. Falta runner de NAVEGADOR: jsdom não tem engine de layout, então âncora, remedição e o firehose seguem medidos à mão no arnês. O `web/` já usa Playwright — é o candidato natural. |
| Assertions que só o navegador exercita | A de `getSnapshot` estável agora tem teste e dispara nos quatro casos. Faltam duas, e as duas dependem de layout: **remedir após resize** e **linha medindo 0px**. jsdom não serve — é o mesmo motivo pelo qual a âncora vive no arnês. Vão junto com o runner de navegador. |
| Reconexão e sessão longa | **Fase 6.** Sem rede no spike; vazamento de 8h precisa ser medido em horas. **Container query resolvida** — shell, composer, rail, lista de canais e member list têm a sua; a do painel de membros (<140px) só é alcançável por slot da fase 4, não por largura de janela. |
| Firehose depois da fase 3 | **Rodado. Passa sem throttle, reprova sob CPU 4x.** Sem throttle, mediana de 3 janelas: p95 6,4ms (1,05× o refresh), 98,1% dos frames em um intervalo, **0,1% de frames perdidos contra o teto de 1%**, zero long tasks, vazão cheia de 500 ev/s — e espalhamento de 0,1% a 0,1% entre janelas. Sob CPU 4x fica em ~6% contra o teto de 5%, e ali a vazão do próprio gerador cai para 441/500. A fase 0 media 2,9% sob 4x com uma `MessageRow` que era um `<article>` de className estática — sem agrupamento, divisor de data, estado de envio, menu, composer ou colunas laterais. Parte da diferença é o produto existindo; quanto exatamente, só um A/B com mediana de 3 janelas responde. |
| Menu de contexto no nível da lista | **Fase 5. Medido, não conserta o gate, e vale mesmo assim.** Hoje cada `MessageRow` monta um `ContextMenu` do Radix inteiro — Root, Trigger, Portal, Content — e linha monta e desmonta na velocidade do scroll. A/B com a mesma `<article>` nos dois lados: p99 de 24,9ms para 18,9ms e frames perdidos de 6,0% para 5,4% ao desligá-lo. O conserto é um Root para a lista, posicionado no ponteiro, com o id da linha alvo no store. |
| Custo de pintura | **Hipótese nova, com evidência.** O mesmo build, no mesmo throttle de 4x, dá 0,4–0,5% de frames perdidos em Chrome headless (`pnpm gate`) e 5,4–6,3% em display real — e o espalhamento entre corridas cai de 0,9pp para 0,1pp. Headless não pinta numa superfície de verdade; a diferença é quase toda rasterização e composição. Isso reabre a remoção da máscara do ponto de presença, arquivada como "não moveu o p95" quando o p95 daquela máquina não conseguia ver mudança daquele tamanho. |
| Auditoria de design da fase 5 | **Rodada, com relatório.** Nota 25/40 e quatro P1, todos fechados: ritmo de agrupamento em 0px (`py-0.5` não emitia CSS), overlay de modal medindo 0×0 (`inset-0` idem), cor de cargo sem clamp, itens de menu inertes. Os P2 de paleta também: rampa, disciplina de acento e classificação de tokens. O que sobrou da auditoria e NÃO foi feito está nas linhas próprias desta tabela, cada um com a medição que decidiu. Retrato persistido em `.impeccable/critique/`. |
| Assertion de 0px em painel colapsado | **Corrigida em parte, e o resto é transiente.** A coluna de membros colapsa a `display: none` por container query em 768px, e a lista continua MONTADA ali dentro: sem caixa, tudo mede 0 e a assertion acusava dezenas de linhas quebradas num painel invisível. Agora ela exige `offsetParent` — o teste certo, porque distingue NÃO RENDERIZADO de renderizado com zero, e só o segundo é bug. Sobram **2 por ciclo de colapso**, no quadro em que o painel reaparece antes de o `ResizeObserver` remedir. Perseguir isso significa embrulhar o `measureElement`, que desregistra a observação do TanStack — risco maior que o ruído. |
| Ruído de `flushSync` no console | **Avaliado, e fica.** A auditoria apontou avisos em nível de `error` que não são erro. São do React, sobre uma escolha DELIBERADA e medida: `useFlushSync: false` faz o `scrollToEnd` inicial parar ~1000px atrás do fim e a lista derivar ~880px/s. Silenciar aviso de terceiro por filtro de mensagem esconderia um `flushSync` de verdade um dia. O que a auditoria realmente apontava — erro de verdade afogado em ruído — era a assertion de 0px, que eram erros DO PROJETO, e essa foi consertada. |
| Barra de ações no hover | **Resolvida.** Era a nota mais baixa da auditoria (2/4 em "reconhecer > lembrar"): reagir só existia pelo botão direito, num menu de onze alvos. Cinco alvos flutuando, e ela SOBREPÕE em vez de reservar espaço — mudar a altura da linha no hover destrói a âncora. `visibility: hidden` e nunca `opacity: 0`: o segundo somaria cinquenta mil paradas de tabulação invisíveis numa lista de dez mil linhas. É afordância de PONTEIRO; o teclado continua no menu de contexto. |
| `error` como estado | **Resolvida onde já pode acontecer hoje.** `error` existia em UM lugar contra `empty` em cinco. Sem rede, a falha real é outra: um painel que lança leva o shell junto — e isso desmente a lei nº 6, porque a independência dos slots era só de posição. Limite de erro por painel, chaveado pelo `PainelId`. A mensagem do erro NÃO vai para a tela: é escrita para quem programa e no caminho de render pode carregar conteúdo de terceiro. É a única classe do projeto, e não por gosto — `componentDidCatch` só existe em classe. |
| Acessibilidade da auditoria | **Três resolvidos.** Nenhum container rolável tinha `tabIndex`, e rolável sem foco é inoperável por teclado. Cabeçalho de seção levava `role="listitem"`, então o leitor anunciava "item 1 de 40: fundação" e a contagem incluía títulos. O campo da paleta tinha `outline: none` — o argumento do transbordo era verdadeiro, mas `outline-offset: -2px` resolve o transbordo sem tirar o anel. |
| Atalhos descobríveis | **Resolvida.** A tese é "teclado é a navegação primária", a paleta existe desde a fase 5, e nada na tela contava. Botão no cabeçalho da coluna de canais — de verdade, não texto de dica, porque isso conserta junto o recurso ser inalcançável em toque. A tecla é escrita como a plataforma a chama (`⌘K` no Mac): mostrar "Ctrl" a quem usa Mac ensina o atalho errado, e quem tenta e não funciona não tenta de novo. |
| Não-lida de servidor invisível | **Resolvida.** `data-naolidas` era escrito no botão do rail e nenhuma regra o lia. Mesmo tratamento da lista de canais, com a lâmina na mesma escala de três degraus — que ela sirva às duas colunas sem uma linha de exceção é o argumento a favor de tê-la tornado estado nomeado. |
| Leitura do `--vx-accent-soft` | **Resolvida, e era só o comentário.** Ele dizia "menção, chip, destaque de linha": três usos, um inexistente e dois que não são os que existem. Os seis reais dizem a mesma coisa — "o acento encostou aqui" — e nenhum alvo tem dois deles disputando. Menção NÃO passa a usar: pela decisão da fase 5 ela é contagem, não posição. |
| Gate depois do passe de design | **Rodado, mediana de 3 sob CPU 4x: PASS a 3,8% de frames perdidos contra teto de 5%.** As três janelas: 1,0% · 3,8% · 5,5%. O p50 ficou em 6,3–6,4ms nas três — idêntico às corridas de antes do passe, então o custo do frame MEDIANO não se moveu com a barra de hover, o limite de erro e o divisor sem régua. O espalhamento de 4,5pp é grande demais para comparar com as 1,4/1,5/1,7 anteriores, e há duas razões visíveis para desconfiar do ambiente e não do código: a vazão do gerador caiu de forma monótona a cada corrida (489 → 467 → 434 ev/s de 500) e a terceira quebrou o estimador de refresh (ver linha abaixo). |
| Estimador de refresh do arnês | **Defeito novo, visto na terceira janela do gate.** Ele estima o intervalo de vsync pelo 1º PERCENTIL dos deltas da corrida sob carga, e ali saiu **4ms** num display de 164Hz — fisicamente impossível, porque nenhum frame é mais curto que um vsync. Com 3432 amostras, o 1º percentil é o 34º menor valor: não foi um outlier de relógio, foi uma rajada de deltas sub-vsync. O estrago é só de RELATÓRIO — `perdidos` conta contra 16,7ms fixos e continua comparável — mas a linha de distribuição vira ficção: 2156 frames caíram no balde "2×" que a 6,1ms seriam "1×", e "dentro do orçamento" despencou para 10,9%. O conserto está à mão e o dado já é coletado: o arnês mede a **cadência SEM CARGA** antes de começar, e é dela que o intervalo deveria sair — não de uma corrida cujo relógio pode estar perturbado. |
| Escala de z-index sem token | **Resolvida.** Havia `39` ao lado de `40` em arquivos diferentes, e nada dizia qual vinha na frente sem abrir os dois. Nomeados por PAPEL: `realce · alca · veu · sistema · flutuante`. "Qual número é maior" é a pergunta errada; "o quê fica na frente do quê" é a certa. O `pnpm utilities` se pagou aqui — `--z-index-*` não é namespace reservado do Tailwind, e sem a guarda não haveria como saber se `z-flutuante` chegaria à folha. |
| Valores fora de escala em CSS Module | **Resolvida, das duas pontas.** O padrão era o mesmo nas ~8: alguém precisou de menos que `--vx-space-1` e escreveu `2px` cru porque o meio-degrau não existia. `--vx-space-0` e `--vx-radius-0` passaram a existir — legitimar é melhor que proibir aqui, porque empurrar para 4px dobraria um recuo desenhado para sumir. `pnpm escala` impede o nono, e confere PROPRIEDADE e não valor: `inline-size: 288px` num hover card é a largura do componente, não valor mágico. Verificada por mutação. |
| Patamar de CPU 4x em ~6% | Contra o teto de 5%. Não bloqueia — o patamar que mede o app (sem throttle) passa com folga de 10×. A fase 0 media 2,9% sob 4x com uma `MessageRow` que era um `<article>` de className estática: sem agrupamento, divisor de data, estado de envio, menu, composer ou colunas laterais. Parte da diferença é o produto existindo; quanto exatamente, só um A/B com mediana de 3 janelas responde — e agora ele decide, porque a contagem enxerga onde o percentil não enxergava. |
| Apelido por servidor na member list | **Resolvido.** A chave virou `ChaveDeMembro` — tipo MARCADO, não string composta: passar um ID de usuário onde se espera chave de membro não compila (provado com arquivo-sonda). Destravou apelido, cor de cargo e castigo de uma vez. |
| Categorias de canal | **Resolvido.** A coluna deixou de partir por TIPO — que era placeholder — e passa a usar `server.orderedChannels`. Colapso persistido em store LOCAL, nunca no preset: ID de categoria é dado de servidor, a mesma família que o schema do preset torna irrepresentável de propósito. Arrastar-e-soltar fica para a fase 6: reordenar ESCREVE no protocolo. |
| Semear não-lidas no `Ready` | **Fase 6, e é regressão garantida sem isso.** O adapter incrementa `+1` por mensagem que chega e nunca consulta `client.channelUnreads`. No firehose funciona porque tudo chega ao vivo; com rede, o que chegou offline não passou pelo incremento e o app abre zerado. Semear de `ChannelUnread.lastMessageId` + `messageMentionIds`, e escrever de volta com `Message.ack()`. |
| Seções de cargo na member list | **Resolvido** (1598a096). Lado online seccionado por cargo hasteado em ordem de rank, sem-cargo por último, offline num balde só. Não briga com os dois baldes: cargo não pisca. |
| Campos de protocolo ainda ignorados | Levantados em `concorrentes.md` § segunda passada: `reactions`, `replyIds`, `pinned`, `roleColour`, `editedAt`, `systemMessage`, `channel.description`, `muted`, `havePermission`, `pronouns` (em `User` **e** `ServerMember`), `timeout`, `banner`, `status.text`. Nenhum precisa de backend. |
| Cor de cargo sem clamp | **Resolvida.** Era o último furo da garantia de contraste: o cargo colorido vem do servidor e ia direto ao DOM por `style`, onde o `pnpm contrast` não podia vê-lo porque não é token. Medido antes, no navegador: **22 de 22 nomes reprovavam 4,5:1 no tema claro**, pior 1,33:1. Agora matiz e croma são do usuário e a LUMINOSIDADE é do app, como em `derivar.ts` — medido depois, claro pior 7,77:1 e escuro pior 8,60:1, zero reprovando. Varredura em teste de 24 matizes × 4 cromas × 2 modos × 4 superfícies, verificada por mutação. |
| Itens de menu inertes | **Resolvidos, e virou lint.** `Copiar texto`, `Editar` e `Apagar` ficaram meses no menu de mensagem sem `onSelect`: apareciam, recebiam foco, fechavam o menu e não faziam nada. Copiar existe agora; as outras duas escrevem no protocolo e voltam na fase 6. `no-restricted-syntax` reprova `ContextMenuItem`/`DropdownMenuItem` sem `onSelect`, `disabled` ou `asChild` — provado com arquivo-sonda. |
| Regra de CSS Module sem consumidor | **Resolvida.** O `pnpm utilities` conferia `className` que não produz CSS e não o inverso. Agora faz os dois, resolvendo quem importa cada módulo e com que alias. **Ele mesmo precisou de mutação duas vezes**: a primeira versão varria `.module.css` numa lista que só tem `.tsx` (laço rodava zero vezes e relatava sucesso); a segunda conferia só o TSX irmão e acusou de morta a `.coluna` usada de `App.tsx` — justamente a regra do `block-size: 100%` sem a qual o virtualizador monta as dez mil linhas. Três órfãs reais saíram. |
| Token sem classificação de contraste | **Resolvido.** A auditoria perguntou por que `--vx-border-subtle` não estava na lista de pares. A resposta era boa e não estava escrita: token ausente de propósito e token esquecido são indistinguíveis olhando. `SEM_PAR` guarda o motivo e um teste exige que todo token esteja num dos dois lugares, **nos dois sentidos** — motivo que sobrou também reprova. Pegou meu erro na primeira execução. |
| Peso óptico dos semânticos | **Medido, e não vale fazer.** `--vx-success` aparece SÓ no arnês de desenvolvimento, `--vx-warning` em dois ícones de castigo, `--vx-danger` em dezesseis lugares do produto. Diferenciar peso entre os três seria trabalho sem nada na tela para mostrar. Reabrir quando `success` tiver um consumidor de produto. |
| Toast de erro expirando | **Resolvido.** Cinco segundos é o tempo de confirmar um acerto e o errado de relatar um erro — e aqui era literal, porque o toast de falha ao copiar carrega o texto que a pessoa precisa selecionar à mão. Erro agora não some sozinho. No mesmo passo: `relative` no Root (o `Close` era `absolute` sem contexto e ancorava na viewport) e o rótulo da região, que anunciava `"Notifications (F8)"` — o default do Radix, num app em português. String que só leitor de tela lê não aparece em revisão de tela nenhuma. |
| Rampa de superfície achatada | **Resolvida.** Quatro superfícies somavam 1,368:1 no escuro e 1,137:1 no claro de ponta a ponta, e no claro os degraus ENCOLHIAM a cada passo. Agora passo constante em ΔL — o certo, porque em OKLCH o L é perceptualmente uniforme. **A direção foi ditada pelo orçamento:** uma sonda rankeou os pares por folga, e ela disse que no escuro subir a superfície de topo era caro (`text-3/surface-3` a 1,11×) e abrir para baixo quase de graça. Escuro 1,075 · 1,105 · 1,152 → 1,09 · 1,14 · 1,15; claro 1,060 · 1,040 · 1,031 → 1,081 · 1,069 · 1,067. |
| Disciplina de acento | **Resolvida.** Nove lâminas de acento na tela ao mesmo tempo, sete delas tocos permanentes de item NÃO ativo — os consumidores pintam `color: var(--vx-accent)` e o toco herdava junto. O toco ficou neutro e o hover ganhou o degrau do meio. Acento na tela: 9 → 2, o servidor ativo e o canal ativo. |
| Lado lógico no wrapper de Tooltip | **Resolvido.** `LadoLogico` = acima / abaixo / inicio / fim, com o mapeamento lógico→físico lendo a direção real do documento dentro do wrapper. O rail era o único chamador físico e voltou a não saber de que lado da tela está. |

---

## Enforcement

Regra escrita depende de alguém lembrar; mecanismo não. Toda invariante crítica
tem lint, tipo, teste ou assertion em dev que a faz falhar sozinha. Detalhe e
cronograma em `references/enforcement.md`.

Ordem de preferência: **tornar impossível > tipo > lint > teste > assertion em
dev > checklist > prosa.**

Três valem desde já, embora a feature seja de fase futura:

- Preset nunca carrega dado de sessão — privacidade, e preset já compartilhado
  não volta atrás
- Chave desconhecida em preset é preservada, nunca descartada
- Largura de container mudou = virtualizador remede e reancora

---

## Como trabalhar

Antes de escrever código, em até 10 linhas: superfície a alterar · arquivos que
vai abrir e por quê · tokens e componentes reutilizados · o que muda em cada
breakpoint · menor patch possível.

Depois, passos pequenos e verificáveis. Padrão existente preservado. Dependência
nova precisa de justificativa. Problema fora do escopo vira **pendência
listada**, não correção silenciosa.

Entrega: arquivos alterados · resumo objetivo · comportamento por breakpoint ·
pendências. Sem log completo, sem despejar código inteiro quando o diff basta.

---

## Os cinco erros que mais quebram este projeto

Nenhum deles dá erro. Todos degradam em silêncio.

1. `getSnapshot` alocando objeto novo → loop de render, aba travando
2. Dado de entidade em Context → jank em servidor grande, invisível em dev
3. `minmax(0, 1fr)` faltando → grid estoura com URL longa
4. Markdown reparseado no render → lento só quando a presença começa a piscar
5. Listener sem cleanup → vazamento que só aparece na sexta hora de sessão