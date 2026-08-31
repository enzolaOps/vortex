---
name: vortex-react
description: Padrões de arquitetura, performance e design para o Vortex — cliente de chat em tempo real (fork do Stoat/Revolt) portado de Solid.js para React, rodando em web e Electron. Use SEMPRE que a tarefa envolver o Vortex, o cliente de chat, ponte com stoat.js, lista de mensagens, lista de membros, presença, typing indicator, rail de servidores, composer, tema/tokens, layout ultrawide, ou a casca Electron. Dispare também quando o pedido for só "arruma esse componente", "deixa isso mais bonito", "tá lento", "tá quebrado no monitor grande" ou qualquer trabalho de front-end nesse repositório, mesmo sem citar as regras por nome — esta skill fornece a arquitetura de estado obrigatória, o orçamento de performance e o sistema de design sem os quais o resultado degrada silenciosamente.
---

# Vortex — cliente de chat em React

## O produto

Vortex é um cliente de chat em tempo real, fork do Stoat (ex-Revolt), sendo
portado de Solid.js para React. App shell persistente de 4 colunas, denso,
dark-first, sessões de 8h+. **Não é landing page.** Legibilidade e baixo ruído
visual ganham de impacto visual.

**Web e desktop são o mesmo front-end.** O Electron envolve este mesmo cliente.
Não existem dois designs — existe um, com uma casca fina por cima.

## Stack

- React 19 + TypeScript, Vite, monorepo pnpm
- React Compiler ativo (memoização automática em build)
- `stoat.js` como SDK — **reatividade nativa Solid**, nunca consumida direto em React
- Electron para desktop, envolvendo o mesmo bundle
- Primitivos: **Radix**, não Base UI — Base UI ainda não tem Context Menu,
  Hover Card nem Toast, que é justamente o que um cliente de chat mais usa
- Virtualização: **TanStack Virtual em modo chat** (`anchorTo: 'end'`)
- Estilo: **Tailwind v4** sobre tokens em CSS custom properties, com CSS Modules
  como escape hatch
- Ícones: Phosphor, weight `regular`, 20px. Um set só, sem exceção.

## As seis leis

Estas seis decisões determinam se o projeto escala ou apodrece. Tudo o mais é
detalhe. Se uma tarefa colidir com uma delas, pare e levante a questão em vez de
contornar.

### 1. Estado mora fora do React, com subscrição por entidade

`stoat.js` é reativo em Solid. A ponte para React é a peça mais crítica do
projeto — é onde a performance é ganha ou perdida.

Store externo, módulo-level, com `useSyncExternalStore` keyed por ID de
entidade. Cada `MessageRow` assina *aquela* mensagem. Editar uma mensagem toca
uma linha, não a lista.

**Nunca coloque dado de entidade em Context.** Context propaga tudo-ou-nada por
design — é o caminho mais rápido para jank em servidor grande.

→ Leia `references/state-bridge.md` antes de tocar em qualquer coisa que leia
dados do SDK. Contém o formato do store, a armadilha do `getSnapshot` instável,
e como isolar estado efêmero de alta frequência.

### 2. Virtualização desde a primeira linha

Lista de mensagens é o pior caso de virtualização que existe: altura variável,
scroll bidirecional, âncora que precisa sobreviver a imagem carregando.
Retrofitar isso depois é reescrever a tela.

→ `references/performance.md`

### 3. Layout em Grid com `minmax(0, 1fr)`, coluna de texto com teto

O bug de ultrawide que já existe hoje tem uma causa: coluna `1fr` sem
`minmax(0, ...)` e coluna de mensagem sem `max-inline-size`. Texto esticando até
3000px não é responsividade, é ausência de decisão.

→ `references/design-system.md`

### 4. Zero valor mágico em componente

Nenhum hex, nenhum `px` avulso, nenhuma sombra literal dentro de componente. Só
tokens semânticos. O Stoat suporta temas de usuário — hardcodar cor quebra isso
silenciosamente.

Os tokens vivem em CSS custom properties (`tokens.css`); o Tailwind apenas
projeta utilities em cima. **Arbitrary value (`bg-[#2b2d31]`, `p-[13px]`) é
valor mágico com outro nome** e está banido com lint. A escala de cor default do
Tailwind está desativada: `bg-zinc-800` não existe, só `bg-surface-2`.

→ `references/styling.md` · esqueleto em `assets/tokens.css`

### 5. Biblioteca resolve o genérico; você escreve o específico

Primitivo headless (Radix) para o que é difícil e igual em todo app: foco preso
em modal, roving tabindex, posicionamento contra a borda do viewport, leitor de
tela. Escrever isso à mão é desperdício com a11y quebrada.

Message list, rail, member list e composer você escreve. Não existem em
biblioteca nenhuma. Se aparecer uma "biblioteca de chat React" pronta, ela traz
modelo de dados, estilo e estado próprios — os três lugares onde este projeto já
tem decisão tomada. Recusar.

Todo primitivo entra por wrapper em `components/ui/`, nunca importado direto numa
feature.

→ `references/component-primitives.md`

### 6. Todo componente nasce movível

