---
target: cliente Vortex — revisão completa pós-etapas do plano
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-28T04-05-09Z
slug: web-react-packages-client-src
---
Method: dual-agent (A: a27fdefac3f75accd · B: aadfaf313a699041d)

⚠ A árvore mudou durante a crítica: 52 arquivos de `src/` tocados em 70 minutos e o bundle servido substituído no meio (trabalho da etapa 7 em paralelo). Os cinco achados prioritários foram re-verificados na fonte atual.

## Nota de saúde: 24/40 — Aceitável, no piso da faixa

| # | Heurística | Nota | Questão-chave |
|---|---|---|---|
| 1 | Visibilidade do estado | 3 | Faixa de conexão exemplar; `aria-busy` e skeleton aparecem 0 vezes; sessão "desconhecida" renderiza null |
| 2 | Sistema ↔ mundo real | 3 | Copy específico e bom; "fechar" vs "concluir" não mapeiam para descartar/manter |
| 3 | Controle e liberdade | 2 | Sem desfazer em lugar nenhum; "fechar" destrói layout + paleta em silêncio |
| 4 | Consistência e padrões | 2 | Composer 1888px sobre texto de 520px; hover 3 emoji, botão direito 6 |
| 5 | Prevenção de erro | 3 | Picker é 4 sozinho — contraste ruim é irrepresentável. Perde no "fechar" e no sair-da-chamada de 32px |
| 6 | Reconhecer > lembrar | 3 | ⌘K impresso, aria-activedescendant correto; larguras de slot são texto não editável |
| 7 | Flexibilidade e eficiência | 2 | Aceleradores excelentes para layout, zero para mensagem — o objeto central |
| 8 | Estética e minimalismo | 2 | A 2560px, 1.436px de vazio à direita; divisor de dia 692px fora do centro |
| 9 | Diagnosticar e recuperar | 2 | Pedido de amizade que falha não mostra nada; sem "tentar de novo" em nenhuma superfície |
| 10 | Ajuda e documentação | 2 | /config/aparencia explica bem — e a explicação de que sair desfaz está lá, não onde o botão está |
| **Total** | | **24/40** | **Aceitável** |

Divergência da Assessment A: ela deu 3 em flexibilidade; a nota final é 2, porque todos os aceleradores servem à moldura e nenhum ao objeto que a pessoa manipula 8h/dia.

## Veredito de especificidade

O sistema é autoral; as superfícies não são. Paleta OKLCH com luminosidade decidida pelo app, medida de leitura em rem, divisor sem régua, lâmina tirada da marca — nada disso é genérico. Mas a composição é o Discord, /entrar não tem marca nenhuma (zero img e zero svg no documento), o canal de voz renderiza o empty state de um canal de texto, e a coluna de leitura discorda de si mesma. Troque tokens.css e vira qualquer cliente de chat.

## Varredura determinística

detect.mjs: 1 achado, `side-tab` em AvisoDeLink.module.css:38 — falso positivo (marcador semântico de perigo). Overlay de navegador: 6 achados, os 6 falsos positivos (text-occlusion não honra o clip do ancestral, então overscan de virtualizador sempre aparece; clipped-overflow-container aponta menu que já monta em Portal).

7/7 guardas do projeto passam. Navegador: 21/21 focáveis com anel, 0 sem nome acessível, 0 alt faltando, 0 404, 0 pares de contraste abaixo do mínimo em 20 amostrados. O que detector e guardas cobrem, este projeto acerta — os cinco problemas abaixo são de uma classe que nenhuma das duas vê.

## O que está funcionando

1. Contraste por construção: text-1/surface-0 15,75:1, text-2 9,74, text-3 7,10, acento 9,37, em qualquer matiz escolhido.
2. A faixa de conexão: copy de consequência, histerese assimétrica, e flutuante para não mover a âncora.
3. ARIA de widget composto: combobox com aria-activedescendant, radiogroup rotulado, sliders com aria-valuetext, alças como role="separator" focáveis.

## Problemas prioritários

### [P0] Nenhuma ação de mensagem é alcançável por teclado

`<article>` sem tabIndex (MessageRow.tsx:362), barra de ações em visibility:hidden, menu só por onContextMenu (:371) com Trigger no nível da lista. Shift+F10 no role="log" não abre nada e o alvo seria null. Responder, reagir, fixar, copiar e editar são de ponteiro exclusivamente, num produto cuja tese é teclado-primário.

