# web-react — o cliente Vortex em React

Ilha nova, irmã de `web/`. Porte do cliente de Solid.js para React, com
redesenho completo do front-end.

**Leia `../CLAUDE.md` antes de escrever qualquer coisa aqui.** Este arquivo
cobre só o que é específico da ilha; as decisões de arquitetura e as leis do
projeto estão lá.

## Relação com `web/`

As duas convivem. `web/` continua sendo o cliente que está no ar e é a
**implementação de referência** — a fonte de como o protocolo é usado, como as
telas se comportam e onde estão os casos de borda que ninguém lembra que
existem.

`web/` é para **ler**, não para editar. Correção que precise entrar nos dois
lados é a exceção, e nesse caso entra nos dois explicitamente. `web/` só é
removido quando `web-react/` atingir paridade — o que é uma decisão de produto,
não de código.

Conforme o VORTEX.md, cada diretório de topo é uma ilha: lockfile, toolchain e
build próprios. `web-react/` compartilha com as outras apenas `brand/`.

## Stack decidida

| Camada | Escolha | Por quê está em `../CLAUDE.md` |
|---|---|---|
| Framework | React 19 + TypeScript | § Portar Solid → React |
| Compiler | React Compiler, ativo desde o dia 1 | § React Compiler ativo desde o dia 1 |
| Build | Vite | herdado de `web/`, sem motivo para divergir |
| Estilo | Tailwind v4 sobre `tokens.css` + `@theme` | § Estilização: Tailwind v4 sobre tokens em CSS puro |
| Escape hatch de estilo | CSS Modules | idem |
| Primitivos | Radix | § Radix, não Base UI |
| Virtualização | TanStack Virtual, modo chat (`anchorTo: 'end'`) | § TanStack Virtual, modo chat |
| Estado de servidor | `@tanstack/react-query` | troca 1:1 do `solid-query` |
| Estado de entidade | store module-level + `useSyncExternalStore` | § As seis leis, lei 1 |
| Ícones | Phosphor, weight `regular`, 20px — um set só | skill `vortex-react` |
| i18n | `@lingui/react` | o fork `js-lingui-solid` não atravessa |
| Voz | `@livekit/components-react` | o fork `solid-livekit-components` não atravessa |

Nenhuma dependência foi instalada ainda — as versões se resolvem na primeira
instalação, não são chutadas aqui.

## O que atravessa de `web/` sem reescrita

Vale conferir antes de reimplementar qualquer coisa. Estes são agnósticos de
framework e custam um wrapper, não um porte:

- **Composer:** ProseMirror + CodeMirror 6
- **Markdown:** pipeline `unified` (remark/rehype), `shiki`/`lowlight`, `katex`
- **SDK:** `stoat.js` — atravessa como está, atrás do adapter

## O que não atravessa

Panda CSS, `@material/web`, `mdui`, `@material/material-color-utilities`,
`@minht11/solid-virtual-container`, os três sets de ícone Material,
`solid-icons`, e os dois submodules de adaptação ao Solid.

A camada de estilo não é migrada — é descartada. `tokens.css` é a primeira vez
que este projeto tem tokens; não é refinamento do que existe.

## O SDK desta ilha

`web-react/packages/stoat.js` é submodule próprio, mesmo upstream que o de
`web/` (`stoatchat/javascript-client-sdk`), **pinado no mesmo commit**:
`30b8505b`.

### O SDK é transporte, não fundação

**O Vortex não é o Stoat com outra cara.** É um produto separado, com features
que o Stoat não tem. O `stoat.js` é como o app fala com o backend hoje — não é a
espinha dele.

Isso não é declaração de intenção; tem mecanismo:

- **Os tipos de domínio são do app**, nunca derivados dos tipos do SDK. Derivar
  faz a forma do protocolo vazar para todo componente, e aí a primeira feature
  que o Stoat não tem vira refactor do app inteiro.