O layout será customizável pelo usuário (fase 4). Não se constrói agora, mas
todo componente escrito a partir de agora precisa nascer com quatro
propriedades: dirigido por container query · sem premissa sobre irmãos · sem
premissa de lado (propriedades lógicas, não `left`/`right`) · sem dimensão fixa,
com estado vindo do store e não da posição na árvore.

Retrofitar isso depois é reescrever os componentes.

→ `references/design-system.md` · `references/layout-customization.md`

## Decisões tomadas cedo, aplicadas tarde

Estas valem **agora**, mesmo que a feature correspondente seja de uma fase
futura. Estão aqui, e não só na referência da fase, porque uma regra que vive num
arquivo lido daqui a três meses é uma regra esquecida.

- **Preset nunca carrega dado de sessão.** Só layout e tema. Nenhum ID de canal,
  servidor ou usuário. É privacidade, não performance: preset já compartilhado
  não volta atrás. O tipo do preset deve tornar isso irrepresentável — não um
  campo opcional que alguém possa preencher.
- **Chave desconhecida em preset é preservada, nunca descartada.** Preset feito
  numa versão futura não pode ser destruído ao ser aberto numa versão antiga.
- **Largura de container mudou = virtualizador remede e reancora.** Vale para
  qualquer causa, não só o resize de slot da fase 4.

## Enforcement

Regra escrita depende de alguém lembrar; mecanismo não. Toda invariante crítica
deste projeto tem um mecanismo que a faz falhar sozinha — lint, tipo, teste ou
assertion em dev.

Ordem de preferência: **tornar impossível > tipo > lint > teste > assertion em
dev > checklist > prosa.**

Invariante nova descoberta durante a implementação entra em
`references/enforcement.md` **com um mecanismo**, não só como prosa. Se não der
para mecanizar, provavelmente a regra está vaga demais para ser seguida.

→ `references/enforcement.md`

## Referências

Leia sob demanda, não todas de uma vez:

| Arquivo | Quando ler |
|---|---|
| `references/state-bridge.md` | Qualquer coisa que leia ou escreva dados do SDK, subscrições, presença, typing |
| `references/component-primitives.md` | Adicionar menu, modal, popover, tooltip, toast; virtualização; escolher ou recusar biblioteca |
| `references/performance.md` | Listas, virtualização, markdown, "tá lento", profiling |
| `references/design-system.md` | Tokens, cores, layout, shell, ultrawide, estados, a11y, motion |
| `references/styling.md` | Escrever CSS, escolher entre utility e CSS Module, adicionar token, tema |
| `references/layout-customization.md` | Slots, modo edição, preset, tema de usuário, painel movível |
| `references/concorrentes.md` | Decidir se uma feature entra, e em que fase; "por que assim e não como o Discord"; escopo de produto |
| `references/electron.md` | Titlebar, janelas, IPC, tray, badge, diferenças web↔desktop |
| `references/review-checklist.md` | Antes de fechar qualquer entrega |
| `references/enforcement.md` | Configurar lint, teste ou assertion; registrar invariante nova |

## Regras de React neste projeto

O React Compiler cuida da memoização. Estas são as que ele **não** cobre:

- **Key é ID de entidade, nunca índice.** Índice em lista de chat corrompe estado
  de linha em cada inserção no topo.
- **`StrictMode` invoca effects duas vezes em dev.** Numa app 100% websocket isso
  gera listener duplicado e mensagem dobrada. A defesa é estrutural: subscrição
  vive no store module-level com refcount, não em `useEffect` por componente.
- **Nada de `useEffect` para estado derivado.** Derive no render. Effect é para
  sincronizar com sistema externo, só isso.
- **Nada de `useEffect` para buscar dado que o store já tem.** O store é a fonte.
- **Não desative o React Compiler para "otimizar na mão".** Se ele está bloqueando
  algo, o código está quebrando as Rules of React — conserte o código.

## Como abordar uma tarefa

Antes de escrever código, responda em até 10 linhas:

1. superfície a alterar
2. arquivos que vai abrir e por quê
3. tokens e componentes existentes que serão reutilizados
4. o que muda em `<1440px`, `1440–2560px`, `>2560px`
5. menor patch possível

Depois implemente em passos verificáveis. Patch pequeno. Padrão existente
preservado. Dependência nova precisa de justificativa explícita.

Problema encontrado fora do escopo vira **pendência listada**, não correção
silenciosa.

## Antipadrões — recusar e explicar

- Trazer biblioteca React genérica de componente para resolver superfície
  específica de chat. Message list, member list, composer e rail não existem em
  biblioteca nenhuma. São feitos à mão de qualquer jeito.
- Gradiente roxo/azul genérico como identidade.
- Glass / blur em painel de produtividade. Custa GPU em sessão longa e reduz
  legibilidade em texto denso.
- Card centralizado com padding grande dentro do app shell.
- Misturar dois sets de ícone.
- Alterar camada de rede ou de estado em ticket de visual.
- Refactor de arquitetura ou troca de dependência não solicitados.
- `any` em contrato de dados vindo do SDK. Se o tipo está faltando, declare-o.

## Formato de entrega

Termine sempre com:

1. arquivos alterados
2. resumo objetivo das mudanças
3. comportamento em cada breakpoint (quando tocou layout)
4. pendências e riscos

Sem log completo, sem despejar código inteiro quando o diff basta.
