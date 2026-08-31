---
target: revisão completa de design do cliente Vortex
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-08-27T03-59-17Z
slug: web-react-packages-client-src
---
## Nota de saúde: 25/40 — Precisa de trabalho

| # | Heurística | Nota | Questão-chave |
|---|---|---|---|
| 1 | Visibilidade do estado | 3 | `Rail.module.css` não tem regra para `[data-naolidas]` — atributo escrito e nunca estilizado |
| 2 | Sistema ↔ mundo real | 3 | "sem servidores" vs "Nenhum servidor aberto" — dois registros para a mesma classe de vazio |
| 3 | Controle e liberdade | 2 | `Copiar texto`, `Editar` e `Apagar` não têm `onSelect` |
| 4 | Consistência e padrões | 2 | `--vx-accent-soft` = "selecionado" em 3 componentes e "menção" no documento |
| 5 | Prevenção de erro | 3 | Guarda de IME, rascunho e alvo de resposta preservados na falha |
| 6 | Reconhecer > lembrar | 2 | Não existe barra de ações no hover; reagir só no botão direito |
| 7 | Flexibilidade e eficiência | 3 | Faltam trocar canal por teclado e "próxima menção" |
| 8 | Estética e minimalismo | 3 | Com mensagens longas a coluna vira bloco indiferenciado |
| 9 | Recuperação de erro | 2 | Volume invertido; `error` existe em um lugar no app inteiro |
| 10 | Ajuda e documentação | 2 | Tese é "teclado é a navegação primária" e não há onde descobrir atalhos |

## Veredito de especificidade

Ancorado em partes, intercambiável no essencial. Genuinamente do produto: canal de voz como container com a sala recuada até a calha do nome; as quatro silhuetas de presença; a lâmina como conceito. O resto é a anatomia do Discord com mais rigor.

Scan determinístico: ZERO achados em 120 arquivos, com controle positivo confirmando que as regras disparam. Detector limpo e nota 25/40 não se contradizem — nada do que segue é padrão saturado de CSS.

## Problemas prioritários

### [P1] `min-w-0` não gera CSS — lei nº 3 desprotegida
`min-w-0`, `min-h-0`, `w-80` e `data-[state=open]:bg-surface-1` não existem na folha gerada. Causa: `--spacing-*: initial` remove a base do Tailwind v4. Confirmado no bundle. Consequência medida em 1440px: coluna de mensagem com scrollWidth 1828 vs clientWidth 1100 — barra horizontal na superfície principal. Quarto bug desta classe (py-0.5, size-5, min-w-0, w-80).
FIX: `min-inline-size: 0` em módulo CSS + lint "utility que não produziu declaração reprova".

### [P1] Sala de voz renderizada duas vezes
`<Sala>` montada em ListaDeCanais.tsx:131 e :267. Ao vivo, cada ocupante aparece duplicado.
FIX: apagar uma das duas.

### [P1] Cor de cargo contorna o sistema de tokens
`style={{ color: membro.cor }}` em 3 componentes. Tema claro: 22/22 nomes reprovam 4,5:1 (pior 1,33:1). O picker garante contraste para 20 tokens; a cor de cargo passa por fora e o `pnpm contrast` não a vê.
FIX: clamp de L em OKLCH, preservando o matiz do servidor.

### [P1] Ações que não fazem nada
Copiar/Editar/Apagar sem handler. `aria-label` das reações rápidas é "Reagir com " sem interpolação — seis botões com rótulo vazio.

### [P2] A paleta não tem estrutura de valor
Superfícies a 1,08 / 1,11 / 1,15 (escuro) e amplitude total 1,37; no claro 1,14. Sombra proibida por regra = nenhum mecanismo de profundidade. Semânticos gêmeos de luminosidade (danger 9,62 · accent 9,04 · text-2 9,40). Disciplina de acento: 25 ocorrências numa tela contra teto declarado de 3, a maior parte lâmina inativa visível.

## Personas

Alex: não troca de canal por teclado; reagir exige botão direito num menu de 11 alvos, 3 inertes.
Sam: rótulo vazio nas reações; `role="listitem"` sobre `<h2>`; scroller sem tabindex; campo da paleta com outline none; nomes de cargo a 1,33:1 no claro.
Riley: desafixar inalcançável em toque; status-offline 2,99:1 contra piso de 3; ~18 erros de flushSync em nível error.

## Observações menores

Divisor de data é o elemento mais genérico do app, no lugar de maior alavancagem. Assimetria do divisor não implementada (pt-5 pb-1 = 24/20). ~8 valores fora da escala em módulos CSS. z-index é a única disciplina sem token. Mono com dois pesos para um uso. Toast sem chamador e com viewport 0px. border-subtle a 1,15–1,27:1.

## Perguntas

1. Se as superfícies estão a 1,1:1, "profundidade vem de camada" é princípio ou ausência de escolha?
2. A lâmina marca "ativo" — e a própria análise decidiu que ela deve marcar "não-lida".
3. Por que o conteúdo é a camada mais apagada e a cor menos controlada é a mais alta?
4. `--spacing-*: initial` produziu uma nova classe de falha silenciosa. Ela se pagou?
