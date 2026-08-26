# Performance

## Orçamento

60fps = **16,6ms por frame**. Render de uma linha de mensagem em React é
sub-milissegundo. Você tem folga para centenas de renders de linha por frame.

Disso segue a única regra que importa: **o problema nunca é o custo unitário de
render. É update não-escopado atingindo milhares de componentes.** Toda
otimização real neste projeto é sobre escopo, não sobre velocidade de render.

Se a resposta para "por que está lento" for "React é lento", a análise não foi
feita.

## Ordem de impacto

Quando algo estiver lento, investigue nesta ordem. Está ordenado por quanto
costuma pesar num cliente de chat:

1. **Escopo de update** — quantos componentes um evento acorda
2. **Virtualização e ancoragem de scroll**
3. **Reparse de markdown / emoji**
4. **Decodificação e layout de mídia**
5. Tamanho de bundle

Pular direto para o 5 é o erro mais comum.

## Virtualização

Obrigatória desde o primeiro commit da lista. Retrofit é reescrita.

Lista de chat é o pior caso da categoria. O que precisa funcionar:

- **Altura variável e desconhecida** até medir
- **Scroll bidirecional** — histórico carrega para cima
- **Ancoragem**: carregar mensagens antigas não pode mover o viewport
- **Imagem carregando não pode empurrar o conteúdo.** Reserve espaço com
  `aspect-ratio` a partir das dimensões que vêm no metadata do anexo. Se não
  vierem, use placeholder de proporção fixa. Layout shift em lista virtualizada
  quebra a ancoragem e o usuário perde o lugar.
- **"Grudar embaixo"** quando o usuário está no fim, e *não* grudar quando ele
  rolou para cima lendo histórico
- Preservar seleção de texto durante update

Não escreva virtualização do zero. A escolha e a configuração concreta estão em
`component-primitives.md` — **TanStack Virtual em modo chat**, com
`anchorTo: 'end'` e `followOnAppend`, em ordem normal.

Nada de `flex-direction: column-reverse`, transform invertido ou compensação
manual de `scrollTop`. Essas gambiarras clássicas de chat deixaram de ser
necessárias, e cada uma quebra seleção de texto ou acessibilidade.

## Markdown e emoji

Reparsear markdown a cada render é o gargalo silencioso mais comum em cliente de
chat. Não aparece em lista parada; aparece quando a presença começa a piscar e
tudo re-renderiza junto.

**Parse uma vez para AST. Cache por `(messageId, editedAt)`. Renderize a partir
do AST.**

Nunca regex sobre conteúdo dentro do render. Nunca `dangerouslySetInnerHTML` com
conteúdo de usuário — é XSS direto num app onde qualquer pessoa pode mandar
texto. Renderize do AST para elementos React, com allowlist de nós.

Cache com limite (LRU). Sessão de 8h com dezenas de canais estoura memória se o
cache crescer sem teto.

## React Compiler

Ativo desde o dia 1. Ele memoiza automaticamente e elimina a maior parte da
disciplina manual de `memo`/`useCallback`.

O que isso muda na prática: **pare de otimizar preventivamente.** Escreva código
idiomático, meça, e só intervenha onde o profiler apontar.

O que ele exige em troca: seguir as Rules of React. Componente puro, sem mutação
de props ou de state durante o render, sem ler ref no render. Se o lint do
compiler reclamar, o código está errado — não desative a regra.

## Medição

**Nunca otimize sem profiler.** React DevTools Profiler responde exatamente qual
componente renderizou e por quê. Essa é a maior vantagem prática do React neste
projeto — use.

Tenha um **script de firehose sintético**: dispara N eventos/s de presença,
mensagem, typing e reaction contra o store. Alvo mínimo: 500 eventos/s
segurando 60fps com um canal de 10k mensagens carregado.

Rode isso antes de qualquer merge que toque store, lista ou linha de mensagem.
É a única forma de pegar regressão de escopo — ela nunca aparece em uso normal
de desenvolvimento, só em servidor grande com usuário real.

## Padrões que custam caro

- Índice como `key` — corrompe estado ao inserir no topo
- Derivar lista com `.filter()`/`.sort()` no corpo do componente sem memo, quando
  a fonte muda a cada evento
- `useEffect` que sincroniza store com state local — duplica a fonte da verdade e
  dobra os renders
- Handler de scroll sem `passive: true` e sem coalescer em `requestAnimationFrame`
- `ResizeObserver` por linha sem batching
- Animar `width`/`height`/`top`/`left`. Só `transform` e `opacity`.
- `backdrop-filter` em superfície grande e persistente — custa GPU continuamente,
  não só na transição

## Mídia

- Dimensões explícitas sempre, para evitar shift
- `loading="lazy"` e `decoding="async"` fora do viewport
- Miniatura primeiro, original só no visualizador
- Revogue object URLs — vazamento de blob em sessão longa é real
- GIF/vídeo em autoplay: pausar quando fora do viewport e quando
  `document.hidden`

## Sessão longa

O app fica aberto 8h. Vazamento que seria irrelevante numa página vira crash.

- Todo listener registrado tem cleanup verificado
- Cache de mensagem por canal com teto e evicção
- Timer e interval cancelados no unmount
- Quando `document.hidden`: pausar animação, throttle mais agressivo de
  presença, parar decodificação de mídia

Meça memória com a aba aberta por horas, não por minutos.
