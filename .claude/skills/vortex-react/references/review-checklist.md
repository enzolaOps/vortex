# Checklist de revisão

Rode antes de fechar qualquer entrega. Marque apenas o que se aplica ao que a
tarefa tocou — não é burocracia para preencher, é o conjunto de erros que
degradam este projeto silenciosamente.

## Estado

- [ ] `getSnapshot` devolve referência cacheada, sem alocação por chamada
- [ ] Subscrição por entidade, não por coleção
- [ ] Nenhum dado de entidade em Context
- [ ] Estado efêmero de alta frequência em store separado e com throttle
- [ ] Subscrição idempotente sob `StrictMode`
- [ ] Sem `useEffect` para estado derivado ou para dado que o store já tem
- [ ] Sem `any` na fronteira do SDK
- [ ] Nenhum tipo do SDK fora de `src/sdk/` — snapshot é tipo de domínio do Vortex
- [ ] Caminho de reconexão considerado

## Performance

- [ ] `key` é ID de entidade, nunca índice
- [ ] Lista longa virtualizada, com ancoragem preservada
- [ ] Mídia com dimensão reservada — sem layout shift
- [ ] Markdown vindo de cache de AST, não reparseado no render
- [ ] Nenhum listener sem cleanup verificado
- [ ] Firehose sintético rodado, se tocou store, lista ou linha de mensagem

## Layout

- [ ] `minmax(0, 1fr)` no grid e `min-width: 0` em filho flex
- [ ] Coluna de mensagem com `max-inline-size`; composer alinhado a ela
- [ ] Painel responde por container query, não por viewport
- [ ] Verificado em `<1440px`, `1440–2560px`, `>2560px`
- [ ] Caso patológico testado: URL de 400 caracteres sem espaço

## Movibilidade (lei nº 6)

- [ ] Componente não assume o que está ao lado, nem que existe algo ao lado
- [ ] Funciona à esquerda e à direita — propriedades lógicas, não `left`/`right`
- [ ] Sem dimensão fixa
- [ ] Estado vem do store, não da posição na árvore

## Visual

- [ ] Zero hex, px avulso ou sombra literal em componente
- [ ] Nenhum arbitrary value (`bg-[#…]`, `p-[13px]`)
- [ ] Nenhuma cor da escala default do Tailwind (`bg-zinc-800` e afins)
- [ ] Token novo entrou em `tokens.css`, não direto no `@theme`
- [ ] Valores dentro das escalas de espaço, raio e tipo
- [ ] Profundidade por camada de superfície, não por sombra
- [ ] Um único set de ícone, weight consistente
- [ ] Trocar o tema ainda funciona no componente alterado

## Estados

- [ ] Os oito cobertos: default, hover, active, focus-visible, disabled,
      loading, empty, error
- [ ] Empty state com ação primária, sem ilustração genérica
- [ ] Erro diz o que houve e como resolver, sem pedir desculpa

## Acessibilidade

- [ ] Contraste 4.5:1 em texto, 3:1 em borda de controle
- [ ] `focus-visible` visível, com offset
- [ ] Fluxo completo por teclado
- [ ] `prefers-reduced-motion` respeitado
- [ ] Presença comunicada por cor **e** forma

## Electron

- [ ] Rodou na web também
- [ ] Nenhum interativo preso na região de arraste
- [ ] Nenhuma configuração de segurança afrouxada
- [ ] Canal IPC novo valida payload no main
- [ ] Comportamento com janela em background verificado

## Escopo

- [ ] Sem refactor de arquitetura não solicitado
- [ ] Sem dependência nova sem justificativa
- [ ] Problema fora do escopo listado como pendência, não corrigido em silêncio
- [ ] Patch pequeno; nenhum arquivo reescrito inteiro sem necessidade

---

## Os cinco que mais quebram este projeto

Se for conferir só uma coisa, confira estes. São os que não dão erro — só
degradam:

1. `getSnapshot` alocando objeto novo → loop de render, aba travando
2. Dado de entidade em Context → jank em servidor grande, invisível em dev
3. `minmax(0, 1fr)` faltando → grid estoura com URL longa
4. Markdown reparseado no render → lento só quando a presença começa a piscar
5. Listener sem cleanup → vazamento que só aparece na sexta hora de sessão