- **`stoat.js` só pode ser importado dentro de `src/sdk/`** — lint de boundary,
  simétrico ao que confina o Radix a `components/ui/`. Vale para tipo também:
  `import type` acopla igual.
- O adapter é **camada anticorrupção**: SDK entra, domínio sai. É o único lugar
  do código que sabe qual SDK existe.

```
stoat.js  →  src/sdk/ (mapeia)  →  domínio do Vortex  →  componentes
             ^^^^^^^^^^^^^^^^^^
             única fronteira que importa o SDK
```

Campo que o Vortex tem e o protocolo não tem entra no tipo de domínio **desde
já**, com default preenchido pelo adapter. Não espere o backend para modelar o
produto.

Está decidido que a divergência é de **produto**, não de protocolo: o Vortex
continua falando Stoat. O caminho previsto para feature que o protocolo não tem
é forkar o serviço de backend dono daquela superfície — `api`, `events` — e
manter os outros seis pinados em upstream. Ver § Divergência de produto no
`../CLAUDE.md`.

Consequência prática: endpoint ou evento novo é trabalho **dentro de
`src/sdk/`** mais o tipo de domínio que já existe — não uma reescrita de
componente. É exatamente o cenário para o qual a camada anticorrupção existe.
Ver `state-bridge.md` e `enforcement.md`.

### Por que não o pacote do npm

O SDK é publicado, o que parecia a saída limpa — sem submodule, sem mexer no
`.gitmodules` da raiz. Não serve: o commit pinado está **31 commits à frente do
npm** (`7.3.6`), e o intervalo carrega funcionalidade que o cliente usa —
statuses de voz, slowmode, limites de usuário, pronomes, logout, MFA em revoke
de sessão — mais `e1a9c8a8`, que otimiza carregamento de membros em servidor
grande. Essa é exatamente a condição que o firehose existe para medir.

Usar o npm faria esta ilha portar contra um SDK mais velho que a implementação
de referência, justamente na fase em que comparar as duas lado a lado é o método
de verificação. Divergência de comportamento viraria indistinguível de bug de
porte.

O `stoat-api` pinado dentro do SDK (`0.14.0`) acompanha o backend que a
instância roda, não o latest do npm — por isso o `minimumReleaseAgeExclude` no
workspace.

### Por que não referenciar o de `web/`

`link:../../web/packages/stoat.js` faria o lockfile desta ilha depender de um
caminho fora da própria raiz, e o build deixaria de ser self-contained — quebra
contexto de Docker e checkout de CI. É precisamente o que a regra de ilha do
VORTEX.md protege.

O custo do submodule duplicado é 464K de working tree, com os objetos em
`.git/modules/`. Não é disco.

### O custo real

**Dois gitlinks que precisam andar juntos.** Se um subir e o outro não, as duas
ilhas rodam SDKs diferentes — e isso não dá erro, só diverge em silêncio.

Mecanizado: `.github/workflows/sdk-lockstep.yml` compara os dois gitlinks e falha
se divergirem. Registrado em `enforcement.md` como invariante de Fase 0.

**Ao subir a versão do SDK, suba os dois no mesmo commit.**

### Build

`lib/` não existe no checkout e o `exports` aponta para `./lib/index.js` — o SDK
precisa de `tsc` antes do client. Vale igual para o `web/` hoje.

## A armadilha que custou mais caro

Vale registrar porque o erro de diagnóstico foi mais caro que o bug.

**Sintoma:** editar uma mensagem não atualizava a linha. Parecia que a ponte
Solid → React estava quebrada — a lei nº 1 inteira.

**Diagnóstico errado, três vezes.** Descartei fila de efeitos do Solid
(`createComputed` não mudou nada), duas cópias do `solid-js` (uma no disco,
uma URL no `.vite/deps`), e núcleo reativo duplicado no bundle do
`solid-js/store` (não duplica, importa). Todos falsos.

**Causa real:** a lista estava no *começo* do histórico, não no fim. As linhas
montadas assinavam as mensagens mais antigas, e eu editava a mais recente —
que ninguém assinava. O efeito não re-rodar era o comportamento **correto**.