Conserto: roving tabindex — uma parada de tabulação, não dez mil. A justificativa registrada resolvia a barra de hover e foi aplicada a um problema que ela não cobria.

### [P1] aria-pressed de estado com rótulo de ação, em todas as alternâncias

CartaoDeChamada.tsx:199-200 — aria-pressed={ligado} com aria-label sempre de ação. Com mic aberto: "Silenciar microfone, pressionado".

CORREÇÃO da Assessment A: os quatro controles têm forma idêntica, não dois certos e dois invertidos — câmera ligada dá "Desligar câmera, pressionado", mesmo defeito. Idem PainelDeEdicao.tsx:184-185. É um defeito uniforme, não dois casos e duas exceções.

Conserto: rótulo de estado + pressed de estado, ou rótulo de ação sem pressed. E merece tipo ou lint, pela ordem do enforcement.md.

### [P1] Três artefatos de prosa afirmam um teto que não existe mais

tokens.css:462 (`--container-message: var(--vx-message-max-w)`, variável deletada — pnpm utilities não pega porque confere classe contra CSS emitido, não @theme contra token), tokens.css:265 (afirma que o composer segue o token; o textarea mede max-inline-size:none e chega a 1888px), MessageRow.module.css:189 ("a coluna vai até 1100px"). Consequência visível: texto 520px, composer 1888px, rótulo do divisor 692px fora do centro da trilha.

A Assessment A recomendou reinstalar o teto de 1100px — rejeitado, contradiz decisão explícita do usuário. O conserto é dar mecanismo à medida de leitura: divisor alinhado ao texto, composer com teto próprio declarado, três comentários reescritos.

### [P1] "fechar" destrói o trabalho em silêncio

Verificado: paleta Musgo + rail em 80px, clicar "fechar" reverte tudo sem confirmação, toast ou desfazer. A explicação de que sair desfaz está em outra tela.

Conserto: "descartar"/"manter", e toast de desfazer a partir do retrato que o painel já guarda na entrada.

### [P2] A lista de mensagens não tem nome, e fala sem parar

MessageList.tsx:672 — role="log" + aria-live="polite" sem aria-label e sem chave para calar. Divisor de dia é role="separator" sem nome (MessageRow.tsx:180), então a data nunca é anunciada. O sumário de cabeçalhos é a lista de membros.

## Red flags por persona

Alex: 33 paradas até o composer e nenhuma é mensagem; 32 botões de membro sem skip link; Ctrl+K é o único atalho e não há referência; larguras de slot são texto morto.

Sam: "Silenciar microfone, pressionado" com o mic aberto; "Esconder painel, pressionado" nos três slots visíveis; a data nunca é dita; zero aria-busy no app.

Jordan: /entrar não diz o que é o Vortex; "Entrar" desabilitado parece habilitado (acento cheio a opacity .64); não há como anexar arquivo mas a lista mostra anexos; coluna de membros em /amigos dizendo "aparece quando o servidor carregar".

## Observações menores

- --vx-border-subtle sobre --vx-surface-2 = 1,05:1; com box-shadow:none por regra, popover não se separa do fundo. --vx-border-strong (4,89:1) resolveria sem sombra.
- Foco do composer: 1,6px efetivos contra ≥2px do WCAG 2.2.
- Botão "Ir para a mensagem citada": 809,6 × 22px, abaixo de 24 em uma dimensão.
- Dois conjuntos de reação rápida: hover 3, menu 6, ordens diferentes.
- Empty state do canal no terço superior, ~250px de preto até o composer.
- Configurações sem título, sem saída além do X, sem caixa de leitura.
- A 700px o colapso está certo: 72px 240px 388px 0px, sem espaço morto.
- 34 erros de console, todos de rede/SDK; nenhuma assertion do projeto disparou.

## Perguntas

1. Por que o melhor momento do produto (retingir ao vivo com leitor de contraste) está a três cliques?
2. Se o canal de voz é um lugar, o que ocupa a coluna de conteúdo ao abrir um?
3. aria-pressed errado em todas as alternâncias, com comentário explicando por que existe: qual mecanismo faz isso falhar sozinho?
4. A prosa afirmou um teto removido em três lugares e nada falhou. O que impede a próxima invariante de acabar em prosa?
