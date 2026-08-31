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

Verificado em navegador, não prometido: em 700px as trilhas ficam
`72px 240px 388px 0px` — a coluna de membros colapsa a zero em vez de deixar
espaço morto, que era o bug que motivou o redesign. Isso continua valendo.

⚠ **O teto de 1100px na coluna MUDOU DE LUGAR, e a verificação original desta
fase envelheceu.** Ela celebrava "a coluna de mensagem trava em 1100px exatos"
— e travar a COLUNA produzia uma faixa morta: medido em 2560px, a trilha tinha
2008 e a coluna parava em 1100, com **908px de vazio, todo do lado direito**,
porque ela era encostada ao início. Não lia como coluna de leitura; lia como
alinhamento quebrado, e foi assim que quem usa relatou.

O teto agora limita o CONTEÚDO da linha; a faixa cobre a trilha. Foi a medida
de leitura (`--vx-medida`) que tornou isso possível — ela é o mecanismo certo
para legibilidade, e limitar a linha inteira nunca foi. Contraste 76/76 pares por
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
| Navegação em janela estreita | **Lacuna, não bug — e dita.** Abaixo de 640px a lista de canais colapsa, senão a conversa fica com 63px numa tela de 375 (rail 72 + canais 240 = 312). O guarda devolve 303px de conversa. O que ele NÃO resolve: com a lista escondida some o gatilho da paleta, que mora no cabeçalho dela — por teclado a paleta continua, por TOQUE não há navegação. Celular não é plataforma deste produto (o briefing diz web e Electron desktop), e um modelo de navegação para telas estreitas é trabalho de produto que nunca foi escopado. |
| Identidade visual | **SUBSTITUÍDA pelo design do Claude Design, e a linha anterior descrevia a paleta antiga.** Saiu: pastel lilás/menta/pêssego/rosa sobre neutro violáceo, IBM Plex Sans + Mono, e a lâmina como escala de opacidade da marca. Entrou: **teal `#35c2cc` sobre neutro azul-ardósia** (matiz 258), **Instrument Sans Variable + JetBrains Mono Variable**, e a assinatura passa a ser uma **barra de acento sólida de 3px** na borda de início do item ativo — rail, lista de canais, menu de configurações e segmentado, os mesmos quatro lugares de antes. Os tokens `--vx-lamina-1..3` sobrevivem com o papel de sempre (profundidade por opacidade entre irmãos); o que saiu foi a amarração com a espiral de `brand/mark.svg`. ⚠ **A regra "profundidade vem de camada, não de sombra" caiu, e por medição:** no tema claro do design `surface-3` e `surface-4` são os DOIS branco puro, então um menu sobre um card não tem degrau de luminosidade nenhum. `--vx-elev-1..3` existe por causa disso, e só por isso — três degraus, teto em e3. |
| Quatro cores do design que NÃO couberam | **Ajustadas por contraste, e o design as entregou reprovando.** Medido antes: `text.tertiary` dava **4,10:1** sobre `surface.raised` e **3,71:1** sobre `surface.float` no escuro, e **3,79:1** sobre `surface.sunken` no claro — três pares abaixo de 4,5. `danger` dava **4,28:1** dentro de menu, que é onde "Excluir canal" mora. A rampa de L foi aberta até passarem: `#77808e → #8992a0`, `#e8596b → #f16172`, `#767f8c → #606875`, `#0e7c86 → #00737c`. Superfícies, acento, hover, press, `accent-text`, `warning` e `success` reproduzem o design **byte a byte**. |
| A superfície que aperta trocou de lado | **Consequência da quinta superfície, e vale saber antes de mexer na rampa.** Com quatro degraus o par crítico era um só; com cinco, no ESCURO é `text-3` sobre `surface-4` (hint dentro de menu) e no CLARO é sobre `surface-0` (rail e gutter), porque a rampa clara sobe em direção ao branco e a base é o tom mais escuro que existe. A matriz de pares cresceu de 38 para **58 por modo**; o mais apertado hoje é `border-strong/surface-4` a 3,21 (mín 3) no escuro e `accent/surface-0` a 4,70 (mín 4,5) no claro. |
| Escala de raio e de tipo mudou de VALOR, não de nome | **Deliberado, e é o que permitiu o reskin sem varrer todo `className` do repositório.** Raio: `rounded-2` foi de 8 para 6, `rounded-3` de 12 para 8, `rounded-4` de 16 para 12, e `rounded-5` (pill) passou a existir. Tipo: cada degrau encolheu 1–3px (`text-md` 14→13, `text-lg` 16→15, `text-xl` 20→17, `text-2xl` 24→22). Espaço ganhou `--vx-space-7` (40px), o degrau de SEÇÃO de página. `cn.ts` e `pnpm escala` foram atualizados junto. |
| Corpo da mensagem em 13px | **Corrigido no mesmo passe, e era o único consumidor que a troca de escala quebrava de verdade.** Com `text-md` indo de 14 para 13, o corpo da mensagem ficou abaixo do que o design pede (15px, `type.body`). Movido para `text-lg`, junto com o nome do autor (`type.strong`, 15/600). Medido depois: 15px / 22,5px de entrelinha. ⚠ A assertion de altura de linha **não disparou** — as constantes de `ALTURA_POR_TIPO` (92/60/37) seguem dentro dos 15% mesmo com o corpo maior. |
| Medida de leitura pendente de remedição | ⚠ **O número envelheceu com a fonte.** `--vx-medida: 32.5rem` saiu de medir prosa em IBM Plex Sans a 14px (6,47px por caractere médio). O corpo agora é Instrument Sans a 15px, e a largura por caractere mudou nas duas direções ao mesmo tempo — caixa mais estreita, corpo maior. Estimar seria chutar; precisa de navegador. |
| Comentário afirmando medida que não existe | **Achado lendo `MessageRow.module.css`, e é a família do `py-0.5`.** `.corpo` diz "SEM medida de leitura, por decisão de quem usa" — verdade, e registrada. Mas o cabeçalho de seção logo acima e o comentário de `.conteudo` continuam afirmando que `--vx-medida` limita o texto em ~80 caracteres. Medido: o parágrafo mede **803px** numa janela de 1442, ou seja ~130 caracteres. Dois comentários vizinhos se contradizendo dentro do mesmo arquivo. **Dissolve no passe de shell**: o design cobre a coluna em 1040 e CENTRA, com o excedente virando gutter em `surface-0` — que é exatamente o que faltava para o teto não ler como alinhamento quebrado. |
| `App.tsx` era o arnês | **Resolvido, e era a maior dívida estrutural do projeto.** Havia UMA composição de shell, e ela vinha com a barra do firehose — toda superfície da fase 3 em diante nasceu dentro de uma tela de teste, e não havia como abrir o app e ver o app. Agora `app/Cliente.tsx` é o produto, `dev/Arnes.tsx` o ENVOLVE injetando só a barra, e `App.tsx` escolhe. O arnês não virou rota do produto de propósito: `Local` é a união que a URL projeta, que a paleta indexa e que todo `Record<…>` de exaustividade percorre — um `{tipo:"arnes"}` ali seria um destino que o produto não tem. É lido do `pathname` cru em `dev/arnesAtivo.ts`, e `main.tsx` NÃO liga o roteador ali (ele faria `replaceState` para `/` e o rig perderia o próprio endereço em todo F5). Medido: o bundle de produção caiu de **1.033 kB para 1.009 kB** (gzip 312 → 304), com o arnês num chunk de 24 kB que só `/dev` baixa. |
| A prancha — o ultrawide resolvido | **Construída, e é a correção que a fase 1 não conseguiu fazer.** O teto de 1100px existia lá e a CENTRALIZAÇÃO não, então em 2560px a coluna parava em 1100 encostada ao início e sobravam 908px de vazio de um lado só — que lê como alinhamento quebrado. Agora a coluna de conteúdo tem três linhas (barra do arnês · cabeçalho · prancha), a prancha pinta o gutter em `--vx-surface-0` e trava a leitura em `--vx-timeline-max-w` centrada. **Medido em 3440px:** rail 0–72, canais 72–320, conteúdo 320–3208, leitura **1244–2284 (1040 exatos)**, membros 3208–3440, gutters de **924px simétricos**, zero overflow. Em 1442px as trilhas dão `72px 248px 889,6px 232px` — o breakpoint padrão do design, sem gutter porque 890 < 1040. |
| Cabeçalho virou linha do shell | **Consequência da prancha, e é decisão.** Ele era irmão da lista dentro de um grid interno; agora é linha própria, largura cheia. A razão: as ações dele (fixados, membros, busca) ancoram na borda da COLUNA, e um cabeçalho centrado em 1040 as deixaria flutuando no meio de uma janela ultrawide. O `Shell` ganhou a prop `cabecalho`. |
| `.coluna` do cabeçalho ficou órfã | **Pega pelo `pnpm utilities` na mesma corrida, e a guarda se pagou de novo.** Com o cabeçalho virando linha do shell, o wrapper de duas linhas perdeu o consumidor. ⚠ Ele carregava um `block-size: 100%` LOAD-BEARING — sem altura definida o container de scroll perde o teto e o virtualizador monta as dez mil linhas, sem erro nenhum. **Medido antes de apagar:** 44 linhas montadas com 1.000 semeadas, `clientHeight` 702 contra `scrollHeight` 990.388. Agora quem dá a altura é o grid da prancha, porque item de grid estica para a trilha. O raciocínio mudou de arquivo junto com a regra. |
| Larguras de coluna por breakpoint | ⚠ **O design lista larguras por breakpoint; aqui elas são o PADRÃO.** 216/0 em 1024, 248/232 em 1440, 264/256 em 1920. O default virou o de 1440 (canais 248, membros 232), mas um CSS que reescrevesse a largura por media query desfaria em silêncio o arrasto que a pessoa acabou de fazer — largura de coluna é escolha de quem usa desde a fase 4. O que o CSS ainda faz é o GUARDA: membros some abaixo de 1000px, canais abaixo de 640px. |
| Drawer de membros abaixo de 1440 | **Não construído, e a divergência é dita.** O design manda a lista de membros virar drawer sob toggle no breakpoint compacto (1024–1439). Aqui ela some em 1000px sem toggle, que é o guarda medido da fase 1. Adotar 1440 sem construir o drawer apagaria a lista num laptop de 1366 sem nenhuma forma de trazê-la de volta — pior que a divergência. O drawer é trabalho de produto que ainda não foi escopado. |
| Painel de usuário | **Construído, e a ausência aparecia em TODA tela do design.** Sem ele não havia onde ver quem você é, mudar o próprio status, nem silenciar o microfone. Rodapé da coluna de canais (e não no rail: o rail é uma tira de 72px onde só cabe ícone, e este painel mostra NOME e RECADO, que são texto). Mora no wrapper `.coluna`, FORA do `if` que escolhe entre canais e conversas — o rodapé é estrutura da coluna, não conteúdo dela, e montá-lo nas duas fontes daria duas cópias que precisam concordar. |
| Status do próprio usuário | **Era um ❌ da varredura: `PresenceStatus` era lido, mapeado e pintado no pontinho de todo mundo, e não havia como mudar o próprio.** Agora `definirPresenca` e `definirStatusTexto` escrevem no protocolo, e o `Ready` semeia com `semearStatusDoServidor` — sem isso o painel abriria sempre dizendo "Online" e quem escolheu invisível veria a interface afirmar o contrário do que o servidor sabe. ⚠ **`PresencaEscolhida` é tipo SEPARADO de `PresenceStatus`**, e a separação é o mecanismo: `invisivel` não existe no exibido, e colapsar os dois faz o menu abrir com "Online" marcado para quem escolheu invisível. `offline` não está na união da escolha — ninguém escolhe estar offline. Verificado em navegador: escolher "Não perturbe" muda o rótulo e o ponto para `#f16172`. |
| Mudo e surdo fora da chamada | **A regra saiu do motor de voz e foi para o store, e a mudança de lugar tem razão.** O guarda da fachada era `return` seco: fora da sala o botão não fazia nada — inaceitável num controle que fica no rodapé o dia inteiro. Mudo é PREFERÊNCIA (é o que `entrarNaChamada` lê para decidir se abre o microfone), não estado de transporte. Agora `alternarMudoNoStore`/`alternarSurdoNoStore` guardam a regra e o motor só a APLICA no LiveKit — que é o que impede meio megabyte de WebRTC de ser baixado para virar um booleano. Medido: parte em `false/false`, ensurdecer dá `mic:true fone:true`, desensurdecer dá `mic:true fone:false` — a regra "desensurdecer não reabre o microfone" sobreviveu. |
| Primitivos na rampa antiga | **Achado abrindo o menu de status: ele renderizava em `--vx-surface-2`, que agora é a TIMELINE.** Os wrappers de `components/ui/` foram construídos quando `surface-2` era a camada mais alta de uma rampa de quatro; com cinco degraus, o menu ficava do mesmo tom do conteúdo — aberto, medindo 383×261, e praticamente invisível. Corrigidos juntos: `Dialog` (e3), `Popover`, `HoverCard`, `Tooltip` (e2), `Toast` (e3) e `menu.ts` (e2) foram para `bg-surface-4` com `shadow-e*`, o realce de item virou `bg-state-hover` (véu, não tinta — um item dentro de `surface-4` precisaria de um sexto degrau para se destacar por superfície), e o véu do diálogo virou `bg-scrim`. A borda voltou a ser a hairline do design, porque agora o degrau de superfície E a sombra fazem o trabalho. ⚠ O comentário do `menu.ts` justificava `border-strong` com "1,05:1 sobre surface-2" e "box-shadow proibido" — os dois pressupostos morreram com a identidade nova, e o comentário foi reescrito junto. |
| `aria-pressed` com rótulo que alterna | **Pego pelo lint do projeto no mesmo commit em que eu o introduzi.** Eu escrevi `aria-label={mudo ? "Ativar microfone" : "Silenciar microfone"}` nos dois controles — e um rótulo que alterna junto do estado faz o leitor de tela anunciar o INVERSO ("Silenciar microfone, pressionado" com o microfone aberto). A regra manda nomear o RECURSO ("Microfone", "Áudio recebido") e deixar o estado no `aria-pressed`; a ação vai no tooltip. |
| Ações do cabeçalho de canal | **Construídas — a linha virou primeira classe no shell e estava quase vazia.** Silenciar, fixados e membros, os três com consequência real. ⚠ **O design desenha SEIS alvos e só três entraram:** tópicos, busca no canal e o menu `⋯` dependem de superfícies que não existem (`Channel.search` existe no protocolo, o painel de resultados não). Renderizar os seis com três inertes é o defeito que o lint de `onSelect` foi instalado para matar — alvo que recebe foco, parece clicável e não faz nada. |
| `alternarPainel` — o conflito nº 3 de novo | **O shell tem TRÊS slots e o produto tem mais painéis que isso.** A resolução é a mesma em espírito da coluna de conversas: a ponta final abriga UM painel de cada vez e o cabeçalho escolhe qual, em vez de gastar um slot por painel. Três casos: visível → esconde; posicionado e escondido → mostra ONDE ESTIVER (respeita quem moveu membros de lado no modo edição — regra posicional ligaria o painel errado); sem slot → assume a ponta com a largura padrão DELE. Medido: fixados entra a 300px, membros volta a 232 — e não a largura que o slot tinha, porque fixados numa coluna de 232 quebra cada mensagem em quatro linhas. |
| Painel de fixadas renderizava quebrado | ⚠ **Defeito LATENTE desde que o painel foi construído, e apareceu no primeiro caminho normal até ele.** `.lista` é flex column com altura limitada, e filho de flex column tem `flex-shrink: 1`: em vez de rolar, o navegador ENCOLHIA cada item até o `min-block-size` de 32px. Medido: `height` 32 contra `scrollHeight` 72 — o conteúdo vazando e escrevendo por cima do item seguinte, com a prévia de duas linhas sozinha pedindo 36px. `flex: none` resolve. **Ele nunca tinha sido visto porque `fixados` não está no preset de fábrica** — só chegava à tela para quem o posicionasse à mão no modo edição. É a família do "construído e inalcançável": custa manutenção sem entregar nada, e de fora é idêntico a ausente. |
| Cabeçalho de canal em 32px | **Corrigido para os 50px do design.** Era apertado antes e virou impossível com as ações: os botões medem 32px, e um cabeçalho de 32 não tem onde pousá-los. `block-size` é DIMENSÃO de componente e não degrau de escala — é por isso que o `pnpm escala` governa padding, margin, gap e raio, e deixa `block-size` de fora. O nome do canal foi de 13/500 para `type.title` (17/600): ele é a identidade do lugar e competia em peso com o tópico. |
| ⚠ REGRA NOVA: o design manda, 1:1 | **Decisão de quem toca o produto, e ela SE SOBREPÕE a este arquivo e às skills.** Duas partes: **(a)** a interface é construída 1:1 com o design AGORA, inclusive controles sem back-end — a régua anterior era "não desenhar o que não funciona", e o lint de `onSelect` existe por causa dela; **(b)** a PALETA é a do design, exata, mesmo onde ela reprova contraste. O encaixe com o editor de layout/tema fica para uma rodada própria. Levantei as duas objeções e as duas foram reafirmadas. |
| Paleta: quatro tokens voltaram ao design | **Revertidos os ajustes que eu tinha feito por contraste.** `--vx-text-3` voltou a `#77808e` (escuro) e `#767f8c` (claro), `--vx-danger` a `#e8596b`, e o acento claro a `#0e7c86`. A paleta agora reproduz o design **byte a byte nos 25 tokens, nos dois modos**. |
| `EXCECOES` — a dívida de contraste, enumerada | **13 pares ficam abaixo do mínimo, e cada um está listado com a razão MEDIDA.** Pior: `--vx-text-3` sobre `--vx-surface-0` no claro, a **3,39:1**. A guarda não foi desligada: o teste exige as DUAS direções — falha fora da lista reprova o build como sempre, e exceção que parou de falhar também reprova (senão a lista vira depósito que mente sobre uma decisão que ninguém tomou mais). Mesmo par de asserções de `SEM_PAR`. Hoje: **54/58 no escuro, 49/58 no claro**. `falhasQueContam` é o filtro único, usado pelos quatro chamadores — o contraste do CSS, a reprodução da semente, a varredura de matiz e as paletas curadas. ⚠ A dispensa vale para QUALQUER paleta: os pares falham por causa das LUMINOSIDADES da rampa, e girar o matiz não move luminosidade. |
| Busca virou linha própria da coluna | **Era um botão apertado no canto do cabeçalho, disputando espaço com o nome do servidor.** O design lhe dá a largura inteira logo abaixo do nome, com cara de campo. Continua sendo `button` e não `input`: digitar ali abriria a paleta e jogaria fora o primeiro caractere, ou exigiria um segundo campo sincronizado com o de lá — dois donos do mesmo texto. O que ele PARECE é campo; o que ele faz é abrir a paleta, que é um campo de verdade. |
| Cabeçalhos das duas colunas alinhados | **50px nos dois**, e não é simetria gratuita: coluna de canais e cabeçalho de canal são vizinhos diretos no grid do shell, e uma diferença de altura ali produz um degrau na linha que atravessa a tela inteira. |
| `+` do cabeçalho virou item de menu | **O design não tem `+` no cabeçalho da coluna** — ele põe um por CATEGORIA, e "Criar canal" no menu do servidor. A ação não se perdeu: foi para o dropdown junto com "Criar categoria", e continua alcançável no caso que justificava o botão (servidor recém-criado, sem categoria de onde partir). O `pnpm utilities` acusou a regra `.acaoDoCabecalho` órfã na mesma corrida. |
| Badge de identificador no nome do servidor | ⚠ **Mostra a SIGLA, não a "tag do servidor".** A tag é campo configurável do protocolo (tem página própria no design) e não existe aqui; a sigla é derivada do nome e é verdade sobre ele. Quando a tag existir, substitui sem mexer no layout. |
| Ladrilho de servidor preenchido por gradiente | **Era o que mais fazia a tela parecer outro produto.** O design desenha cada servidor com um gradiente próprio; o app tinha quadrados cinza com duas iniciais, iguais para todos. `lib/gradiente.ts` deriva o gradiente do ID — estável entre sessões, igual para todo mundo que vê o mesmo servidor. **Mesma arquitetura do picker de paleta: o ID escolhe o MATIZ, o app fixa a LUMINOSIDADE**, e um teste varre os 3.600 matizes provando que a inicial fica legível em qualquer um. FNV-1a e não soma de `charCodeAt`: ULID carrega o tempo nos dez primeiros caracteres, então servidores criados no mesmo minuto sairiam todos da mesma cor — exatamente o problema que o gradiente veio resolver. Serve de fallback até haver upload de avatar. |
| A lâmina saiu do rail | **Substituída pela BARRA do design.** Era a assinatura da identidade anterior — três espirais com opacidade escalonada, tiradas da marca. A nova marca estado com barra sólida de 3px na borda de início: alta no ativo, curta na não-lida, `opacity: 0` no repouso (a caixa fica, então acender não reflui a coluna). Mesmo mecanismo, forma diferente. |
| Rail: cores e ícones do design | Ladrilho 44×44 (era 40), peso 700 em 15px, inativo em `surface-4`. O item de conversas usa **envelope** e não casa — é o ícone do design, e a entrada agrega DM, grupo e notas. O `+` é tracejado. Rodapé com "Baixar para desktop" separado por régua, num ladrilho menor: tamanho diferente diz que ele não é um lugar para onde se vai. ⚠ **O raio de 14px do design não entrou** — 12 (`--vx-radius-4`) é o degrau mais próximo e é o que a própria Foundations do design lista; 2px num ladrilho de 44 não é perceptível, um degrau fora da escala é. |
| Cores da coluna de canais | **Nome do canal foi de `text-3` para `text-2`** — o terciário é o tom de METADADO (timestamp, hint), e a coluna inteira lia como desativada. O glifo `#` foi para `text-4`: é pontuação, não informação. Ativo passou de `--vx-accent-soft` (teal sólido) para `--vx-state-selected` (acento a 10% compondo com o fundo), que é o `rgba(53,194,204,0.10)` do design — o sólido denuncia que foi pintado para UM fundo só. Hover virou véu. |
| `Avatar` — uma peça, seis superfícies | **Havia SEIS cópias**: member list, linha de mensagem, cartão de perfil, sala de voz, painel de usuário e conversas, cada uma com o próprio `.avatar` no módulo vizinho. Trocar cinza por gradiente exigiria seis edições que ninguém garantiria completas. Agora é um wrapper em `components/ui/`, e o `pnpm utilities` acusou as seis regras órfãs uma a uma conforme os consumidores sumiam — a guarda fez o inventário sozinha. |
| Cache do gradiente é obrigatório | **Não é otimização preventiva.** Um dos consumidores é a linha de mensagem: sob firehose ela re-renderiza dezenas de vezes por segundo, e sem cache cada passagem pagaria um hash mais TRÊS conversões OKLCH→hex por avatar visível. É o erro nº 4 do briefing com cor no lugar de markdown. Cacheado por ID, que nunca muda — sem invalidação e sem teto, porque o número de entradas é o de pessoas que a sessão viu, não o de mensagens. |
| `AvatarDoAutor` assina sozinho | Componente próprio pela mesma razão do `NomeDoAutor` e do `PontoDePresenca`: se a linha assinasse o autor para pegar a sigla, alguém trocar de apelido re-renderizaria todas as mensagens daquela pessoa na janela — texto, reações e anexos incluídos. O cartão de perfil pendurou nele também: no design o avatar é alvo tanto quanto o nome, e é o maior dos dois. |
| Calha da mensagem em 40px | Era `--vx-avatar-sm` (32). O design usa **40 na timeline e 32 na member list**, e a diferença é deliberada: a timeline é superfície de LEITURA, onde se identifica quem falou de relance rolando; a coluna lateral é índice, onde cabem mais linhas. ⚠ **A assertion de altura NÃO disparou** — as constantes seguem dentro dos 15%. Medido depois: 51 linhas montadas, mediana 40px, 46 avatares e **os 46 com gradiente**. |
| Segunda linha da member list | **`statusTexto` chegava no snapshot desde a fase 5 e NUNCA tinha sido renderizado.** Campo lido, mapeado e nunca desenhado — mesma família do `ehMencao` que passou três fases sem devolver `true`. Agora nome e recado empilham, como no design. ⚠ A altura da linha passa a variar, e isso é permitido AQUI e não na timeline: esta coluna é virtualizada com `estimateSize` por tipo e o snapshot que decide a altura é o mesmo que traz o recado; na timeline a mesma variação moveria a âncora. |
| Arnês mais pobre que o protocolo — 4ª vez | O firehose tinha UM recado repetido (`"focada, volto mais tarde"`, um em seis). Uma amostra de string única não prova truncamento nem o caso longo. Agora seis textos de comprimentos diferentes, um em cada quatro. O padrão já tem nome nesta tabela e continua reaparecendo. |
| Rodapé do anexo | **A mídia aparecia sem nome e sem peso.** O design põe `densidades.png · 284 KB` embaixo de toda mídia — é a informação que decide se vale abrir em tela cheia ou baixar numa conexão ruim. `tamanhoTexto` entrou no `AnexoSnapshot`, formatado na ESCRITA como `createdAtText` (formatar bytes no render multiplicaria um `Intl` por cada re-render da linha mais quente). **Base 1000 e não 1024**: o rótulo é "KB", e 1024 com "KB" faz 284.000 bytes virarem "277 KB", que não bate com o Finder nem com o Explorador. Nome em mono — o alinhamento de extensão ajuda a varrer conversa cheia de anexo. Baixar é real; `alt` é pendência registrada. |
| Cabeçalho do bloco de código | A língua era um selo ABSOLUTO no canto, **cobrindo a primeira linha do código**. O design lhe dá barra própria, com "copiar" do outro lado — e aí ela deixa de disputar espaço e o copiar ganha alvo em vez de a pessoa selecionar o bloco à mão. A caixa fica mesmo sem língua: barra de altura fixa, porque um cabeçalho que aparece e some mudaria a altura da linha conforme o markdown, e numa lista ancorada isso move a âncora por causa de metadado. |
| Divisor de novas mensagens | **Era ACENTO, virou DANGER** — a troca é do design e tem razão: o teal é a cor de "isto está ativo" (canal aberto, servidor aberto, minha reação), e "onde você parou" é um AVISO de posição. O rótulo virou badge com preenchimento tingido; sem caixa, no fim da régua, ele lia como continuação da linha. ⚠ **Usei `--vx-accent-soft` na primeira versão — teal atrás de texto vermelho.** Passou em todas as guardas, porque nenhuma sabe que as duas cores deveriam ser da mesma família. Corrigido com `color-mix` sobre `--vx-danger`, o mesmo mecanismo de `--vx-state-selected` — token novo custaria entrada em `TokenName`, classificação e par de contraste para um preenchimento que só existe atrás deste rótulo. |
| Arnês mais pobre que o protocolo — 5ª e 6ª vez | **5ª: anexo sem `size`**, então a metade direita do rodapé nunca aparecia. **6ª, e é a maior: o corpo das mensagens não tinha MARKDOWN nenhum** — só palavras soltas com uma URL ocasional. Todo o pipeline de `markdown/analisar.ts` (32 testes, cache por conteúdo, três decisões de segurança sobre link) existia, compilava, tinha teste, e NUNCA tinha sido visto na tela. Agora bloco de código, lista, citação, título e ênfase, em frequências primas entre si. Verificado: `ts | copiar` no cabeçalho, `UL` com marcador `disc` e 3 itens, título como `div role="heading" aria-level=4`, e **um único `h1` na página**. |
| Coluna de canais: `+` e ações de linha | **`+` por categoria e convite/tópico por canal, do design.** As duas ações já existiam no menu de contexto, atrás de um clique com o botão DIREITO — a afordância que menos gente descobre. Agora ficam onde a pessoa procura, e o `+` já chega com a categoria decidida. Visíveis no hover, no foco e no canal ATIVO (`:has([aria-current])`, em vez de duplicar o estado num `data-` do pai). `visibility` e nunca `opacity`: com opacidade zero os alvos continuariam recebendo tabulação — numa coluna de quarenta canais, oitenta paradas invisíveis antes do rodapé. |
| A lâmina saiu da coluna de canais também | Mesma barra do rail, e repetir o gesto é o que faz dele assinatura — um indicador que aparece numa coluna só é acidente. ⚠ **A cor difere de propósito:** no rail a barra é de TEXTO (o ladrilho já tem cor própria e a barra precisa contrastar com ele); aqui é de ACENTO no ativo e de texto na não-lida, porque a linha é neutra e os dois estados precisam ser distinguíveis sem ler. É a disciplina de acento — nove lâminas simultâneas já foi defeito real. Medido: ativo em 24px, `rgb(53,194,204)`, opacidade 1. |
| Botão dentro de botão, e `asChild` com dois filhos | **Dois erros meus no mesmo passe, e o segundo só quebraria em runtime.** As ações não podem morar dentro do `<button>` da linha — HTML inválido, o navegador reestrutura a árvore e o clique interno aciona os dois. Pus como irmãs, mas dentro do `ContextMenuTrigger asChild`, que aceita UM filho (`React.Children.only`): compilava e teria quebrado ao abrir o menu. A correção é um wrapper `.linhaDeCanal` que contém o menu e as ações, e que é o alvo do `:hover`. |
| Faixa de voz conectada | **Construída — o design a tem em toda tela com chamada ativa, e não existia.** Havia só o `CartaoDeChamada`, que FLUTUA sobre a coluna de conteúdo; a faixa é outra coisa: mora na coluna, dura o que a chamada durar, e responde "estou conectado onde e como está a linha" sem a pessoa procurar. Fica ACIMA do painel de usuário — o que aparece e some fica mais perto do conteúdo, o que está sempre lá é o chão. Devolve `null` fora da chamada e a linha do grid colapsa sozinha. ⚠ **NÃO assina `falando`**: ele muda dezenas de vezes por segundo e é o store que a lei nº 1 nomeia; uma faixa que piscasse a cada sílaba repintaria o rodapé da coluna. |
| Qualidade de voz, sem inventar milissegundos | ⚠ **O design mostra "Conectado · 42 ms"; o LiveKit não dá milissegundos.** Ele expõe `ConnectionQuality`, que é CLASSIFICAÇÃO (`excellent/good/poor/lost`). Derivar "42 ms" de "good" seria dado falso numa superfície onde a pessoa decide se sai da chamada ou troca de rede. `QualidadeDeVoz` entrou no store, o motor assina `ConnectionQualityChanged` **só do participante local** (a do outro lado é problema dele; mostrar a pior faria o painel acusar a sua rede quando quem está mal é alguém do outro continente), e a faixa diz "conexão ótima/boa/instável/perdida". Estado de CONEXÃO ganha do de qualidade: dizer "ótima" durante uma reconexão é o contrário do que está acontecendo. |
| Três botões por linha de canal | ⚠ **Consequência assumida das ações de linha, e vale saber antes de um servidor grande aparecer.** Cada canal monta agora o botão da linha mais dois de ação — visíveis por `visibility`, mas MONTADOS sempre. Num servidor de 400 canais são 1.200 nós. É a mesma família do `ContextMenu` por linha que foi removido da lista de mensagens, com a diferença de que esta coluna tem dezenas de itens e não dezenas de milhares. **O gatilho já está escrito**: quando a coluna for virtualizada (o `enforcement.md` marca ~200 itens), as ações passam a montar só na linha ativa e na sob o ponteiro. |
| Pastas de servidor no rail | **Construídas, e o protocolo NÃO as tem.** O Stoat guarda ORDEM de servidor em configuração de usuário e nada mais; agrupamento é conceito de cliente. Store local em `store/pastas.ts`, mesma situação de `silencio.ts` (o SDK delega) e `colapso.ts` (preferência de leitura). ⚠ **Não vai no preset**: uma pasta carrega IDs de servidor, que é exatamente a família de dado que o schema foi desenhado para tornar irrepresentável. Medido: fundo em acento a 10%, ladrilho de 40px dentro contra 44 solto (a diferença de tamanho é o que diz "estes pertencem ao grupo"), rótulo em 11px caixa alta, persistido. |
| Pasta por MENU e não por arraste | **Escolha, não preguiça.** O design mostra pastas, não o gesto que as cria. Arrastar é o caminho de todo cliente da categoria e vai entrar — mas é exclusivo de PONTEIRO, e recurso que só existe para quem tem mouse é o mesmo defeito que a auditoria apontou na paleta de comandos. Menu funciona com teclado no primeiro dia; o arraste soma depois. "Desfazer pasta" e não "excluir": os servidores voltam a ser soltos, nenhum sai — quem apaga uma pasta espera perder o AGRUPAMENTO. Pasta que fica vazia deixa de existir sozinha. |
| Dois `asChild` no mesmo elemento — 2ª vez | ⚠ **A armadilha que a member list já tinha registrado, e eu caí nela de novo.** `ContextMenuTrigger asChild` funde os handlers no filho; o filho aqui era o `Tooltip`, que é um `Root` do Radix e não renderiza DOM. Os handlers do menu não pousavam em elemento nenhum: **o botão direito simplesmente não fazia nada, sem erro**. Achado clicando, não lendo. A correção é a mesma de lá — uma ponte com `display: contents`, que não cria caixa e não mexe no alinhamento dos ladrilhos. |
| `Record` exaustivo pegou o modal faltante | O alvo de pasta entrou em `administracao.ts` e o build QUEBROU até `criarPasta` e `renomearPasta` ganharem entrada no mapa alvo→modal. É a mesma mecânica de `ModalId` e `PainelId`, funcionando sem que ninguém precise lembrar. E o formulário é o de categoria reusado — criar e renomear são o mesmo campo de nome, como a união já fazia. |
| `pendente/pendencias.ts` — o registro | **O mecanismo que faz a regra nova custar pouco.** União FECHADA de controle desenhado sem implementação, cada um com `superficie`, `faz` e `depende`. Três propriedades: (1) pendente novo não compila até entrar aqui — mesma mecânica de `ModalId` e `PainelId`; (2) `depende` agrupa a rodada seguinte, dando a ordem de implementação sem reler tela nenhuma; (3) quando a última entrada sair, o módulo vira código morto e o `pnpm utilities` acusa. Clicar num pendente dispara toast `info` dizendo o que ele fará e do que depende — troca "não faz nada" por "diz que ainda não faz". 11 entradas hoje. |
| Composer 1:1 com o design | **Reestruturado: a caixa contém TUDO.** Anexar, campo, seis ferramentas e enviar na primeira linha; faixa de rodapé na segunda. Antes anexar e enviar ficavam fora da borda — e a diferença não é estética: com tudo dentro, o `:focus-within` cobre a superfície inteira que a pessoa está usando. ⚠ **A pilha de altura automática desceu de `.campo` para `.pilha`**: com quatro filhos na linha, empilhar na célula `1/1` sobreporia todos. O teto de 10 linhas mudou de dono junto — agora é o TEXTO que rola, e ferramentas e faixa ficam. Medido: 75 → 121 → 243px, com a pilha travando em 200 e rolando. |
| Os seis alvos do cabeçalho | **Completos.** Tópicos, notificações, fixados, membros, caixa de entrada, busca. Três funcionam (silenciar, fixados, membros) e três são desenho registrado. ⚠ **A busca é CAMPO no design, e aqui é ícone** — um campo onde se digita e nada acontece é pior que um botão que explica. O campo entra junto com o painel de resultados. |
| Faixa do composer dizia a mesma coisa duas vezes | **Achado na verificação em tela.** "Enter envia · Shift+Enter quebra linha" de um lado e "shift + ↵ nova linha" do outro. O design põe ESTADO à esquerda (modo lento, rascunho salvo) e ATALHO à direita. Agora a esquerda mostra "Rascunho salvo" só quando há rascunho — e é verdade, o texto vive no store keyed por canal desde a fase 3. |
| Botão de enviar não está no design | ⚠ **Única divergência 1:1 deliberada, e ela está no código.** A composição do design assume Enter: a faixa dele diz "shift + ↵ nova linha" e não há alvo de envio. Mantive o botão porque sem ele não existe afordância de PONTEIRO nem de TOQUE para a ação mais frequente do app. É uma linha para remover se a decisão for outra. |
| TanStack Virtual + React Compiler | **Resolvido no spike.** Compatíveis: o compiler reconhece `useVirtualizer` e pula a memoização daquele componente (`react-hooks/incompatible-library`), sem crash nem UI velha. O custo — os filhos da lista deixam de ser memoizados — é cortado com `memo` no `MessageRow`. Não trocar por `react-virtuoso`. |
| Licença AGPL-3.0 | **Resolvido.** Uso privado — o dev e amigos, todos com acesso ao repositório, que é o que a cláusula de rede da AGPL pede. Reabrir a questão se o Vortex for exposto a terceiros sem acesso ao fonte. Não é aconselhamento jurídico. |
| Brand assets | **Resolvido.** `brand/` é diretório rastreado deste repo, não submodule: `mark.svg`, `wordmark.svg`, `monochrome.svg` + `generate.mjs`. O `.gitmodules` só tem os três de `web/packages/`. `web-react/` consome daí, como `web/` e `desktop/`. |
| Imagem arm64 do backend | **Não bloqueia nada hoje** — todo o roadmap é front-end. Antes de commitar com a primeira feature que precise de backend: como sair imagem `linux/arm64` de serviço Rust forkado. O truque do `$BUILDPLATFORM` que salva o cliente web não transfere para Rust. Ver § Divergência de produto. |
| Monitor acima de 60Hz | **Dado chegou, e a resposta é "não vira critério agora".** A distribuição por refresh que faltava está medida: **94,6–94,7% dos frames num intervalo único** nas três janelas limpas, com p95 em 1,97× o refresh. O orçamento de 6,3ms é respeitado pela esmagadora maioria dos frames, e os 5% restantes são a cauda de append que já tem linha própria nesta tabela. Reabrir se a cauda crescer. |
| Carregamento progressivo (janela deslizante) | **Medido: não resolve o gate.** Semear 1.000 em vez de 10.000 baixou o custo de publicação de 0,57ms para 0,12ms por frame — confirmando que a cópia do array de IDs é O(total) — e o p95 **não se moveu**: 18,7ms nas duas. Logo o driver do gate é custo por frame na janela visível, não o tamanho da lista. Continua valendo como feature por outro motivo: memória de sessão de 8h, `measurementsCache` limitado, e o erro nº 5 do briefing. Não como conserto de performance. |
| `pnpm gate` NÃO constrói | **Armadilha do arnês, já mordeu.** O script mede o que estiver servido em `localhost:4174` — não roda `pnpm build` e não sobe servidor. Rodá-lo depois de mexer no código, sem construir antes, APROVA O BUNDLE ANTERIOR e o relatório parece legítimo. Aconteceu: uma corrida reportou `estimando 73px` com a fonte já em 76. Construir antes de medir, sempre. |
| Vazão real do firehose | **Resolvida, e virou critério.** Ela era só reportada; agora corrida que entrega menos de 90% da carga pedida é **INVÁLIDA** — nem PASS nem FAIL. O piso saiu dos dados: máquina limpa dá 93–98%, sob um jogo em cinco núcleos deu 83–87%, e o corte cai no vão. O briefing já dizia isso em prosa desde a fase 3; faltava alguém fazê-lo falhar. |
| Cauda do frame de append | **Sem alavanca que o instrumento consiga validar.** Duas das três listadas foram feitas — estimativa por tipo e, indiretamente, menos trabalho por linha com o menu no nível da lista. A terceira (`overscan` menor) não é testável: o app está em 1,2–1,5% sob CPU 4x contra teto de 5%, e em **0,1% em display real** contra teto de 1%. Com 3–4× de folga e espalhamento de 0,5pp entre corridas, o gate não tem resolução para ver efeito de micro-otimização. Reabrir quando algo aproximar o patamar do teto — não antes. |
| Estimativa de altura de linha | **Corrigida.** `estimateSize` passou de 44px, que nunca foi medido, para 73px — a altura real medida no arnês é 72,6px. Não acelerou nada (o p95 não se moveu), e a razão de ficar é outra: a estimativa antiga errava ~38px por linha, o que faz a barra de rolagem mentir sobre o tamanho do histórico e dá trabalho de compensação ao virtualizador a cada rolagem. Correção de correção, não de performance. |
| Reconciliação por nonce | **Resolvida, e era a peça que o briefing dizia poder arruinar o port.** A otimista nasce com ID local, a confirmação vem com o do servidor, e trocar a chave desmonta a linha debaixo do virtualizador. Estratégia: **o ID local continua sendo a chave para sempre**, o do servidor vira apelido. Doze testes; o crítico verificado por mutação (sem reconciliação a mensagem duplica). Duas descobertas só possíveis construindo: a otimista reconciliava CONSIGO MESMA e a linha nunca entrava na lista; e faltava a metade da leitura — depois da confirmação quem o servidor atualiza é o objeto dele, então o apelido precisa ser resolvido na leitura, com sinal do Solid para o efeito acordar. |
| Mídia na linha | **Resolvida.** Espaço reservado a partir do metadata do protocolo (`width`/`height`), antes do primeiro byte. **A primeira versão não reservava nada:** `max-inline-size` é teto e não tamanho, e a caixa media 0×0 enquanto a imagem não chegava — pior que não ter reserva, porque parece resolvido. A largura sai de um `min` de três termos, e o terceiro segura imagem alta. Medido com as imagens SEM carregar: 1600×900 → 400×225, 800×800 → 340×340, 600×1600 → 128×340. A altura do anexo entrou na estimativa como CÁLCULO exato, não estimativa. |
| Caminho REATIVO da ponte, sem teste até agora | **Resolvido, e era um buraco.** Em Node o `solid-js` resolve para `dist/server.cjs` — o build de SSR, onde `createEffect` é **no-op por design**. Medido com um `createSignal` simples: o efeito não rodava nem uma vez. Metade da ponte `stoat.js → React`, a metade que é a razão de o adapter existir, nunca esteve sob teste e silenciosamente não podia estar; tudo passava pelo caminho de evento (`client.on`) e pelas leituras ansiosas. Corrigido com `ssr.resolve.conditions` no `vite.config.ts` — mexer no `resolve.conditions` do topo derrubaria a condição `production` do build real. Nenhum teste existente quebrou quando a reatividade acordou. |
| Testes do caminho reativo em `members` e `messages` | **Agora possível, e ainda não escrito.** Os efeitos desses dois stores nunca foram exercitados por teste — o que passava era a leitura ansiosa no momento da subscrição. A sala de voz já tem os seus (`voz.test.ts`, verificados por mutação); os outros dois merecem os mesmos. |
| Login e sessão | **Construídos, e a ressalva ENCOLHEU ao ser verificada.** Portão antes do shell, restauração na abertura, `logout` do servidor ouvido, tela de entrada com os oito estados. Eu disse que `client.login()` nunca rodaria; ela roda — submeter contra a ausência de servidor exercita a chamada e a falha de rede volta traduzida. **Falta só o caminho de SUCESSO e os ramos 401/429/5xx contra servidor real** (a tradução deles tem teste; a resposta deles, não). Treze testes cobrem o entorno: JSON corrompido vira ausência, armazenamento bloqueado não derruba sessão viva. |
| Token em `localStorage` | ⚠ **Decisão de segurança tomada, e vale reabrir se o Vortex sair do uso privado.** Um XSS vira roubo de conta: o token É a credencial, e o app renderiza conteúdo escrito por qualquer pessoa. Alternativas não existem para SPA puro — cookie `httpOnly` exige o backend emiti-lo e o protocolo entrega token no corpo; `sessionStorage` perde sessão por aba; memória obriga login a cada F5. A defesa real é não dar o XSS (nada de `innerHTML` com conteúdo de terceiro, CSP sem `unsafe-inline`). Com backend próprio, cookie `httpOnly` é a melhora. |
| Estimativa de altura por TIPO de linha | **Resolvida, e virou assertion.** Medido: 92,5px abre grupo · 60,6px continua · 37,1px sistema. A constante única de 78 superestimava a continuação em 30% e a de sistema em mais do DOBRO. O gate não decide se ajudou (1,2% → 1,5%, faixas sobrepostas, espalhamento da ordem da diferença) — fica por CORREÇÃO, como o 44 → 73. E o número já se moveu quatro vezes com alguém lendo relatório; agora uma assertion em dev nomeia o tipo que mudou de forma. ⚠ Depende da LARGURA da coluna: no painel de 538px as mesmas linhas dão 143 e 83px. |
| Teste de navegador | **vitest instalado**, 19 testes cobrindo store, adapter e toast. Falta runner de NAVEGADOR: jsdom não tem engine de layout, então âncora, remedição e o firehose seguem medidos à mão no arnês. O `web/` já usa Playwright — é o candidato natural. |
| Assertions que só o navegador exercita | A de `getSnapshot` estável agora tem teste e dispara nos quatro casos. Faltam duas, e as duas dependem de layout: **remedir após resize** e **linha medindo 0px**. jsdom não serve — é o mesmo motivo pelo qual a âncora vive no arnês. Vão junto com o runner de navegador. |
| Reconexão e sessão longa | **Reconexão resolvida; sessão de 8h continua aberta.** A faixa traduz os três estados do SDK nas três respostas da interface, com a assimetria que a torna útil: avisar espera 1,5s, parar de avisar é imediato. Ela FLUTUA — faixa no fluxo mudaria a altura do container da lista, que é a âncora se movendo por causa de um aviso; medido em 710px com e sem. O vazamento de 8h só é medível em horas e segue sem medição. |
| Firehose depois da fase 3 | **Rodado. Passa sem throttle, reprova sob CPU 4x.** Sem throttle, mediana de 3 janelas: p95 6,4ms (1,05× o refresh), 98,1% dos frames em um intervalo, **0,1% de frames perdidos contra o teto de 1%**, zero long tasks, vazão cheia de 500 ev/s — e espalhamento de 0,1% a 0,1% entre janelas. Sob CPU 4x fica em ~6% contra o teto de 5%, e ali a vazão do próprio gerador cai para 441/500. A fase 0 media 2,9% sob 4x com uma `MessageRow` que era um `<article>` de className estática — sem agrupamento, divisor de data, estado de envio, menu, composer ou colunas laterais. Parte da diferença é o produto existindo; quanto exatamente, só um A/B com mediana de 3 janelas responde. |
| Menu de contexto no nível da lista | **Resolvido, e é o primeiro A/B de performance deste projeto que separa limpo.** Era um `ContextMenu` do Radix por linha — Root, Trigger, Portal, Content — com linha montando e desmontando na velocidade do scroll. Agora é um Root para a lista, alvo em store module-level, e a linha só diz quem é. Mediana de 3 sob CPU 4x: **1,7% → 1,2%**, e o que decide não é a mediana — **as faixas não se sobrepõem**, as três corridas novas ficam abaixo das três antigas. O A/B anterior (6,0% → 5,4%) foi medido com o estimador de refresh quebrado. |
| Custo de pintura | **Hipótese refutada.** Ela nasceu de 0,4–0,5% em headless contra 5,4–6,3% em display real, atribuídos a rasterização. Medido agora em **display real, build de produção**: p95 de 6,4ms (1,02× o refresh), **0,1% de frames perdidos**, 99,9% dos frames num intervalo único, zero long tasks — contra o teto de 1% da condição sem throttle. Os 5,4–6,3% eram instrumento: estimador de refresh quebrado, vazão degradada e máquina disputada. Pintura não é problema mensurável aqui, e isso encerra junto a reabertura da máscara do ponto de presença. |
| Auditoria de design da fase 5 | **Rodada, com relatório.** Nota 25/40 e quatro P1, todos fechados: ritmo de agrupamento em 0px (`py-0.5` não emitia CSS), overlay de modal medindo 0×0 (`inset-0` idem), cor de cargo sem clamp, itens de menu inertes. Os P2 de paleta também: rampa, disciplina de acento e classificação de tokens. O que sobrou da auditoria e NÃO foi feito está nas linhas próprias desta tabela, cada um com a medição que decidiu. Retrato persistido em `.impeccable/critique/`. |
| Assertion de 0px em painel colapsado | **Corrigida em parte, e o resto é transiente.** A coluna de membros colapsa a `display: none` por container query em 768px, e a lista continua MONTADA ali dentro: sem caixa, tudo mede 0 e a assertion acusava dezenas de linhas quebradas num painel invisível. Agora ela exige `offsetParent` — o teste certo, porque distingue NÃO RENDERIZADO de renderizado com zero, e só o segundo é bug. Sobram **2 por ciclo de colapso**, no quadro em que o painel reaparece antes de o `ResizeObserver` remedir. Perseguir isso significa embrulhar o `measureElement`, que desregistra a observação do TanStack — risco maior que o ruído. |
| Especificidade — "intercambiável no essencial" | **Uma das duas candidatas fechada.** O veredito da auditoria não é item de lista, e a resposta é decidir o que o Vortex faz que o Discord não faz. **Leitura como posição** ganhou a terceira perna: ir para a próxima menção, com a menção renderizada e a linha destacada. A outra candidata — a sala de voz como LUGAR — segue parcial: ela mostra quem está dentro antes de entrar, e falta ouvir de fato (`@livekit/components-react`, sem fork de backend). |
| Menção nunca exercitada | **Resolvida, e era um buraco de três fases.** `ehMencao` existe no adapter desde a fase 3, com contador de canal e de servidor por trás, e NUNCA devolveu `true`: nenhum corpo gerado pelo firehose continha `<@id>`. O badge de menção jamais tinha sido visto nesta interface. Uma mensagem em 31 passa a mencionar você, e foi só com dado real que apareceu o resto — menção crua na tela em três superfícies, e a primeira versão de `proximaMencao` cega para o histórico semeado. |
| Medida de leitura | **Resolvida.** No teto de 1100px uma linha de 14px cabia ~155 caracteres, contra a faixa confortável que termina em 75 — a causa do "bloco indiferenciado" que a auditoria descreveu. `--vx-medida` governa o texto e `--vx-message-max-w` continua governando a coluna. Medido: 80 caracteres em janela de 2400px, com a coluna em 1100px exatos. Em `rem` e não em `ch`, porque `ch` depende da fonte de quem consome — o mesmo token dava 521px no parágrafo e 595px no divisor. |
| Ruído de `flushSync` no console | **Avaliado, e fica.** A auditoria apontou avisos em nível de `error` que não são erro. São do React, sobre uma escolha DELIBERADA e medida: `useFlushSync: false` faz o `scrollToEnd` inicial parar ~1000px atrás do fim e a lista derivar ~880px/s. Silenciar aviso de terceiro por filtro de mensagem esconderia um `flushSync` de verdade um dia. O que a auditoria realmente apontava — erro de verdade afogado em ruído — era a assertion de 0px, que eram erros DO PROJETO, e essa foi consertada. |
| Barra de ações no hover | **Resolvida.** Era a nota mais baixa da auditoria (2/4 em "reconhecer > lembrar"): reagir só existia pelo botão direito, num menu de onze alvos. Cinco alvos flutuando, e ela SOBREPÕE em vez de reservar espaço — mudar a altura da linha no hover destrói a âncora. `visibility: hidden` e nunca `opacity: 0`: o segundo somaria cinquenta mil paradas de tabulação invisíveis numa lista de dez mil linhas. É afordância de PONTEIRO; o teclado continua no menu de contexto. |
| `error` como estado | **Resolvida onde já pode acontecer hoje.** `error` existia em UM lugar contra `empty` em cinco. Sem rede, a falha real é outra: um painel que lança leva o shell junto — e isso desmente a lei nº 6, porque a independência dos slots era só de posição. Limite de erro por painel, chaveado pelo `PainelId`. A mensagem do erro NÃO vai para a tela: é escrita para quem programa e no caminho de render pode carregar conteúdo de terceiro. É a única classe do projeto, e não por gosto — `componentDidCatch` só existe em classe. |
| Acessibilidade da auditoria | **Três resolvidos.** Nenhum container rolável tinha `tabIndex`, e rolável sem foco é inoperável por teclado. Cabeçalho de seção levava `role="listitem"`, então o leitor anunciava "item 1 de 40: fundação" e a contagem incluía títulos. O campo da paleta tinha `outline: none` — o argumento do transbordo era verdadeiro, mas `outline-offset: -2px` resolve o transbordo sem tirar o anel. |
| Atalhos descobríveis | **Resolvida.** A tese é "teclado é a navegação primária", a paleta existe desde a fase 5, e nada na tela contava. Botão no cabeçalho da coluna de canais — de verdade, não texto de dica, porque isso conserta junto o recurso ser inalcançável em toque. A tecla é escrita como a plataforma a chama (`⌘K` no Mac): mostrar "Ctrl" a quem usa Mac ensina o atalho errado, e quem tenta e não funciona não tenta de novo. |
| Não-lida de servidor invisível | **Resolvida.** `data-naolidas` era escrito no botão do rail e nenhuma regra o lia. Mesmo tratamento da lista de canais, com a lâmina na mesma escala de três degraus — que ela sirva às duas colunas sem uma linha de exceção é o argumento a favor de tê-la tornado estado nomeado. |
| Leitura do `--vx-accent-soft` | **Resolvida, e era só o comentário.** Ele dizia "menção, chip, destaque de linha": três usos, um inexistente e dois que não são os que existem. Os seis reais dizem a mesma coisa — "o acento encostou aqui" — e nenhum alvo tem dois deles disputando. Menção NÃO passa a usar: pela decisão da fase 5 ela é contagem, não posição. |
| Gate depois do passe de design e do de produto | **PASS a 2,1%, com 0,6pp de custo assumido.** Mediana de 3 sob CPU 4x, máquina limpa: 2,1% · 1,9% · 2,3% de frames perdidos contra teto de 5%. A linha de base antes do passe de design era 1,5% (1,7 · 1,7 · 1,9), e o menu no nível da lista a baixou para 1,2%. O que subiu de volta foi o passe de produto — menção renderizada, linha destacada, botão de próxima menção —, e o custo é real: as faixas não se sobrepõem. **Aceito com 2,4× de folga contra o teto**, e a caça foi encerrada por resolução: um caminho rápido para a mensagem sem menção não moveu nada (2,2% → 2,1%) e foi removido, porque código que não se paga é ruído. |
| Estimador de refresh do arnês | **Resolvido.** Ele estimava o intervalo de vsync pelo 1º PERCENTIL dos deltas sob carga, e devolveu 4ms num display de 164Hz — impossível. A falha foi de premissa: o percentil resiste a UM outlier, e ali havia uma rajada. Agora o intervalo é a mediana do balde mais baixo que segura ≥2% das amostras — "o menor valor ONDE OS FRAMES POUSAM". Cinco testes, com o caso real entre eles, verificados por mutação. E `subIntervalo` passou a contar os deltas fisicamente impossíveis: corrida estranha agora se explica sozinha. |
| Gate reprovando a MÁQUINA | **Resolvido, na segunda tentativa.** Uma corrida deu FAIL com 6,6% e vazão de 414/500 enquanto um jogo consumia **512% de CPU** — nada daquele relatório era sobre o código. A primeira guarda exigia que ≥85% dos frames EM REPOUSO caíssem num intervalo único: premissa boa para display real e falsa para headless, que não tem display e tem cadência ociosa naturalmente irregular. Numa máquina com **13% de carga total** ela reprovava com 46% — falso positivo puro, e exatamente o que faz alguém desligar uma guarda. A certa mede TRABALHO FIXO: a vazão que o gerador entregou. Piso de 90%, tirado dos dados — máquina limpa dá 93–98%, sob o jogo deu 83–87%, e o corte cai no vão. |
| Escala de z-index sem token | **Resolvida.** Havia `39` ao lado de `40` em arquivos diferentes, e nada dizia qual vinha na frente sem abrir os dois. Nomeados por PAPEL: `realce · alca · veu · sistema · flutuante`. "Qual número é maior" é a pergunta errada; "o quê fica na frente do quê" é a certa. O `pnpm utilities` se pagou aqui — `--z-index-*` não é namespace reservado do Tailwind, e sem a guarda não haveria como saber se `z-flutuante` chegaria à folha. |
| Valores fora de escala em CSS Module | **Resolvida, das duas pontas.** O padrão era o mesmo nas ~8: alguém precisou de menos que `--vx-space-1` e escreveu `2px` cru porque o meio-degrau não existia. `--vx-space-0` e `--vx-radius-0` passaram a existir — legitimar é melhor que proibir aqui, porque empurrar para 4px dobraria um recuo desenhado para sumir. `pnpm escala` impede o nono, e confere PROPRIEDADE e não valor: `inline-size: 288px` num hover card é a largura do componente, não valor mágico. Verificada por mutação. |
| Patamar de CPU 4x em ~6% | **Vencida — o número era do instrumento, não do app.** Com o estimador de vsync consertado, a guarda de vazão em vigor e a máquina limpa, a mediana de 3 sob CPU 4x dá **1,7% · 1,7% · 1,9%** contra teto de 5%, com espalhamento de 0,2pp. O patamar de ~6% foi medido em corridas onde o gerador entregava 83–87% da carga e o estimador de refresh estava quebrado. Não havia regressão a explicar. |
| Apelido por servidor na member list | **Resolvido.** A chave virou `ChaveDeMembro` — tipo MARCADO, não string composta: passar um ID de usuário onde se espera chave de membro não compila (provado com arquivo-sonda). Destravou apelido, cor de cargo e castigo de uma vez. |
| Categorias de canal | **Resolvido.** A coluna deixou de partir por TIPO — que era placeholder — e passa a usar `server.orderedChannels`. Colapso persistido em store LOCAL, nunca no preset: ID de categoria é dado de servidor, a mesma família que o schema do preset torna irrepresentável de propósito. Arrastar-e-soltar fica para a fase 6: reordenar ESCREVE no protocolo. |
| Semear não-lidas no `Ready` | **Resolvida.** O adapter incrementava `+1` por evento e nunca consultava o servidor; agora semeia de `ChannelUnread.lastMessageId` + `messageMentionIds` e escreve de volta com `ack` ao marcar lido — sem isso a leitura era local, e ler no desktop não movia o celular. A imprecisão é assumida e dita: 1 significa "existe", não "uma", porque o cliente não tem o histórico entre o cursor e o fim; menções ele sabe exatamente, porque vêm por ID. Três testes, verificados por mutação. **O arnês estava mais pobre que o protocolo** — o firehose criava canais sem `lastMessageId` e a semeadura era intestável. |
| Seções de cargo na member list | **Resolvido** (1598a096). Lado online seccionado por cargo hasteado em ordem de rank, sem-cargo por último, offline num balde só. Não briga com os dois baldes: cargo não pisca. |
| Campos de protocolo ainda ignorados | **Sobrou um: `banner`**, que precisa de uma superfície de perfil de servidor que não existe. `muted` entrou — e o SDK não tem escrita para ele, porque DELEGA: `channel.muted` é pergunta que o app responde pela opção `channelIsMuted`. Silenciado apaga o realce e mantém a contagem. `havePermission` virou regra, com a republicação de snapshot que a faz chegar nas linhas. |
| Cor de cargo sem clamp | **Resolvida.** Era o último furo da garantia de contraste: o cargo colorido vem do servidor e ia direto ao DOM por `style`, onde o `pnpm contrast` não podia vê-lo porque não é token. Medido antes, no navegador: **22 de 22 nomes reprovavam 4,5:1 no tema claro**, pior 1,33:1. Agora matiz e croma são do usuário e a LUMINOSIDADE é do app, como em `derivar.ts` — medido depois, claro pior 7,77:1 e escuro pior 8,60:1, zero reprovando. Varredura em teste de 24 matizes × 4 cromas × 2 modos × 4 superfícies, verificada por mutação. |
| Itens de menu inertes | **Resolvidos, e virou lint.** `Copiar texto`, `Editar` e `Apagar` ficaram meses no menu de mensagem sem `onSelect`: apareciam, recebiam foco, fechavam o menu e não faziam nada. Copiar existe agora; as outras duas escrevem no protocolo e voltam na fase 6. `no-restricted-syntax` reprova `ContextMenuItem`/`DropdownMenuItem` sem `onSelect`, `disabled` ou `asChild` — provado com arquivo-sonda. |
| Regra de CSS Module sem consumidor | **Resolvida.** O `pnpm utilities` conferia `className` que não produz CSS e não o inverso. Agora faz os dois, resolvendo quem importa cada módulo e com que alias. **Ele mesmo precisou de mutação duas vezes**: a primeira versão varria `.module.css` numa lista que só tem `.tsx` (laço rodava zero vezes e relatava sucesso); a segunda conferia só o TSX irmão e acusou de morta a `.coluna` usada de `App.tsx` — justamente a regra do `block-size: 100%` sem a qual o virtualizador monta as dez mil linhas. Três órfãs reais saíram. |
| Token sem classificação de contraste | **Resolvido.** A auditoria perguntou por que `--vx-border-subtle` não estava na lista de pares. A resposta era boa e não estava escrita: token ausente de propósito e token esquecido são indistinguíveis olhando. `SEM_PAR` guarda o motivo e um teste exige que todo token esteja num dos dois lugares, **nos dois sentidos** — motivo que sobrou também reprova. Pegou meu erro na primeira execução. |
| Peso óptico dos semânticos | **Medido, e não vale fazer.** `--vx-success` aparece SÓ no arnês de desenvolvimento, `--vx-warning` em dois ícones de castigo, `--vx-danger` em dezesseis lugares do produto. Diferenciar peso entre os três seria trabalho sem nada na tela para mostrar. Reabrir quando `success` tiver um consumidor de produto. |
| Toast de erro expirando | **Resolvido.** Cinco segundos é o tempo de confirmar um acerto e o errado de relatar um erro — e aqui era literal, porque o toast de falha ao copiar carrega o texto que a pessoa precisa selecionar à mão. Erro agora não some sozinho. No mesmo passo: `relative` no Root (o `Close` era `absolute` sem contexto e ancorava na viewport) e o rótulo da região, que anunciava `"Notifications (F8)"` — o default do Radix, num app em português. String que só leitor de tela lê não aparece em revisão de tela nenhuma. |
| Rampa de superfície achatada | **Resolvida.** Quatro superfícies somavam 1,368:1 no escuro e 1,137:1 no claro de ponta a ponta, e no claro os degraus ENCOLHIAM a cada passo. Agora passo constante em ΔL — o certo, porque em OKLCH o L é perceptualmente uniforme. **A direção foi ditada pelo orçamento:** uma sonda rankeou os pares por folga, e ela disse que no escuro subir a superfície de topo era caro (`text-3/surface-3` a 1,11×) e abrir para baixo quase de graça. Escuro 1,075 · 1,105 · 1,152 → 1,09 · 1,14 · 1,15; claro 1,060 · 1,040 · 1,031 → 1,081 · 1,069 · 1,067. |
| Disciplina de acento | **Resolvida.** Nove lâminas de acento na tela ao mesmo tempo, sete delas tocos permanentes de item NÃO ativo — os consumidores pintam `color: var(--vx-accent)` e o toco herdava junto. O toco ficou neutro e o hover ganhou o degrau do meio. Acento na tela: 9 → 2, o servidor ativo e o canal ativo. |
| Superfícies que não existem | **Mapeadas, e o buraco é maior do que "algumas telas".** Contra o upstream: 59 modais de produto contra 0 (o `Dialog` da fase 2 tem um consumidor, a paleta), 42 páginas de configuração contra 0, 12 fluxos de autenticação contra 1. Duas ausências ESTRUTURAIS gateiam metade do resto: não há **router** (logo convite por link, permalink de mensagem e deep-link do Electron são irrepresentáveis, não difíceis) e não há **região Home** (logo DM, grupo, amigos e o `+` de criar servidor não têm onde morar). Criar servidor, tela de chamada e perfil aberto — os três que quem usa citou — caem cada um numa dessas classes. Ver `superficies-ausentes.md`. |
| Markdown na linha | **Resolvido — era o item mais básico que faltava, e não estava no mapa de superfícies.** `ParteDeMensagem` era `texto | mencao`, então `**negrito**` chegava à tela com os asteriscos e link não era link. Agora `markdown/analisar.ts` traduz para árvore de domínio (`BlocoDeMensagem`/`TrechoDeMensagem`), com **cache por CONTEÚDO** — sem ele seria o erro nº 4 em lugar novo, porque `toMessageSnapshot` roda de novo a cada layout, envio, permissão e reação. Chave é o texto: mensagem editada troca de chave sozinha, e "ok" de trinta pessoas divide uma árvore. Teto de 2000 entradas, senão é o erro nº 5 com outra roupa. 32 testes; as duas guardas verificadas por mutação. |
| Markdown é conteúdo de TERCEIRO | ⚠ **Três decisões de segurança, não zelo abstrato:** o token mora em `localStorage`, então XSS aqui é roubo de conta. (1) Só `http:`, `https:` e `mailto:` viram link — `javascript:` e `data:` viram o texto que o autor escreveu, nunca somem. (2) `new URL` **sem base**: com base, `/qualquer-coisa` resolveria e passaria como link para lugar diferente do escrito. (3) Imagem de markdown vira LINK, nunca `<img>` — `![](url)` faria o navegador buscar a URL sozinho na máquina de quem abrisse o canal, entregando IP sem clique nenhum. HTML cru vira texto. Verificado no build de produção: zero `<img>`, `rel="noopener noreferrer"`. |
| `list-style` zerado pelo preflight | **Achado só olhando a tela, e é a família do `py-0.5`.** A lista renderizava com recuo e SEM marcador — "1. um / 2. dois" virava duas linhas soltas. O `escala`, o `utilities` e o `check` inteiro passaram verdes; a regra estava escrita e a tela estava errada. `ul.lista`/`ol.lista` com `list-style` explícito. Medido depois: `disc` e `decimal`. |
| Condição de resolução vs. ambiente do teste | **A armadilha que mais custou nesta etapa, e as duas saídas "mais limpas" eram piores.** `ssr.resolve.conditions: ["browser"]` existe para o `solid-js` do teste não ser o de SSR; com o markdown, o `decode-named-character-reference` passou a tocar `document` no escopo do módulo e **quinze suítes que nada têm com markdown quebraram no mesmo `import`**. (1) `environment: "jsdom"` foi PIOR: o Vitest troca o pipeline de transformação, a condição para de valer e o Solid volta a ser o de servidor — `fixadas`, `reacoes`, `reconciliacao` e `voz` falharam, ou seja, o conserto desfazia em silêncio o conserto que devia preservar. (2) Alias nominal não é consultado: o Vitest EXTERNALIZA `node_modules`. Fica um `document` global em `src/testes/documento.ts`, e só isso. |
| Gate depois do markdown | ⚠ **NÃO medido validamente, e o guarda é que impediu.** Uma corrida deu PASS a 4,2% contra teto de 5%, com vazão de 452/500 (90,4%) — válida por um fio. As três seguintes deram **CORRIDA INVÁLIDA** a 86–87% de vazão, com um jogo (`deadlock`, 5,3 GB) mais Spotify, Discord e Radeon Software na máquina: exatamente a faixa que esta tabela já registra para "sob jogo". O patamar anterior é 2,1%, então **4,2% não pode ser lido como regressão nem como aprovação** — foi medido em máquina disputada. Refazer mediana de 3 com a máquina limpa antes de seguir para a etapa 1.2. |
| Router, e navegação como união marcada | **Resolvido, e era o que tornava três coisas IRREPRESENTÁVEIS — não difíceis.** `navegacao.ts` era duas strings, e duas strings não dizem "estou na casa": `servidorAtivo === ""` era ausência de lugar, não um lugar. Virou `Local = casa | servidor | dm`. A URL é **projeção**: o store continua sendo a fonte e `popstate` só chama os mesmos setters que o rail chama. **Sem biblioteca** — três formas de caminho contra um store que já existe não pagam um segundo dono do estado. O laço se fecha por comparação de caminho, não por flag: aplicar o que já vale não emite, então não há o que escrever. Medido em navegador: clicar num canal troca a URL, `voltar` e `avançar` acertam os dois lados. |
| Permalink de mensagem | **Resolvido, e quebrou uma premissa que estava certa até aqui.** "Sem ouvinte é no-op" valia enquanto todo pedido nascia de um clique — se ninguém ouve, ninguém pediu. Abrir `/servidor/A/canal/B/01MSG` pede o salto quando a rota é lida, e a lista daquele canal ainda nem montou: o link abriria o canal certo na posição errada, sem erro nenhum. Gaveta de pendentes por canal, consumida uma vez (guardar depois de entregue faria o salto repetir a cada remontagem, e trocar de canal remonta). Cinco testes, verificados por mutação. Medido: de 783.662 para 39.697 de rolagem, com a mensagem alvo na tela. |
| Registro de modais | **Resolvido, com consumidor real em vez de andaime.** O upstream tem 59 modais e o `Dialog` da fase 2 tinha UM consumidor. `ModalId` é união fechada e o registro é `Record<ModalId, ComponentType>` — modal novo não compila até ser registrado, mesma mecânica de `NOME_DO_PAINEL` sobre `PainelId`. A paleta migrou para ele e o `store/paleta.ts` encolheu para só a tecla, o que **removeu** um store bespoke em vez de acrescentar um. Um modal por vez, de propósito: pilha de modais é a tela com três véus onde `Esc` fecha um e ninguém sabe qual. O `PainelDeEdicao` NÃO passa por aqui — ele não prende foco e existe para mexer no que está atrás. |
| Primitivos de formulário | ⚠ **Entregue PARCIAL, e a redução é deliberada — o plano previa 11 e a inspeção derrubou 10.** Só o `Campo` tinha consumidor hoje (a tela de login, duas instâncias). Dois achados: (a) a paleta **não** devia usá-lo — o campo dela é barra de busca sem borda e corpo maior, e unificar faria a paleta parecer formulário dentro de um painel flutuante; (b) a família `--vx-field-*` que o plano pedia **não precisa existir** — `surface-0`, `border-subtle`, `accent` e `danger` cobrem os cinco estados, e token novo exigiria par de contraste novo por nada. Switch, radio, tabs, avatar, progress e separador ficam para a primeira superfície que os use: construí-los agora é o "scaffold ahead" que o `pnpm utilities` existe para pegar, e é o mesmo argumento que mantém o composer em textarea. |
| `client.login()` quebrado | **Resolvido, e a pendência anterior estava otimista.** Ela dizia que faltava "só o caminho de SUCESSO contra servidor real"; o caminho de sucesso estava QUEBRADO no SDK — `login()` não chama `#updateHeaders()`, não chama `connect()` (a linha existe comentada com `// TODO`) e lança a string crua `"MFA not implemented!"`. O resultado aqui: `entrar()` lia `client.user?.id`, achava `undefined` porque sem `connect()` não há `Ready`, e caía no ramo "o servidor não disse quem você é". Agora é `POST /auth/session/login` direto, com os três resultados do protocolo. **E `useExistingSession` tinha metade do mesmo furo**, que ninguém tinha notado: restaurar sessão guardada abria o app com socket FECHADO. 14 testes com o `client` dublado; o de `connect()` verificado por mutação. |
| Segundo fator e conta desativada | **Construídos, e os dois eram buracos com forma diferente.** MFA: laço de `POST` com `mfa_ticket`, métodos traduzidos (`Password|Recovery` não sai do adapter), e o bilhete guardado module-level porque é dado de PROTOCOLO, não domínio. ⚠ Dois defeitos meus, pegos escrevendo o teste: `entrando()` e `erro()` durante a verificação trocam o estado que o portão usa para escolher a tela — a pessoa apertaria "Verificar" e veria o formulário de e-mail voltar, sem erro nenhum. Virou `ocupada` separada do estado, e `precisaDeMfa(metodos, {motivo})`. `Disabled` é estado próprio: o upstream responde a ele com `alert("run special logic here")`. |
| Portão de sessão sem exaustividade | **Resolvido, e o mecanismo se provou na hora.** Era `if`/`else`: `desconhecida` dava `null`, `dentro` dava o app, e TODO O RESTO caía no login. Virou `Record<EstadoDaSessao, () => ReactNode>` — e ao acrescentar `nome` o build QUEBROU até a tela existir, que é exatamente o que se pede dele. Sem isso, `mfa`, `desativada` e `nome` teriam caído calados na tela de senha. |
| Autenticação: as 11 telas que faltavam | **Oito construídas, três adiadas com razão.** Criar conta, conferir e-mail (com reenvio na MESMA tela — o upstream separa em duas e cobra), recuperar senha, redefinir, verificar, segundo fator, conta desativada e escolher nome. Sem elas o app só servia a quem já tinha conta feita por outro cliente. **Onboarding usa duas rotas que NÃO existem no SDK** (`/onboard/hello` e `/onboard/complete`), chamadas cruas — e vem ANTES de `dentro`, senão o app inteiro pisca para ser substituído. As rotas `/verificar/:token` e `/redefinir/:token` não são conveniência: link de e-mail é URL, e sem elas o clique abriria a tela de senha e o token se perderia em silêncio. O e-mail NÃO entra na URL — barra de endereço fica em histórico, log de proxy e print de tela. ⚠ **Adiada:** a lista de dispositivos, que mora em configurações (etapa 5). |
| TOTP e captcha, FORA por decisão | **Não são pendência, são escopo recusado, e os dois têm consequência dita.** ⚠ **TOTP:** `MetodoDeMfa` perdeu a variante, e a remoção quebrou o build em cinco pontos até cada um ser tratado — o mesmo mecanismo que pegou `mfa` e `nome` no portão. Sobram senha e código de recuperação; **`recuperacao` fica de propósito**, porque é a única saída de quem tenha ativado o autenticador por OUTRO cliente. Desafio só de TOTP cai no ramo de lista vazia e a tela DIZ que este cliente não usa o método, em vez de mostrar um campo inerte — com teste. ⚠ **Captcha:** o protocolo aceita o campo e o upstream monta um hCaptcha invisível em toda tela de conta. Aqui não entra: instância privada, quem entra tem acesso ao repositório, e o custo seria dependência nova mais chamada a domínio externo numa tela de senha. **Consequência:** com `captcha` LIGADO no servidor, criar conta e recuperar senha voltam 400 — o caminho é desligar lá. |
| Persistência de sessão nunca exercitada | **Achado consertando outra coisa.** Não havia `localStorage` no ambiente de teste, e `store/sessao.ts` embrulha todo acesso em `try/catch` de propósito — então **todo caminho de escrita caía direto no `catch`** e os testes concordavam sem nunca terem guardado nada. Apareceu quando `restaurarSessao` passou a ser testada de verdade: ela lia o token que o teste tinha acabado de guardar e não achava. O `setupFiles` agora instala `localStorage` do jsdom — com `url: "http://localhost"`, porque `about:blank` é origem OPACA e `localStorage` ali lança `SecurityError` (derrubou as 41 suítes de uma vez até eu descobrir). |
| A casa — DM, grupo e amigos | **Construída, e ela destravou quatro superfícies com um botão.** O rail listava SÓ servidores, e essa ausência derrubava DM, grupo, amigos e notas de uma vez. Agora: botão de casa no rail, coluna de conversas ordenada por recência (uma lista só, misturada — é como caixa de entrada funciona; separar por tipo poria a conversa de ontem abaixo de um grupo morto), e a tela de pessoas com quatro abas. `CanalTipo` cresceu para `texto\|voz\|dm\|grupo\|notas`. Verificado em navegador: 5 DMs com nome do destinatário resolvido, grupo com "4 pessoas", notas por último. |
| Coluna contextual — o conflito nº 3 resolvido | **Sem gastar slot.** O shell tem TRÊS slots e o produto tem nove painéis. Coluna de conversas separada gastaria um e obrigaria a pessoa a trocar painel na mão ao ir para a casa. `ListaDeCanais` lê a navegação e escolhe a fonte — que é como o Discord faz. **Amigos também não virou painel:** é uma LINHA da coluna, porque não tem histórico nem composer e um slot seria caro demais para o que ela é. |
| Ordenar quando é observável | **Regra que a etapa 3 acrescentou, e ela vale além dela.** Ordenar conversas por recência é `n log n` e agrupar as quatro abas de amigos é varredura sobre todo mundo — fazer qualquer uma por evento seria pagá-la 500 vezes por segundo sob firehose, para uma coluna que ninguém está olhando. As duas publicam quando a pessoa ABRE a tela, que é o único momento em que a ordem é observável. ⚠ **Esqueci a metade de amigos e as quatro abas abriam VAZIAS** — a publicação existia, mas no `ready`, que não chega sem servidor. Invisível lendo o código; apareceu abrindo a tela. |
| `PUT /users/:id/friend` sem método no SDK | **Envolvido direto, em vez do contorno do upstream.** Aceitar pedido não tem método, e o cliente Solid reenvia `addFriend()` pelo NOME DE USUÁRIO — funciona por efeito colateral (o servidor trata pedido mútuo como aceite) e falha se a pessoa trocou de nome entre o pedido e o aceite. `client.api` é tipado sobre o OpenAPI inteiro. No mesmo passo: `pedirAmizade` usa `POST /users/friend` com `username`, porque `User.addFriend()` exige já ter o objeto — e quem digita um nome numa caixa não tem objeto nenhum. |
| Arnês mais pobre que o protocolo, de novo | **Terceira vez, e o padrão agora tem nome.** Não havia DM, grupo, notas nem relação nenhuma no firehose — as quatro abas e a coluna inteira eram intestáveis. Mesma família do `ehMencao` que passou três fases sem devolver `true` e da semeadura de não-lidas. Agora: 5 DMs espaçadas em uma hora (empate resolvido por ID não prova ordenação), um grupo, as notas, e relações distribuídas por primos entre si — uma aba vazia não prova que a tela funciona. |
| `pode()` devolvendo `true` para tudo | **Resolvido, e a "uma linha" que o comentário prometia tinha uma armadilha.** `havePermission` está ligado e `Acao` cresceu com as seis administrativas. O comentário antigo dizia que o default de "não sei" viraria `false` — verdade, e `false` puro **esconderia a interface inteira de si mesma durante todo o desenvolvimento**: sem `Ready` não há tabela de cargos, e composer, reação, resposta, menu e administração sumiriam do arnês onde o projeto é medido. A exceção é uma condição só (`client.user === undefined`), estreita de propósito, e com teste dos dois lados — com sessão ela não vale mais, senão seria um `\|\| true` disfarçado. 15 testes. |
| Discover trocado por convite | **Feito, e é o conflito nº 2 do plano fechado.** O Discover do upstream é um `<iframe>` para `stt.gg`; numa instância privada ele lista os servidores públicos do Stoat, não os seus. No lugar: `+` no rail, modal com dois caminhos (entrar por convite / criar servidor) e rota `/convite/:codigo`. ⚠ **A rota é de FORA, antes da sessão** — o caso comum de convite é o link mandado para quem ainda não tem conta, e sem isso o clique cairia no login e o código se perderia em silêncio. O código sobrevive ao login: fica no store de entrada e o portão reabre o modal quando a sessão vale. `GET /invites/{code}` também não tem método no SDK. |
| Convite com querystring | **Bug meu, achado pelo teste que eu estava escrevendo para outra coisa.** `codigoDe` partia em `[/?#]` e pegava o último pedaço, então `…/convite/abc123?ref=x` devolvia `ref=x`. Link com parâmetro de rastreio é a forma mais comum de convite colado — o defeito atingiria o caso mais frequente, e a mensagem seria "convite inválido" sobre um convite válido. |
| Administração do dia a dia | **Com tela, nos menus onde a ação nasce.** Canal: criar (menu da categoria E botão no cabeçalho — servidor recém-criado não tem categoria de onde partir, e é onde mais se precisa), editar, apagar, criar convite. Categoria: criar, renomear, apagar. Membro: castigo, expulsar, banir. **Quatro modais para oito alvos**, porque criar e editar canal são o mesmo FORMULÁRIO e apagar canal e categoria são a mesma PERGUNTA — modais separados seriam formulários que precisam concordar e o primeiro a divergir seria o que ninguém abriu naquela semana. O alvo vem do store (`administracao.ts`), como o registro de modais manda. Item administrativo não é `disabled` quando falta permissão: **não é renderizado** — item cinza ensina que a ação existe e que você não a tem, ruído permanente para quem nunca vai tê-la. |
| Menu de contexto na member list | **Só EXISTE para quem pode moderar**, e a condição resolve dois problemas com uma linha. A lista tem dezenas de milhares de linhas; montar `ContextMenu` (Root, Trigger, Portal) em cada uma para quase ninguém usá-lo é o mesmo custo que o menu no nível da lista veio remover da lista de mensagens. ⚠ Precisou de um `<span display:contents>` entre o gatilho e o `CartaoDePerfil`: os dois usam `asChild`, e no mesmo elemento um sobrescreveria os handlers do outro — o cartão pararia de abrir, sem erro. Medido: altura da linha segue 32px, então o virtualizador não notou. |
| Diálogo anunciando o título duas vezes | **Defeito de acessibilidade anterior a esta etapa, achado inspecionando o DOM de um modal novo.** Sem `descricao`, o `DialogContent` renderizava uma `Description` sr-only com o MESMO texto do título — só para calar o aviso do Radix. O leitor de tela anunciava "Editar canal, Editar canal". Agora `aria-describedby` é removido, e **condicionalmente**: passá-lo sempre como `undefined` sobrescreveria o que o Radix liga quando há descrição de verdade — o defeito inverso, e mais difícil de ver. Medido: uma ocorrência do título, sem `aria-describedby`. |
| Administração que ainda NÃO tem tela | ⚠ **O que falta da etapa 4, dito.** Editor de cargos e permissões por canal (a mais densa do plano — é um editor de bitmask), lista de banidos, emojis e webhooks. As quatro são listas ou tabelas que pedem uma casca de configurações, que é a etapa 5. Duas armadilhas do SDK já registradas no código: `DataEditRole.rank` **não tem efeito** (ordenar é só `setRoleOrdering`), e **não existe `Server.createInvite`** — convite é sempre de um CANAL. E categoria **não tem CRUD no protocolo**: é o array inteiro em `Server.edit`, com a última escrita ganhando em silêncio. Risco aceito; o upstream tem o mesmo. |
| Casca de configurações | **Construída — rota, e SOBRE o shell.** As duas decisões têm consequência medida. **Rota e não modal:** o upstream põe as 42 páginas num `Dialog` e paga com nada linkável, voltar que não fecha e F5 que cai na inicial; aqui `/config/perfil` é endereço e `Esc` volta. **Sobre e não no lugar:** substituir o shell desmontaria a lista com dez mil linhas medidas e âncora — o custo mais caro do app pago pela ação mais barata. Medido em navegador: ao abrir, `log()` é a **mesma instância de DOM** e a rolagem fica onde estava; ao fechar, a URL volta ao canal e a rolagem continua lá. |
| Configurações: sete seções | Perfil, Conta, Dispositivos, Aparência, Visão geral, Convites, Banimentos — com `Record<SecaoId, …>` no menu E no conteúdo, então seção nova não compila sem nome e sem tela. **Aparência quase não foi trabalho**, e o plano previu: é o `PickerDePaleta` e o modo de edição da fase 4, que até agora só tinham entrada pelo cabeçalho do ARNÊS — o comentário lá dizia "no cliente de verdade é de lá que ela sai", e este é o "lá". A contagem de 42 páginas do upstream é maior que o trabalho real. |
| Dispositivos, adiada desde a etapa 2 | **Feita, e é a que mais importa das de conta.** O token deste app fica em `localStorage` — decisão registrada com o custo dito — e sem esta lista "minha conta pode ter sido acessada" é um pensamento sem nenhuma ação possível. ⚠ **O protocolo exige um TICKET de MFA, não a senha crua:** `mfa.createTicket({password})` troca a senha por um bilhete de uso único. A senha é pedida uma vez por abertura da tela, e não por linha — pedir a cada uma tornaria "derrubar tudo" mais fácil que derrubar o certo, que é o incentivo errado. A sessão atual não tem botão: derrubá-la é sair, e sair tem lugar próprio. |
| Sair do servidor = apagar, para o dono | ⚠ **A MESMA chamada faz as duas coisas** — `DELETE /servers/{id}` sai para quem é membro e APAGA para quem é dono. A interface tem de dizer qual vai acontecer, senão o dono clica em "sair" e destrói o servidor de todo mundo. O rótulo, o texto e a confirmação mudam por `souDono`. |
| Cargos e permissões | **Construída — era a tela mais densa do plano** (no upstream, um editor de bitmask de 596 linhas). O que a torna administrável é a tradução: `PERMISSOES` agrupa por pergunta que alguém faz de fato ("quem pode expulsar?"), cada item diz a CONSEQUÊNCIA em vez de repetir o rótulo, e **nenhum `BigInt` chega ao componente**. ⚠ **`BigInt` e não `number` na conversão**, e isso não é preciosismo: voz e menção moram nos bits 30–39, e os operadores bitwise do JavaScript truncam em 32 — `Speak` (bit 31) viraria negativo e `MentionRoles` (bit 38) sumiria. Erro que só aparece no fim da lista. ⚠ **Sem arrastar para reordenar**, porque `DataEditRole.rank` não tem efeito: um arrasto que parece funcionar e não salva é pior que não ter arrasto. |
| Emojis: listar e apagar, não enviar | ⚠ **A ausência é dita, e tem razão.** Subir emoji não passa pela API do protocolo: é um `POST` cru para o servidor de MÍDIA, com URL vinda de `client.configuration.features.autumn`. Sem instância alcançável não há como escrever e ver funcionar — e a única coisa pior que não ter o botão é ter um que falha em silêncio contra um endpoint que ninguém testou. O protocolo **também não tem editar emoji**: renomear seria apagar e subir de novo, quebrando toda mensagem que usava o antigo. |
| `pnpm escala` pegou meu `3px` | **A guarda funcionando exatamente como projetada.** O alinhamento óptico da caixa de seleção com a primeira linha do rótulo pedia `(20 − 13) / 2 ≈ 3px`, e o script reprovou com o recado certo: "acrescente o degrau, não escape dele num arquivo". `--vx-space-0` (2px) resolve dentro da escala — 1px de diferença num alvo de 13px não é perceptível, e um degrau novo para isto seria pior que a aproximação. |
| Etapa 5: o que NÃO entrou | ⚠ **Quatro itens, e três estão BLOQUEADOS por etapas futuras — não adiados por preguiça.** **Webhooks** e **permissões por canal** são de canal e cabem na casca que agora existe: é a única dívida real da etapa 5. **Notificações** depende de sons e de service worker que não existem; **voz** depende do LiveKit (etapa 6); **desktop** depende da casca Electron (etapa 9). Construir qualquer uma das três hoje seria uma tela de opções que não controlam nada. **Idioma segue fora por decisão** — ver a linha de i18n. |
| Voz: entrar, falar, sair | **Construída, e sem fork de backend** — `Channel.joinCall()` devolve `{token, url}` do LiveKit, e os serviços `voice-ingress` e `livekit` já estão de pé no compose. Entrar, sair, mudo, ensurdecer, câmera, compartilhar tela, e o cartão com quem está na sala. ⚠ **Ensurdecer também emudece**, e desensurdecer NÃO desfaz o mudo: quem já estava mudo antes não pediu para voltar a transmitir. ⚠ **Não existe rota de SAÍDA no protocolo** — sair é desconectar do LiveKit e o servidor descobre pelo socket. |
| Só `livekit-client`, sem `@livekit/components-react` | ⚠ **O plano previa os dois; a doutrina do projeto diz o contrário e ela ganhou.** `component-primitives.md` lista "painel de voz e indicadores de fala" entre o que se escreve à mão, com a razão de sempre: biblioteca de componente traz modelo de dados, estilo e estado próprios — os três lugares onde este projeto já tem decisão tomada. O que o LiveKit resolve e ninguém quer reescrever é o TRANSPORTE (WebRTC, renegociação, codec, reconexão). O anel de fala é um `boolean` num store efêmero; não paga uma segunda árvore de contexto React. |
| O aviso do gate cumprido antes de ele cobrar | **O `CLAUDE.md` registrou o risco antes de a etapa existir** — *"canal de voz movimentado repinta a coluna inteira"* — e foi o único aviso do plano que descrevia um defeito que ainda não tinha acontecido. Duas velocidades, dois stores: a LISTA de quem está na sala muda por ação humana e vive em store normal; **quem está FALANDO** vive no efêmero com throttle de 120ms, keyed por usuário. Quem assina é o avatar daquela pessoa — não o cartão, não a coluna de canais, não a lista. Medido no arnês: o anel muda entre três amostras seguidas e nada mais acorda. |
| LiveKit fora do carregamento inicial | ⚠ **Meio megabyte, achado medindo e não supondo.** Com `livekit-client` em import estático, o bundle inicial pulou de 996 kB para **1.539 kB** (gzip 303 → 444) — para uma feature que a maioria das sessões nunca usa, num cliente de jornada de 8h onde a primeira pintura importa. O motor virou `sdk/motorDeVoz.ts`, carregado com `await import()` no primeiro clique em "entrar na sala". Voltou para 1.020 kB, com um chunk de 517 kB que só quem entra em chamada baixa. No mesmo passo, o build acusou um `INEFFECTIVE_DYNAMIC_IMPORT` meu em `cargos.ts` — o SDK já está no chunk principal, então aquele `import()` não movia nada e só tornava tudo assíncrono à toa. |
| Cartão de chamada sumindo na casa | **Defeito meu, achado no navegador e não na leitura.** Ele estava `absolute` DENTRO da coluna de canal — e a coluna só existe quando há canal aberto, então ir para a casa durante uma chamada fazia o cartão desaparecer. Era exatamente o caso que o modo compacto existia para cobrir: uma chamada que some é uma chamada que a pessoa acha que caiu. Agora é `fixed` na camada sobreposta, e a âncora dele é a JANELA — a chamada continua viva independentemente de onde se está olhando. |
| Etapa 6: o que NÃO entrou | ⚠ **Dito.** **Vídeo na tela** — a câmera e o compartilhamento LIGAM, mas não há grade de participantes mostrando as faixas; `autoSubscribe: false` e assinatura só de áudio são deliberados (baixar vídeo de dez pessoas ao entrar é desperdício), e a grade é a superfície que falta. **`ScreenSharePicker` do Electron** depende de `desktopCapturer` via IPC — etapa 9. **Mudo de servidor** (`ServerMember.edit({can_publish})`) não tem tela. E as configurações de voz seguem vazias, agora por falta de tela e não de feature. |
| Editar e apagar mensagem | **Voltaram, e eram a dívida mais antiga da lista.** Estiveram no menu como itens INERTES por três fases — apareciam, recebiam foco, fechavam o menu e não faziam nada — e saíram por isso, junto com o lint que passou a exigir `onSelect`. Agora com `Message.edit()` e `Message.delete()`. **Editar é só do AUTOR**, e não é permissão de servidor: o protocolo não deixa ninguém editar mensagem alheia, nem quem administra. Editar é IN-LINE e não modal — a mensagem corrigida precisa continuar no contexto do que veio antes e depois. Apagar **não é otimista**, ao contrário de editar e reagir: sumir com a linha antes da confirmação deixaria a pessoa achando que conseguiu quando o servidor recusou. |
| Reação e fixar sem rede | **Resolvido.** As duas eram otimistas-só desde a fase 3: acendiam o chip e sumiam no F5, porque ninguém contava ao servidor. Agora `react`/`unreact` e `pin`/`unpin` atrás de `conectado()`, fire-and-forget como `ack` e `startTyping`. ⚠ **Sem rollback em caso de erro, e é decisão dita:** o servidor reenvia o estado no próximo evento da mensagem, e um rollback otimista correndo contra esse evento produz o chip piscando duas vezes. |
| Aviso de link externo | **Superfície de SEGURANÇA, e a única que o analisador não podia cobrir sozinho.** `hrefSeguro` barra `javascript:` e `data:`; não pode barrar um `https:` que simplesmente não é para onde a pessoa acha que vai — markdown deixa o texto do link dizer uma coisa e o destino ser outra, e toda mensagem daqui é escrita por outra pessoa. O aviso ENDURECE quando o texto escrito é uma URL diferente do destino. O `href` fica no elemento (copiar link e meio-clique continuam funcionando) e modificador segurado não é interceptado — `preventDefault` só pega o clique normal. |
| Visualizador de imagem | **Clicar num anexo passou a fazer algo.** `button` em volta da imagem e não `onClick` nela: imagem clicável sem botão não recebe foco, não responde a Enter e não é anunciada — o recurso existiria só para quem usa mouse. `display: contents` no botão para não desfazer a reserva de espaço, que é calculada do metadata. Sem zoom: o upstream usa `@panzoom/panzoom`, e aqui a imagem cabe na janela. |
| Envio "sumindo" com sessão presente | **NÃO era bug — era o AMBIENTE, e o projeto já tinha uma sonda construída para distinguir os dois casos.** Sintoma: `enviarMensagem` aceitava (devolvia id, o rascunho limpava) e a mensagem não aparecia na lista. Diagnostiquei errado como regressão da etapa 2, pelo `Uncaught Socket closed, trying to send` no console. **A causa é a aba não estar compondo frames:** sem composição o `requestAnimationFrame` não dispara, `flushPublications` não roda, e a publicação coalescida fica pendurada — o ID está em `idsOf`, e `channelMessageIds` nunca é republicado. O comentário de `estadoDaFila` descreve isto palavra por palavra, e a sonda existe exatamente para separar "o dado não chegou" de "o frame não veio". Confirmado: com o painel do navegador em primeiro plano, a mensagem aparece no mesmo teste. **Lição de método:** verificar num painel que não compõe é o mesmo erro de medir no dev server — reprova o ambiente e culpa o código. O ruído de socket é real e vem do `connect()` da etapa 2, mas é o laço de reconexão do SDK contra um servidor inexistente, e não tem relação com o envio. |
| Etapa 7: o que NÃO entrou | ⚠ **Dito.** **Embeds** (muda a altura da linha — pede gate próprio), **anexar arquivo** (upload para o servidor de mídia, inverificável sem instância, mesma razão do emoji), **seletor de emoji e GIF**, **composer rico com ProseMirror e autocomplete** (a condição documentada foi atingida — menção, emoji e bloco de código existem —, mas é a maior peça da etapa), **busca no canal** e **fixados vindo de `Channel.search({pinned:true})`** em vez da derivação local. |
| Etiqueta FÓRUM na coluna | ⚠ **Não é tela que falta — é TIPO que o protocolo não tem, e por isso não entrou no registro de pendências.** O design desenha `▤ ideias FÓRUM`, e o Stoat conhece `SavedMessages \| DirectMessage \| Group \| TextChannel` mais a detecção de voz por um objeto `voice`. Não existe `ForumChannel` e nenhum campo diz "este canal é uma lista de postagens". Derivar do nome ou da categoria seria um rótulo afirmando um comportamento que o canal não tem — a mesma família do `channel_type: "VoiceChannel"` que o arnês inventou e a hidratação aceitou calada. É a superfície mais cara do design a depender de **fork do serviço `api`**, e a primeira que forçaria o caminho da § Divergência de produto. O registro de pendências fica de fora de propósito: o contrato dele é "controle desenhado que ao ser clicado diz o que fará", e aqui não há o que clicar. |
| Prévia de resposta virou IRMÃ da mensagem | **Consertado, e a razão é do próprio design:** *"se fosse filha, o hover da linha cobriria a prévia e o 'pular para mensagem' perderia o alvo de scroll"*. A `Citacao` era a primeira filha da coluna de conteúdo, e a barra de ações ancora na borda de cima subindo metade da própria altura — ou seja, ela pousava sobre o alvo exatamente quando o ponteiro estava na linha, que é sempre que alguém iria clicar. O `article` virou coluna, a LINHA (calha + conteúdo) virou filha e é ela que ancora a barra, e a prévia fica acima, fora do alcance. O recuo até a coluna de conteúdo passou a ser dela (`calc(--vx-avatar-md + --vx-space-3)`), porque ela perdeu o alinhamento de graça ao sair de dentro. |
| Modo compacto da timeline | **Não construído, e é a maior divergência que sobra.** O design tem densidade como ajuste de Aparência, e compacto **não é o confortável com padding menor** — ele diz isso explicitamente: muda a ESTRUTURA (sem avatar, coluna de hora em mono de 38–40px à esquerda, autor inline em peso 700, entrelinha 1,45, e **sem agrupamento por autor** — cada mensagem vira uma linha endereçável). Consequências que o tornam trabalho de verdade e não um tema: `ALTURA_POR_TIPO` passa a depender da densidade (e as constantes já se moveram sete vezes), o agrupamento sai do caminho de escrita do adapter, e a linha é o componente mais quente do app — pede gate próprio. |
| ⚠ `var(--z-realce)` não existia — três arquivos | **Defeito meu, silencioso, e o drawer o denunciou.** A escala de z é nomeada por PAPEL em `--vx-z-*`; o nome sem prefixo (`--z-flutuante`) só existe como UTILITY do Tailwind. Escrevi `z-index: var(--z-realce)` em três CSS Modules novos — `var()` sem fallback resolve para nada, `z-index` cai em `auto`, e nada falha: o cabeçalho grudado do seletor e as barras do lightbox ficaram sem camada. Só apareceu quando o drawer passou POR BAIXO da lista de membros. ⚠ **Nenhuma guarda pega isto**: o `pnpm utilities` confere `className` e regra órfã, não nome de var. Candidato a mecanismo. |
| A largura do `Dialog` virou PISO | ⚠ **O mesmo override deu 400 num modal e 512 no vizinho.** `Dialog.module.css .painel` fixava `inline-size:100%; max-inline-size:32rem`, e o consumidor declarava a sua com a MESMA especificidade — quem ganhava era a ordem em que os CSS Modules entram no bundle, que não está declarada em lugar nenhum. Medido: encaminhar em 400 (certo) e criar-enquete em 512 (errado), com código idêntico. `:where(.painel)` zera a especificidade e a largura do consumidor passa a vencer sempre. É a mesma técnica do `:where()` que já resolveu o tamanho de ícone na coluna de canais. |
| O grid do modal não chegava ao conteúdo | ⚠ **`DialogContent` embrulha os filhos num `<div class="mt-4">` e põe `p-5` no painel.** Consequência: o `display:grid` que eu pus no painel governava três filhos que não são meus (título, descrição, wrapper), então NENHUM `gap` valia — e o campo de comentário do encaminhar, um `<input>` solto dentro de um `div` de bloco, media **178px numa caixa de 400**. Os dois modais novos passaram a `tituloOculto` + `p-0`, com cabeçalho, corpo e rodapé próprios: é o que permite o rodapé numa faixa em `surface-3` sangrando até a borda, como o design desenha. |
| `--vx-danger-text`, o segundo vermelho | **O design usa DOIS e o app tinha um.** `#E8596B` para borda e fundo tingido, `#F0808D` para a palavra "Excluir" dentro de um menu — a mesma divisão que `accent`/`accent-text` já fazia. Medido antes: o item saía em 4,28:1 sobre `surface-4`. ⚠ **No CLARO os dois são o mesmo valor**, e não é descuido: no escuro o texto precisa ser mais claro que o preenchimento, no claro `#c22c43` já está no limite de baixo. `accentTexto` repete `acento` no claro pelo mesmo motivo. Derivado em `derivar.ts`, com os 5 pares novos de contraste passando nos dois modos sem exceção. |
| Barra de ações: as medidas estavam todas fora | ⚠ **Botão 24 contra os 28 do design, emoji em 12 e ícone em 14** — ou seja, o emoji MENOR que o ícone ao lado, numa fileira onde os dois são a mesma família de alvo. E a divisa em `--vx-border-subtle`, que é calibrado para divisórias sobre `surface-0..2`: dentro de uma caixa em `surface-4` ela media `rgb(29,35,45)` contra um fundo `rgb(34,40,51)` — mais ESCURA que o que deveria dividir. Agora 28/15/13 e véu de 10% branco, como o design. Medido depois, os nove alvos em 28×28. |
| Drawer: abrir um painel EVICTAVA outro | ⚠ **Abrir a caixa de entrada pelo cabeçalho fazia a lista de membros sumir**, sem aviso, e trazê-la de volta exigia o modo edição. O shell tem três slots e o produto tem nove painéis; roubar o slot é o que acontece quando "abrir" e "ancorar" são a mesma operação. O design separa as duas numa frase: *"o mesmo drawer lateral que, em ultrawide, pode ficar ancorado como painel 2 em vez de flutuar"*. `store/drawer.ts` decide pela configuração: painel COM slot alterna o slot; painel SEM slot flutua. Nada é evictado, e `Esc` fecha. |
| Caixa de entrada: faltava a MENSAGEM | **Ela dizia "há 4 menções em #produto" e obrigava a abrir o canal para saber o quê** — ou seja, custava exatamente o gesto que existe para poupar. `ChannelSnapshot` ganhou `ultimaMensagemId` (só o ID: copiar o conteúdo republicaria o canal, a coluna e o rail a cada palavra digitada), e a linha assina a mensagem. Prévia ausente quando a sessão nunca abriu aquele canal — degradação honesta, não esqueleto. A contagem nas abas vem de `totaisNaoLidos`, rollup global no adapter: somar no componente exigiria um hook por servidor, e o número de servidores varia. ⚠ O `onFirstSubscribe` não é cerimônia — sem ele a aba abria zerada, porque a soma só é republicada quando muda e a caixa é aberta depois da semeadura. |
| Fixadas sem separação | **Os cartões só ganhavam superfície no HOVER**, e três prévias de duas linhas com 8px de respiro leem como um bloco de texto contínuo — o cartão existia só para quem já estivesse apontando para ele, que é quem menos precisa da separação. Agora há superfície em repouso. O design pinta um cartão e deixa os outros no hover; ali isso mostra o estado, aqui produziria a mesma parede. |
| Arrastar para reordenar a enquete | **Deixou de ser pendência.** Uma função de mover serve ao ponteiro e ao teclado (`Alt` + setas), que é o que garante que os dois cheguem ao mesmo lugar — reordenar que só funciona com mouse é o defeito que a auditoria apontou na paleta de comandos. A alça ARMA o arraste no `pointerdown`; sem isso a linha inteira seria arrastável e selecionar o texto de uma resposta viraria um arraste. Medido: `Alt+↓` na primeira resposta troca "Confortável/Compacto" por "Compacto/Confortável", com as marcas 🅰🅱 ficando na POSIÇÃO. |
| O `›` que prometia submenu | ⚠ **"Cargos" e "Mover para canal" tinham a seta e nada abria** — quem usa relatou exatamente isso. Submenu é o único desenho do arquivo que o app não pode cumprir hoje: cargos precisa da tabela RESOLVIDA (quais são os do servidor E quais são os desta pessoa, e `MemberSnapshot` não carrega os IDs) e mover precisa de `ServerMember.edit({ voice_channel })`, que é escrita de fase 6. A seta saiu; ela volta com o submenu. Mesma decisão em "Adicionar reação". |
| A galeria de componentes mentia | ⚠ **Ela não carrega o Tailwind, e sem o preflight `p` vem com 16px de margem e `input` com o anel de foco do navegador.** Quem comparou as duas telas viu "espaçamento muito grande entre os textos" e "duas caixas azuis no input" — e nenhum dos dois existia no app. É a mesma família do "medir no dev server": o instrumento reprovando o ambiente e culpando o código. A galeria ganhou reset próprio. Ela mora fora do repositório, em `scratchpad/galeria.py`, e monta a página lendo o `tokens.css` e cada `.module.css` do bundle, escopados por aninhamento CSS nativo. |
| Reação SUPER — não construída, e não é pendência | ⚠ **O design desenha um chip `⚡ 2 SUPER` em `warning`, e o protocolo não tem o conceito.** Não é controle desenhado sem implementação — é um ESTADO DE DADO que nenhum servidor Stoat sabe produzir, como a etiqueta FÓRUM. O registro de pendências fica de fora de propósito: o contrato dele é "controle que ao ser clicado diz o que fará", e aqui não há o que clicar. Entra junto com o fork do serviço `api`. |
| "Acima da sua hierarquia" — o item desabilitado com motivo | ⚠ **O design desenha `Bloquear · acima da sua hierarquia` cinza e não clicável, e ele NÃO entrou.** Depende de comparar o rank do meu cargo com o da outra pessoa, que é tabela de cargos resolvida — trabalho da fase 6. Um item cinza com um motivo inventado é pior que a ausência. O resto do menu segue a regra da member list: o que é de MODERAÇÃO some sem permissão, o que é do dia a dia aparece para todo mundo. As duas regras convivem porque o critério é o mesmo: permissão que você nunca vai ter é ruído permanente; hierarquia, que muda quando alguém troca de cargo, é informação. |
| Barra de ações 1:1 — e fixar saiu dela | **Oito alvos na ordem do design** (três reações · divisa · seletor, responder, encaminhar, tópico, `⋯`), em `surface-4` com `elev-2` — ela estava em `surface-3` e sem sombra, e no tema claro `surface-3` e `surface-4` são os DOIS branco puro: sem sombra a camada some inteira. ⚠ **Fixar saiu**, e é a única troca de conteúdo: o design põe tópico onde estava o alfinete, que continua no menu e no cabeçalho da linha. Um oitavo alvo permanente custa largura sobre o texto por baixo. |
| O `⋯` reusa o MESMO menu | **Ele despacha o evento que o `Trigger` já escuta**, em vez de montar um `DropdownMenu` com o conteúdo duplicado. O evento borbulha: passa pela captura do container (que limpa o alvo) e pelo handler da linha (que escreve o certo), então o alvo se resolve pelo mesmo caminho do clique direito. Dois menus com os mesmos quinze itens divergem no primeiro que ganha um item novo. |
| ⚠ Sem `Tooltip` na barra de ações, e é custo medido | **A barra é MONTADA em toda linha** (`visibility: hidden`, não desmontada), então um `Tooltip.Root` por alvo seriam oito árvores de primitivo por linha e ~400 com a janela cheia. É exatamente a conta que tirou o `ContextMenu` da linha, e aquele A/B mediu 1,7% → 1,2% de frames perdidos por QUATRO componentes a menos. O design também não desenha tooltip ali; o `aria-label` fica. |
| Menu do usuário na timeline | **Construído, e sem um segundo `ContextMenu`.** O alvo de `store/menuDeMensagem.ts` virou UNIÃO MARCADA (`mensagem \| usuario`), e um handler só decide qual escrever olhando de onde o clique veio (`closest("[data-menu-autor]")`). A saída óbvia — um `ContextMenu` em volta do autor de cada linha — desfaria a economia que o store inteiro existe para garantir. ⚠ A comparação virou por CAMPO: quem chama monta o objeto no handler, e por referência dois cliques na mesma linha acordariam a lista à toa. |
| Quem reagiu, com nomes | **`ReacaoSnapshot.quem` é AMOSTRA com teto (4), não o conjunto inteiro.** O protocolo entrega todos os IDs; copiá-los para dentro do snapshot da linha mais quente, a cada reação, para desenhar quatro nomes seria alocação proporcional à contagem. `total` continua sendo a contagem verdadeira, e as duas juntas dão "e outros 3". O `HoverCard` da fase 2 ganhou o segundo consumidor. |
| Régua do editor in-line | Negrito e itálico são REAIS — envolvem a seleção em markdown, que o caminho de leitura já entende desde `markdown/analisar.ts`. Dentro da caixa e não fora: com a régua fora, a borda de foco terminava antes dos controles que pertencem ao campo. |
| "na fila · offline" é o mesmo `sendState` | **Os dois primeiros estados de envio do design são ambos `pending`; o que os separa é a CONEXÃO.** A distinção importa para quem espera: "está indo" e "não vai enquanto você não voltar" pedem paciências diferentes. ⚠ A subscrição do socket vive num componente próprio — lê-la na `MessageRow` faria toda linha montada acordar a cada engasgo de rede. A barra de progresso de upload que o design desenha NÃO entrou: não há upload, e ela seria animação sobre um número inventado. |
| Casca compartilhada dos quatro seletores | **400×452, rail de 44, busca, grid e rodapé de prévia** — o design escreve a promessa por extenso, e quatro cópias divergiriam na primeira mudança de token, como as seis do `Avatar`. O soundboard é o estreito (352) e sem altura fixa: são nove botões, e uma caixa de 452 deixaria metade vazia. ⚠ Altura FIXA nos outros três por ANCORAGEM: o painel abre acima do composer, e crescer com o conteúdo faria a caixa saltar debaixo do ponteiro a cada tecla. |
| Seletor de emoji — funciona | **É o único dos quatro que não depende de nada que o app não tenha:** emoji Unicode é texto, e inserir texto no rascunho é o que o composer já faz a cada tecla. Busca em português, categorias, prévia no rodapé, e inserção na POSIÇÃO DO CURSOR (concatenar no fim faria o glifo saltar para o final de uma frase já escrita). ⚠ **A lista é CURADA (~170), não o Unicode inteiro** — o padrão tem ~3.800 com nome e alias, e trazê-los é uma dependência de dados de centenas de kB, que neste projeto precisa de justificativa própria. Pendência `emojiCompleto`. |
| Enquete — o que é do cliente e o que não é | **A linha na timeline EXISTE e vota; criar é pendência.** Enquete não está no protocolo (nem tipo, nem campo, nem evento), e guardar a enquete só no cliente daria uma contagem que só quem criou enxerga — pior que a ausência, porque parece funcionar. `store/enquetes.ts` é store de cliente como `pastas.ts`, e quem escreve nele hoje é o ARNÊS, pelo mesmo arranjo de `configurarSimulacaoDeEnvio`. ⚠ **A barra de resultado é o FUNDO da opção, nunca um irmão** — é instrução do design, e a razão é a âncora. Medido: 328px de altura da linha antes e depois do voto. |
| `<select>` do design virou dropdown | ⚠ **O lint me pegou.** O modal de enquete tem dois `<select>` no design; nativo é renderizado pelo SISTEMA, e num app escuro no Windows ele abre com cromo claro. O gatilho reproduz a APARÊNCIA (caixa, valor, seta); o que muda é de quem é a lista. Mesma regra que a auditoria da fase 4 estabeleceu. |
| Encaminhar é CITAÇÃO, não encaminhamento | ⚠ **O protocolo não tem o conceito** — não há campo dizendo de onde a mensagem veio, nem evento próprio. O modal manda uma citação em markdown com autor e canal de origem, que qualquer cliente Stoat lê: a atribuição vira parte do texto em vez de metadado. A alternativa recusada era um formulário completo — busca, chips, comentário — inerte, e quem o preenche só descobriria no fim. |
| Caixa de entrada virou painel | **Era pendência de cabeçalho e virou `PainelId`**, porque o dado já existia: `naoLidas` e `mencoes` estão no snapshot do canal desde a semeadura no `Ready`, e a varredura é sobre canais (dezenas), não sobre mensagens. A aba de tópicos fica vazia DIZENDO por quê — esconder faria parecer que não há tópicos, que é afirmação diferente de "isto não existe". A resposta rápida do design não entrou: ela pede um composer fora do canal, o que significa decidir de quem é o rascunho, o alvo de resposta e a digitação. Medido: 339px, três servidores com menção. |
| O lightbox mira a MENSAGEM, não a URL | **É a troca que destrava metade do design.** Com uma URL solta, cabeçalho (quem, onde, quando), setas (qual é o próximo) e miniaturas (quantos são) são todos irrepresentáveis. ⚠ **`max-inline-size` também, e sem ele o palco media 512px:** o `.painel` do `Dialog` fixa `32rem`, e declarar só `inline-size` não vence o máximo do outro módulo — o resultado é uma galeria do tamanho de um modal de confirmação. Medido: 512 → 1100. ⚠ A folga das barras saiu de somas da escala (56/72/72 contra os 56/76/72 do design): um degrau fora da escala custa mais que os 4px, a mesma troca do raio de 14 no ladrilho do rail. |
| Mensagem de voz: tocar existe, gravar não | **Tocar não depende de nada** — o anexo de áudio vem no protocolo (`Metadata.type === "Audio"`) e qualquer servidor Stoat o entrega. `<audio>` sem `controls`: o nativo resolve rede, decodificação, buffer e sessão de mídia do sistema, e o que ele não resolve é a aparência — a mesma divisão do `livekit-client` sem `@livekit/components-react`. Gravar continua pendente pela dependência de `anexar`: sem upload, uma gravação não tem para onde ir, e pedir o microfone para produzir um arquivo que morre na aba é pior que não ter o botão. |
| ⚠ A forma de onda NÃO é real | **As 28 barras saem do ID do anexo**, estáveis por arquivo, pelo mesmo mecanismo do gradiente do avatar (FNV-1a, e não soma de códigos: os IDs compartilham prefixo). A verdadeira sai de `decodeAudioData`, que exige baixar e decodificar o arquivo inteiro antes de desenhar, para toda mensagem de voz visível — trabalho próprio, registrado como `formaDeOndaReal`. O que estas barras entregam é o que a onda serve primeiro: um alvo de scrub de granularidade constante, e é ele que carrega o `role="slider"`. |
| `AnexoSnapshot.tipo` ganhou `audio` | **Tipo próprio e não `arquivo` com extensão certa.** A diferença muda o que a linha desenha — arquivo vira cartão com nome e peso, áudio vira player. Deduzir da extensão no render seria a forma do protocolo vazando para o componente mais quente do app; o protocolo já distingue. |
| Arnês mais pobre que o protocolo — 9ª vez | **Áudio.** `Metadata.type === "Audio"` existe desde sempre e o firehose só sabia produzir imagem e arquivo, então o player nasceria construído e inalcançável — a família do painel de fixadas. Dois testes guardam a TRADUÇÃO (é ela que quebra em silêncio), não a semeadura. |
| ⚠ Painel do navegador escondido não compõe — 3ª vez | **Custou meia hora de diagnóstico errado nesta rodada, e o projeto já registrou o padrão duas vezes.** Com o painel oculto o `requestAnimationFrame` não dispara: `seed()` fica em "semeando…" para sempre, a publicação coalescida nunca esvazia, o virtualizador não remonta a janela ao rolar, e uma varredura por `scrollTop` percorre a lista inteira sem trocar uma linha do DOM. Nada disso é regressão. **O que funciona: tirar um screenshot força um quadro.** A regra prática é a mesma de "não medir no dev server" — o instrumento reprovando o ambiente e culpando o código. |
| ⚠ O Foundations do design contradiz os mockups do design | **A causa raiz das nove divergências, e ela não era desatenção.** O Foundations declara *"Escala de espaço · base 4"* — 2·4·8·12·16·24·40, que é exatamente a escala que este projeto tinha — e *"Raio · 4·6·8·12·full"*, também a nossa. Medidos os treze arquivos: dos **3.486** valores de espaçamento, só **40%** caíam na escala declarada. Os dois mais usados fora dela são **7 (263×)** e **9 (265×)**, e o par mais repetido do design inteiro é `padding: 7px 9px`, **102 vezes** — que não é passo de ritmo, é a altura de um botão de 30px. Escolhido reproduzir os **mockups**, porque é contra eles que a semelhança é julgada. ⚠ **O que isso custa, dito uma vez:** a escala deixou de impor RITMO. Ela ainda impõe o que a lei nº 4 pede — valor nomeado e compartilhado, nunca literal num componente — e o `pnpm escala` segue reprovando 15, 17, 19 e o que cair entre 20 e 24. O que ele não faz mais é escolher por você entre 8 e 12. |
| Escala de espaço e de raio por VALOR | **Renomeadas, e os nomes ordinais eram o que tornava caro inserir um degrau.** Com ordinal, acrescentar 6px renumeraria todos os de cima e os ~640 usos com eles; com valor, acrescentar é uma linha. Espaço: 2·3·4·5·6·7·8·9·10·11·12·13·14·16·18·20·24·32·40 (~96% de cobertura). Raio: 2·3·4·5·6·7·8·9·10·12·14 mais `pill` (99,5%) — a pílula perdeu o número porque 9999 não é medida. ⚠ **A renomeação foi segura por NÃO-COLISÃO:** o nome antigo tinha um dígito, o novo tem dois ou é palavra, então referência esquecida deixa de resolver (`pnpm vars` reprova) e utility esquecida deixa de emitir CSS (`pnpm utilities` reprova) — em vez de resolver para o valor errado em silêncio. `cn.ts` e `pnpm classes` foram junto. |
| `--vx-size-2xs: 10px` | **4,8% de todo texto do design é 10px** — selo, contador, tecla de atalho, rótulo de categoria. Sem o degrau cada um subia para 11, e a hierarquia entre metadado e conteúdo achatava um pouco a cada tela. 9px (1,2%) ficou fora: é onde a Instrument Sans perde as contraformas em tela. |
| `scripts/espec.mjs` — o que o design PEDE, em números | **A ferramenta que tira o julgamento do caminho.** Os `.dc.html` são HTML com todo valor literal em `style` inline, o que parece ideal e esconde a armadilha: quem lê o arquivo lê a INTENÇÃO ("botão pequeno com emoji") e escreve a versão dele. `width:28px` virava `--vx-space-5`, que é 24 — quatro pixels, nove vezes, cada uma com justificativa razoável. O script varre uma seção, junta os valores DISTINTOS e diz para cada um qual token corresponde, ou que não corresponde. ⚠ Ele distingue **DIMENSÃO de componente** (escreva o número) de **RESPIRO** (use a escala), que é exatamente o que a rodada anterior confundiu. Não sabe de layout: fluxo, quebra, âncora e container query seguem sendo leitura humana. |
| `min-w-48`/`min-w-56` estavam MORTAS | ⚠ **O menu nunca teve largura mínima, e media 207px onde o design pede 264.** O `@theme` faz `--spacing-*: initial` para apagar a escala default do Tailwind, então nenhuma das duas emitia CSS. E o `pnpm utilities` não pegava por um segundo motivo: ele lia só strings dentro de `className=`, e as classes de TODO menu do app moram em constantes de `menu.ts`. As duas coisas consertadas no mesmo passe — a guarda passou de 175 para 199 classes conferidas, e o mínimo virou `menu.module.css` (264, e 300 no menu do usuário, que é DIMENSÃO e não degrau). |
| Chip de reação invisível em repouso | **Ele usava `surface-2` e a timeline é `surface-2`.** O design usa VÉU — branco a 5%, 8% no hover — que é o certo justamente porque o chip pousa sobre a superfície do conteúdo e não sobre um painel. No mesmo passe: `gap` 4→5 e tipo 11→12/600, e `block-size` escrito como `24px` em vez de `--vx-space-24`, que dava o mesmo pixel dizendo a coisa errada. |
| Item de menu 6px mais baixo que o desenhado | `8px 4px` com raio 4, contra os `7px 9px` com raio 5 do design — o par mais repetido dos treze arquivos. A régua ganhou `margin: 5px 4px` para se alinhar ao TEXTO e não à caixa, o atalho foi para 10px, e o realce do item destrutivo virou vermelho a 14% por `color-mix`. Token novo não se justificava: `--vx-danger-soft` custaria entrada em `TokenName`, classificação de contraste e um par, para um fundo que só existe atrás deste item — a mesma decisão do preenchimento do divisor de novas mensagens. |
| Campo de edição encolhia o texto | O corpo da mensagem é 15px desde a troca de escala, e o campo in-line estava em 13: entrar em edição mudava a altura da linha **por causa do modo**. Agora `9px 11px`, raio 8 e `--vx-size-lg`, os três do design. |
| ⚠ A faixa preta em volta da timeline | **Era ATRIBUIÇÃO, não valor, e foi quem usa que apontou.** O Foundations nomeia `surface.sunken` (#08090B) como *"Rail, gutter **ultrawide**"* — a palavra está lá. A prancha pintava sempre: numa janela de 1688px a trilha dá 1136 contra o teto de 1040, ou seja **48px de preto de cada lado** — largo demais para sumir, estreito demais para ler como margem. Lia como a timeline sendo uma caixa preta com uma folha dentro, que é a MESMA queixa de "alinhamento quebrado" que a prancha foi construída para resolver, com outra forma. O corte é `@container (inline-size >= 1440px)` = 1040 + 200 de cada lado, e 200 é a ordem de grandeza do painel mais estreito do produto (membros em 232): abaixo disso o espaço não é lugar onde algo poderia morar, é sobra — e sobra tem a cor do conteúdo. ⚠ **Container query e não media query**, porque a largura desta coluna depende de sidebars que quem usa arrasta desde a fase 4. Medido: 1688 sem faixa, 2560 com gutter de 484px de cada lado. |
| 85,3% das cores do design já resolvem | **Medidas as 3.530 cores hex dos treze arquivos contra a nossa paleta.** A rampa é byte a byte a do Foundations. Os 519 usos que sobravam tinham CINCO causas, e nenhuma era "a cor está errada" — todas eram cor DERIVADA que faltava: as que o design compõe (gradientes), as que ele tinge (`on-*`) e dois neutros que a rampa de cinco não cobre. É o mesmo formato do achado da escala: o vocabulário está certo, o que falta é o que se constrói com ele. |
| `on-*` é TINGIDO, nunca neutro | **72 usos, e o comentário do `derivar.ts` defendia o contrário.** O design escreve `#04181B` sobre o acento, `#1A0507` sobre o vermelho e `#04241A` sobre o verde — quase-pretos com o matiz da cor de baixo. Usávamos `#0b0d11` (neutro) no acento e `--vx-surface-0` no badge de menção: um furo cinza dentro da cor. ⚠ A justificativa antiga era *"uma cor tirada do mesmo matiz corre atrás dele"* — vale para um par de luzes próximas, não com 0,55 de distância em L. `--vx-on-danger` e `--vx-on-success` passam a existir, os três reproduzem o design byte a byte e ganharam par de contraste. |
| `--vx-track` — o sexto neutro | **`#2A3038`, 55 usos, e ele está ACIMA de `surface-4`.** L 0,307 contra 0,276; treze dos usos são `border-radius: 999px; height: 4px`, que é trilho de deslizante, e o resto é fundo de controle inerte e polegar de rolagem. Não é degrau da rampa de SUPERFÍCIE — nada mora dentro dele. Usávamos `surface-3` (L 0,242), mais escuro que o painel onde o deslizante mora: o trilho sumia sob o polegar. Vai em `SEM_PAR` com motivo — quem carrega a informação é a parte PREENCHIDA em acento, não o vazio atrás dela. |
| Xadrez de placeholder com o dobro do contraste | A segunda parada do design (`#171C22`) cai **entre** surface-2 e surface-3; nós usávamos `surface-2` cheio. Numa caixa que diz "ainda não chegou nada", o xadrez deve ser um sussurro. Virou `color-mix` a 45%, sem token novo — a mesma decisão do realce do item destrutivo. |
| ⚠ O croma do gradiente não encolhia | **264 usos, a maior das cinco causas — e ela aparece em todo avatar e todo ladrilho.** Medidos os quatro gradientes que o design usa à mão, a razão croma-fim/croma-início é 0,77 · 0,85 · 0,62. A nossa era **0,92**: praticamente reta, e um gradiente que não perde saturação lê como cor chapada com sombra. 0,075 → 0,048 reproduz a família ROXA do design exatamente. ⚠ **Não dá para reproduzir as três famílias com um par de constantes** — o croma delas varia 4,4× (0,026 a 0,115) porque foram escolhidas uma a uma. Mantida a DERIVAÇÃO por ID (360 identidades em vez de quatro) com a física copiada; **adotar as quatro exatas é decisão de produto em aberto**, e custa a identificação por cor. |
| Gradientes: derivados → CURADOS | **Decisão de quem toca o produto, e a linha anterior desta tabela registrava o contrário.** Saiu a derivação por ID (matiz do hash, L e C fixos, 360 identidades); entraram os quatro hexes do design. A derivação nunca fecharia 1:1 — o croma das famílias varia 4,4× (0,026 a 0,115) e nenhum par de constantes reproduz isso. ⚠ **O que se perde, dito uma vez: a identificação por cor caiu de 360 para três.** Numa lista de vinte pessoas, sete compartilham cada gradiente; quem identifica passa a ser a inicial e o nome. Medido: 51 avatares, 3 gradientes, distribuição 19/17/15. |
| ⚠ O quarto gradiente é a MARCA, não um avatar | `#35C2CC → #1E7F92` carrega `V` ou `VX` nas **35** ocorrências do design. Sorteá-lo para pessoas poria a cor de "isto está ativo" em gente aleatória — a disciplina de acento que este projeto já consertou uma vez. Fica em `PALETA_DA_MARCA`, fora do sorteio, com um teste varrendo 4.000 IDs para provar que nenhum o alcança. ⚠ **Ele ainda não tem consumidor de produto**: o design o usa no ladrilho da marca Vortex, e essa superfície não existe aqui. É a família do "construído e inalcançável", mitigada por o teste o exercitar. |
| `fundo` não é "o ponto mais claro" | **Erro meu, pego pelo teste que eu estava escrevendo.** Com texto claro sobre fundo escuro o pior ponto é o claro; na paleta da marca — texto ESCURO sobre teal brilhante — inverte: 8,46 contra `#35C2CC` e **3,91** contra `#1E7F92`. Um campo que sempre pegasse o primeiro ponto mediria o MELHOR caso e o chamaria de garantia. Agora é "onde a inicial contrasta pior", computado. |
| A marca em 3,91:1, aceito com razão | Abaixo de 4,5 e aceito: é a paleta do design byte a byte, e o critério aplicável é o de **texto grande** (3:1) — ela só aparece em 44px ou mais, peso 700. O teste trava nos DOIS sentidos: se melhorar ou piorar, falha. Mesma disciplina de `EXCECOES` no contraste dos tokens. |
| A varredura de 3.600 matizes tinha uma cópia podre | ⚠ **Achado ao removê-la.** `corDeFundoDeMatiz` repetia as constantes do gradiente "de propósito" — para varrer o espaço em vez dos matizes que o hash alcança. Quando o croma foi de 0,06 para 0,075, a cópia ficou para trás: **o teste media uma cor que o app não produzia mais, e nada acusou.** Com paletas curadas o espaço tem quatro pontos e medir os quatro é exaustivo, então a cópia deixou de existir. Duplicação deliberada precisa de mecanismo que a mantenha em dia, ou vira um teste que aprova outro programa. |
| ⚠ Faixa preta em volta do composer — `surface-0` de novo | **Segunda ocorrência do MESMO defeito em dois dias, e as duas foram relatadas por quem usa, não pegas por guarda.** `.rodape` pintava `--vx-surface-0` — o tom do rail e do gutter ultrawide — logo abaixo de uma timeline em `surface-2`, e o campo ficava dentro de uma moldura preta. Medido no `Vortex App.dc.html`: o wrapper do composer tem `padding: 0 20px 14px` e **nenhum** `background` — herda o canvas. Quem separa o campo do conteúdo é a superfície PRÓPRIA da caixa (`surface-3`) mais a borda dela, nunca uma faixa atrás. A régua de topo saiu junto, pelo mesmo motivo. ⚠ **O padrão tem nome agora: `surface-0` usado como "fundo de área que não é conteúdo" onde o design o reserva para RAIL e GUTTER.** Nenhuma guarda vê isso — é cor válida, token válido, contraste válido, no lugar errado. Candidato a mecanismo. |
| Recuo lateral em 20px | **Resolvido, e os dois no mesmo commit de propósito.** O design usa 20 na lista (`padding: 16px 20px 4px` no container de rolagem) e no composer (`0 20px 14px`); mexer só num quebraria a lei "composer alinhado à coluna de mensagem", que é o que a assertion de `dev/alinhamento.ts` guarda. São SETE lugares, porque o recuo da linha é replicado por tudo que se alinha a ela — inclusive o recuo do rótulo de dia, que soma calha do avatar mais vão. ⚠ A barra de ações no hover estava ancorada em 16 e teria ficado 4px fora da coluna: ela se posiciona contra a borda da LINHA, não do conteúdo. Medido: linha 324→1354, conteúdo 344→1334, campo do composer **344→1334**. Altura das linhas inalterada (p25 84 · mediana 150 · p75 327 · média 198, idêntico), então a estimativa da âncora não se move. |
| Gate depois do reskin — o A/B que respondeu | **Não regrediu, e o que decide é a altura da linha contra a estimativa.** A/B com worktree em `b159e009`, mesmo método e máquina: antes `p25 72 · mediana 94 · p75 151 · média 120`, depois `72 · 94 · 155 · 120`, largura 1030 nos dois. Só o p75 sobe 4px, coerente com o `padding` da opção de enquete. Duas corridas headless no código novo deram PASS a 4,1% com âncora ok — mas vazão de **450/500 (90,0%)**, exatamente o piso, com a máquina a 47%: não comparável ao patamar de 2,1%. |
| ⚠ O veredito do arnês devolve PASS com ZERO frames | **Achado tentando o A/B em display, e é sério.** Com o painel do navegador oculto o `rAF` não dispara, e o relatório saiu `0/0 perdidos · Infinity fps · 0 linha · 0 snapshots · dentro do orçamento 0,0%` — **com o selo verde de PASS**. O gate headless tem `AMBIENTE INVÁLIDO` para exatamente isto; o `verdict()` do arnês não tem guarda para relatório vazio. Um gate de merge que aprova sem dados é pior que não ter gate. É a 4ª ocorrência registrada do "painel escondido não compõe", e a primeira em que ele produziu um falso PASS em vez de um travamento visível. |
| Caminho de GPU do headless morreu | **Ambiente, e o próprio `gate.mjs` o documenta.** Depois da segunda corrida, 11 fps e mediana de 100,5ms **em repouso, em qualquer página**, em quatro tentativas — a 47% E a 6% de CPU, então não é disputa. Ficou faltando a terceira corrida da mediana. `VORTEX_GATE_SW=1` existe para diagnosticar e é explicitamente inválido para veredito. |
| Estimativa de altura defasada 13%, e é anterior | Constantes `125 · 86 · 37`; as duas corridas headless mediram `108,5 · 80,9 · 39,3`. Dentro dos 15% da assertion, então nada dispara — mas seria a oitava vez que esses números andam. ⚠ **O A/B acima prova que a defasagem NÃO é do reskin**: antes e depois medem idêntico. |
| Lado lógico no wrapper de Tooltip | **Resolvido.** `LadoLogico` = acima / abaixo / inicio / fim, com o mapeamento lógico→físico lendo a direção real do documento dentro do wrapper. O rail era o único chamador físico e voltou a não saber de que lado da tela está. |
| Passe de primitivos — o método | **A regra que as cinco primeiras seções produziram, e ela decide os conflitos:** a **referência** (`C:/Users/lagun/Downloads/Teste`, rota `#showcase` → aba Componentes) decide **o que EXISTE** — ela é a única fonte com a matriz de estados separada; o **design** decide os **VALORES**. Eles divergiram em quatro pontos e o design ganhou nos quatro. ⚠ **A referência renderiza tipografia 1,15× maior do que declara** (ela roda com `--vx-font-scale`), então medir o PIXEL dela leva ao número errado — ler a classe dela, medir o design. E no tri-state ela diverge do design até na própria nota escrita, com valores que teriam REGREDIDO três dos meus. |
| Selo `LIVE` na sala de voz | ⚠ **Não é falta de tela, é falta de DADO — e as três fontes foram verificadas.** O design e a referência marcam com `LIVE` quem transmite COM ESPECTADORES, distinto do ícone de "transmitindo". (1) `UserVoiceState` do protocolo tem só `is_receiving`, `is_publishing`, `screensharing` e `camera` — não há contagem. (2) `livekit-client` expõe `isSubscribed` da PRÓPRIA conexão; quem publica não recebe contagem de assinantes (isso é webhook de servidor). (3) Na referência é um `live?: boolean` de fixture, sem derivação. ⚠ **E há um segundo bloqueio que anula o contorno:** o motor usa `autoSubscribe: false` e assina SÓ ÁUDIO, então faixa de tela nunca é assinada — "LIVE = alguém está assistindo" daria um selo que nunca acende. Precisa de contagem no servidor (webhook do LiveKit → serviço `api` → campo novo, ou seja fork de backend) OU da grade de vídeo primeiro. Fica FORA do `pendencias.ts` pelo contrato dele: não há controle para clicar — mesma família da etiqueta FÓRUM e da reação SUPER. |
| Passe de primitivos — **as sete seções fechadas** | Botões · campos · tri-state · toggle/checkbox/radio/slider · badge/pill/avatar · abas/segmento/tooltip · banner/estado vazio. Cinco primitivos novos (`Girador`, `Interruptor`, `Marcador`, `Selo`, `Banner`) e **vinte cópias à mão** absorvidas. ⚠ O que o passe mais achou não foi divergência contra a referência — foi **divergência do app contra ele mesmo**: cinco badges com quatro geometrias, oito faixas de erro, cinco checkboxes nativos, dois interruptores. O `pnpm utilities` fez o inventário sozinho em cada rodada, como fizera com as seis cópias do `Avatar`. |
| Abas com sublinhado (`Tabs`) | **Fora por falta de consumidor, e o contraste com o `Banner` é o argumento.** O design as desenha com `box-shadow: inset 0 -2px 0 #35C2CC` nas seções de conta; aqui configurações usa coluna lateral e as abas da caixa de entrada são PÍLULAS, já medidas. `Banner` tinha oito consumidores esperando; `Tabs` tem zero. |
| Respiro do `Dialog` no painel | ⚠ **O painel põe `p-24` e a referência o deixa SEM respiro**, com cabeçalho, corpo e rodapé donos do próprio — que é o que permite a faixa de rodapé em `surface-3` sangrar até a borda. O defeito que isso já causou está registrado duas linhas acima (o grid do modal não chegava ao conteúdo, e dois modais resolveram com `tituloOculto + p-0` à mão). Reestruturar é consumidor a consumidor, e é a última dívida do passe de primitivos. |
| Atalho dentro do `Tooltip` | **Fora.** A referência aceita um atalho em mono ao lado do texto; aqui o atalho é mostrado num BOTÃO de verdade no cabeçalho da coluna de canais — decisão já registrada, porque texto de dica não conserta o recurso ser inalcançável por toque. |
| `warningSubtle` no `Botao` | **Fora por falta de consumidor.** A referência tem seis variantes e eu entreguei cinco: o destrutivo sutil ganhou uso real (a ENTRADA do fluxo de apagar servidor), o de aviso não tem nenhum. Entra na primeira superfície que precise dele — dessincronização de permissão é a candidata óbvia, e é justamente o que o Banner da seção 7 cobre. |
| O anel de foco não é global | ⚠ **Entrou só em `Botao` e `Campo`, e a medição diz por quê.** A referência põe `box-shadow: 0 0 0 1px accent, 0 0 0 4px ring` num `:focus-visible` para o documento inteiro. Aqui há **102 regras de foco e 41 usam `outline-offset` negativo** — elas existem porque o elemento vive dentro de container que RECORTA, e `box-shadow` é recortado onde `outline` não é. Trocar as 102 de uma vez apagaria o foco em 41 lugares sem erro nenhum. É varredura caso a caso: para cada uma, decidir se há recorte. |
| Primitivos de campo que faltam | **`Textarea`, `Select` e `SearchField` existem na referência e aqui são feitos à mão.** A área de texto do assunto do canal, o gatilho de dropdown que substitui `<select>` e os DOIS campos de busca (coluna de canais, filtro de permissões) — cada um com a própria geometria. É a mesma contagem que justificou `Selo` e `Marcador`; ainda não foi feita porque os consumidores são poucos e não divergiram. ⚠ O `SearchField` tem uma armadilha registrada: o campo da coluna de canais é um `button` que abre a paleta, não um `input`, e unificá-los com o filtro (que é `input` de verdade) juntaria duas coisas diferentes. |
| Sobrancelha de formulário duplicada | O rótulo em 11/600 caixa alta com `letter-spacing:0.06em` está escrito duas vezes — `Campo.module.css .rotulo` e `Canal.module.css .rotuloComContador`. São dois CSS Modules e o estilo vai aparecer em toda seção de configuração. **Vira utility na terceira cópia**; antes disso, extrair custa mais que a divergência que evita. |
| `pnpm utilities` não vê componente sem consumidor | ⚠ **Buraco da guarda, achado quando quem usa apontou que a densidade não tinha radio.** Eu construí a forma com rótulo do `Opcao` e ela ficou com ZERO consumidores — exatamente o "scaffold ahead" que essa guarda existe para pegar. Ela não pegou porque confere `className` sem regra e regra sem `className`, e as classes eram consumidas dentro do próprio `Marcador.tsx`. Um export de `components/ui/` que nenhum arquivo fora dele importa é uma varredura barata e ainda não escrita. |
| Pill de cargo | **Fora por falta de DADO, não de tela.** `MemberSnapshot` carrega `cor` — a do cargo hasteado — e não os NOMES dos cargos; a pendência de submenu já registra a mesma causa. Precisa da tabela de cargos resolvida (quais são os do servidor e quais são os desta pessoa), que é fase 6. Geometria já medida na referência para quando chegar: `pad 0 10 0 6`, gap 6, pílula, fundo na cor do cargo a 15%, texto na cor do cargo, 12/600, com ponto de 6px. ⚠ E a cor precisa passar pelo clamp de `corDeCargoLegivel`, senão volta o furo de contraste que a fase 5 fechou. |
| Avatar holográfico | **Fora porque o protocolo não tem o conceito.** `linear-gradient(100deg,#8FE9F0,#C9B6F5 45%,#F3C6A8)` é adorno de conta, não estado de dado — mesma família da etiqueta FÓRUM e da reação SUPER, e como elas fica fora do registro de pendências de propósito: não há controle para clicar. |
| Membros e Convites — as duas tabelas | **Construídas, e `Tabela.module.css` nasceu compartilhado de saída.** As duas são a MESMA tabela com colunas diferentes — moldura, cabeçalho afundado, respiro e divisória idênticos —, e nasceram no mesmo passe: escrevê-las duas vezes seria criar a divergência de propósito. Membros filtra por cargo, busca por nome/username/**ID**, ordena de três jeitos, seleciona em lote e modera. ⚠ **A ordenação por entrada NÃO ordenava**: ela invertia o array alegando ordem ULID — verdade para `fetchMembers`, falsa na página, cuja lista vem dos baldes de PRESENÇA concatenados. `entrouEmMs` entrou no snapshot ao lado de `entrouEm`, como `createdAt` ao lado de `createdAtText`. Passou por typecheck, lint e olho; só apareceu com datas de verdade fora de ordem na coluna. |
| "31 de dez. de 1969" na coluna de entrada | ⚠ **`joinedAt` é tipado como `Date` NÃO-OPCIONAL no SDK**, então membro sem `joined_at` no payload não dá `undefined` — dá `new Date(0)`. Formatar isso escreve uma data plausível, e ninguém desconfia de uma data. Corrigido nos dois lados: `dataDeEntrada()` devolve ausência para epoch zero e NaN, e o firehose passou a espalhar as entradas em 37 dias. O conserto vale para produção também — um servidor que devolva o campo vazio produziria a mesma linha. |
| Três colunas de Convites e duas de Banimentos | ⚠ **Não existem no protocolo, e eu tinha afirmado o contrário.** Na auditoria de páginas eu disse que "criador, usos e expira existem em `Invite`". Só **`creator`** existe: `uses`, `max_uses`, `expires_at`, `temporary` e `vanity` dão **zero** ocorrências no schema do `stoat-api`. Em `ServerBan` é pior — ele tem `_id`, `reason` e o usuário, então "Banido por" e "Data" também não são campos. As cinco ficaram de fora em vez de virar coluna com traço, e o rodapé de cada página diz isso. ⚠ **As duas de banimento VÃO existir:** `/servers/{id}/audit_logs` guarda `BanCreate` com autor e ID ordenável por tempo — a informação está no servidor, só não neste objeto. |
| Falha de rede virando lista vazia | **Resolvido em três telas, e era a mesma mentira nas três.** `listarConvites` e `listarBanidos` devolviam `[]` tanto para "não há nenhum" quanto para "não deu para saber" — a página afirmava um fato enquanto o toast dizia que a consulta não completou. Numa tela de moderação é o pior dos dois erros: alguém criaria um segundo convite acreditando não haver nenhum. Agora devolvem `undefined` e as telas têm TRÊS estados. ⚠ O "carregando" é DERIVADO de para quem a resposta é (`{para, dados}`), e não zerado num efeito: `setState` em cascata dentro de `useEffect` é reprovado pelo lint do projeto, e guardar o alvo resolve o mesmo problema sem render extra. |
| `pnpm utilities` não entendia `composes` | ⚠ **Buraco da guarda, achado na primeira corrida depois de `Tabela.module.css` existir.** Ela acusava `.celula` — a BASE de `.meta` e `.mono` — como morta, porque nenhum `className` do TSX a referencia: quem a consome é o `composes:` das duas filhas. O conserto óbvio para quem acreditasse na guarda seria inlinar nas duas, ou seja, exatamente a duplicação que a base existe para evitar. Corrigido e verificado por mutação. |
| Acesso e Segurança — 1:1 sem back-end nenhum | **Construídas inteiras, e NADA nelas é guardado — nem localmente.** Medido no `OpenAPI.json` de `stoat-api@0.14.0`: `verification_level`, `join_request`, `approval`, `explicit_content_filter` e `dm_settings` dão **zero** ocorrências, e as rotas de `/servers/{id}` são só membros, banimentos, convites, cargos, permissões, emojis e auditoria. Não são campos que faltam; são conceitos que não existem. ⚠ **E por isso não viraram store de cliente, ao contrário de `privacidadeDoServidor.ts`.** Aquela é a decisão de UMA pessoa sobre o que ela recebe, e é o cliente dela que a aplica; estas são política do SERVIDOR sobre todo mundo — guardá-las nesta máquina daria uma regra que só quem a marcou enxerga e que servidor nenhum aplica, o mesmo defeito que manteve `criar enquete` como pendência. Um moderador que visse "Verificação: Alto" grudar acreditaria que o servidor está protegido. Sete entradas novas em `pendencias.ts`, e um `Banner` no topo de cada página: sem ele, cartões que não mudam parecem quebrados. |
| Interruptor pendente mostra o estado VERDADEIRO | Regra que as duas páginas produziram. "Permitir DMs entre membros" nasce **ligado** e não desligado, porque é o que o servidor realmente faz hoje. Um controle pendente que mostra o estado errado deixa de ser "ainda não faz" e vira uma afirmação falsa sobre o servidor — pior que a ausência, que é o critério do registro inteiro. |
| `CartaoDeOpcao` — a quarta cópia | **Extraído, e as quatro divergiam em tudo que dá para divergir.** Modo de entrada (Voz e vídeo), tipo de canal, alcance de DM e filtro (Privacidade do servidor) escreviam o mesmo cartão de rádio: `surface-3` contra `surface-1`, `hairline-06` contra `rgb(255 255 255 / 7%)` cru, hover de borda contra hover de fundo, `outline-offset: 2px` contra `-2px`. Nenhuma errada isolada — é o app divergindo DE SI MESMO, como as seis cópias do `Avatar`. Os valores agora são os do design (`row(on)`: gap 11 · 13/14 · raio 8 · acento a 10%/35%), medidos em navegador. O `pnpm utilities` acusou as oito regras órfãs uma a uma. |
| Nav de servidor em quatro grupos | **Era uma lista plana de oito e o design tem quatro grupos** — SERVIDOR · EXPRESSÕES · PESSOAS · MODERAÇÃO. Com oito itens seguidos "Banimentos" fica do lado de "Emojis" e nada diz que um é moderação e o outro é expressão: a coluna vira inventário em vez de mapa. ⚠ **A lista plana passou a ser DERIVADA dos grupos.** Com as duas à mão, seção nova entraria numa e não na outra, e o sintoma seria uma página alcançável pelo menu do servidor e invisível na coluna — "não está em grupo nenhum" deixou de ser estado possível. |
| Páginas de servidor que AINDA faltam | ⚠ **Cinco, e uma delas é real.** **Registro de auditoria** é a única com protocolo: `GET /servers/{target}/audit_logs` existe, com filtro por autor, por alvo e por tipo, e `AuditLogEntryAction` é união marcada (`MessageDelete`, `MessageBulkDelete`, `MessagePin`, `BanCreate`, …). É a de maior valor que sobra, e destrava de quebra as duas colunas de Banimentos. As outras quatro — **Tag do servidor**, **Modelo do servidor**, **Figurinhas** e **Painel de efeitos sonoros** — não têm campo, rota nem evento no Stoat, e são páginas inteiras com upload atrás. Faltam ainda os **contadores** ao lado de cada item da nav (1.204 · 9 · 6 · 37 · 24/50), que o design mostra: membros e cargos saem de graça, convites e banimentos custam uma chamada por abertura da coluna. |
| Desfazer o desbanimento por toast | **Não construído, e não é pendência de controle.** O design promete um toast com "desfazer" por 8 segundos; o `Toast` deste projeto não tem ação, só título e descrição. Não há alvo desenhado para clicar, então fica fora de `pendencias.ts` pelo contrato dele — mesma família da etiqueta FÓRUM. Entra junto com ação em toast, que serve a mais de um consumidor. |
| Arnês mais pobre que o protocolo — 10ª vez | **Convites e banimentos passam por `fetchInvites`/`fetchBans`, que são REDE**, e o firehose não os intercepta. As duas tabelas só são vistas localmente nos estados vazio e de falha; as linhas com dado nunca foram exercitadas em navegador. É a mesma família das nove anteriores, com a diferença de que o conserto aqui é dublar o `client`, não enriquecer o gerador. |
| Tri-state: "acima da sua hierarquia" | **Fora, e já era pendência antes desta rodada.** Depende de comparar o rank do meu cargo com o da outra pessoa — tabela de cargos resolvida, fase 6. A referência o mostra como o grupo inteiro em `opacity:0.45` com os botões desabilitados. Um item cinza com um motivo inventado é pior que a ausência. |

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