**E a causa daquilo:** `seed()` chamava `startAdapter()` antes do laço, então
cada mensagem criada emitia `messageCreate` e a lista crescia evento a evento
durante a carga. No fim, `seedChannel` republicava as 10.000 de uma vez, e o
salto destruía a âncora.

**A regra que fica:** carga em massa e chegada incremental são caminhos
diferentes. Popular um canal não pode passar pelo caminho de evento — duas
fontes competindo pela mesma lista custam a âncora, e a âncora é o que o
usuário percebe. Vale para o histórico paginado tanto quanto para o seed.

**Como foi fechado:** o arnês ganhou `data-mid` em cada linha e a sonda
`editarId`, que edita um id lido do DOM e devolve `assinantes`, `noSdk` e
`noStore`. Testar com um id comprovadamente montado tirou toda a ambiguidade —
e deveria ter sido o primeiro passo, não o último.

### A segunda armadilha, encontrada pelo mesmo mecanismo

Os PASS sem throttle mediam uma lista que **não seguia o fim** — o
`followOnAppend` estava desligado sem erro nenhum, e um app parado passa em
qualquer gate. Duas causas: faltava `scrollToEnd()` após a carga (regra de
`component-primitives.md` que foi pulada), e `useFlushSync: false` quebra a
compensação de âncora — medido: com ele, a lista fica ~1000px atrás e deriva
880px/s; sem ele, oscila 1–23px do fim.

O arnês agora invalida corrida que termine longe do fim, pelo mesmo motivo
que invalida corrida com rAF suspenso: **medição de lista parada não é
medição.**

## Fase 0 — o spike

Antes de qualquer UI. Só a lista de mensagens, e o alvo é medido, não sentido:

> **500 eventos/s a 60fps com 10k mensagens carregadas.**

Quatro peças:

1. Ponte `stoat.js` → store externo com `useSyncExternalStore`
2. TanStack Virtual em modo chat
3. Firehose sintético (presença/mensagem/typing/reaction contra o store)
4. Enforcement de base — as seis linhas marcadas "Fase 0" em
   `.claude/skills/vortex-react/references/enforcement.md`: lint contra índice
   como `key`, lint de `any` na fronteira do SDK, assertion de estabilidade de
   `getSnapshot`, assertion de remedição após mudança de largura do container, e
   o firehose como gate de merge. A sexta — lockstep dos gitlinks do SDK — já
   está de pé

O spike existe para responder uma pergunta em aberto: **TanStack Virtual é
compatível com o React Compiler?** Houve relato de que não. Se conflitar, a
alternativa é `react-virtuoso` — e o custo de descobrir isso passa a ser três
dias em vez de três meses.

Segurou o alvo? O resto do app é mais fácil que isso.

### O que a lei nº 6 acrescenta ao spike

O `CLAUDE.md` fixou a customização de layout como decisão tomada agora, aplicada
na fase 4. Uma das invariantes vale desde este spike:

> Largura de container mudou = virtualizador remede e reancora.

Na fase 4 a causa é o usuário arrastando a borda de um slot. Mas as causas
existem desde já — janela redimensionada, sidebar colapsada, popout, painel de
thread abrindo. **É a mesma invariante, e é barata agora.**

Concretamente, o virtualizador do spike não pode assumir largura estável: mede
por container query / `ResizeObserver`, e ao remedir preserva a âncora em vez de
saltar. Se ele nascer assumindo largura fixa, a fase 4 é reescrita da tela — que
é exatamente o que a lei nº 2 diz sobre retrofit.

**A assertion que guarda isso foi antecipada da fase 2 para a fase 0** e é o
quinto item da lista acima. Ela vive no mesmo wrapper de virtualizador: em dev,
se a largura do container mudar sem que uma remedição tenha sido pedida, avisa
alto. Escrita junto com o wrapper custa o que custaria de qualquer forma;
escrita duas fases depois, chega sobre código que já pode ter violado a regra.
