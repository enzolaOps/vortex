---
target: passe de movimento e feedback de interacao
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
timestamp: 2026-09-02T14-51-39Z
slug: web-react-packages-client-src
---
Method: dual-agent (A: revisão de design · B: detector + evidência de navegador)

## Design Health Score

| # | Heurística | Nota | Achado |
|---|---|---|---|
| 1 | Visibilidade do estado | 3 | Faixa de conexão, `sendState`, "Rascunho salvo" só quando é verdade. Mas o press na linha de membro mede **1,025:1** — apertar é idêntico a apontar. |
| 2 | Correspondência com o mundo real | 3 | pt-BR natural, sem jargão de protocolo vazando. |
| 3 | Controle e liberdade | 3 | `Esc` fecha; retrato de desfazer no modo edição; "Desfazer pasta". Sem desfazer em ação destrutiva. |
| 4 | **Consistência e padrões** | **2** | Duas linguagens de hover OPOSTAS e cinco de press coexistindo. |
| 5 | Prevenção de erro | 3 | Aviso de link que endurece quando texto ≠ destino; imagem de markdown vira link; "sair = apagar" muda por `souDono`. |
| 6 | Reconhecer > lembrar | 3 | Barra no hover, `⌘K` com botão real. Mas a barra é só de ponteiro. |
| 7 | Flexibilidade e eficiência | 3 | Paleta, próxima menção, slots — furado pela ausência de teclado na timeline. |
| 8 | **Estético e minimalista** | **2** | Repouso calmo e denso. Botão direito numa mensagem virava parede de 264×950. |
| 9 | Recuperação de erro | 3 | Limite de erro por painel, 429 traduzido, três estados em convites/banidos. |
| 10 | Ajuda e documentação | 2 | O registro de pendências é ajuda de primeira. Não há primeira execução nem canal vazio com orientação. |
| **Total** | | **27/40** | Acima da mediana, com dois 2 que são caros |

## Veredito de especificidade

**Casca 3/5. O movimento desta rodada: 1,5/5.**

Específico deste produto: a lâmina como estado nomeado com cor diferente entre rail e canais; gradientes curados; a prancha ultrawide com gutter simétrico; o registro de pendências que faz controle sem back-end DIZER o que fará.

Não específico: `opacity` 120ms em `cubic-bezier(.2,.8,.3,1)` e `scale: 0.94` é o preset de qualquer design system desde 2016. **O passe entregou higiene — tirou o "pipoca" — não linguagem.** Um cliente de chat tem três eventos com significado próprio: *chegou algo novo*, *você está atrás*, *isto ainda não saiu daqui*. Nenhum dos três ganhou movimento.

## Detector determinístico

`detect.mjs` → exit 2, **3 achados**, todos `side-tab` (borda de acento de 3px): `AvisoDeLink.module.css:38`, `Embeds.module.css:34`, `Encaminhar.module.css:88`. **2 são falso positivo** — `Embeds` e `Encaminhar` são citação, e barra de 3px é a convenção de blockquote.

⚠ **Overlay visual indisponível:** a CSP do próprio produto (`script-src 'self'`) bloqueia injeção inline e externa. `detect-csp.mjs` classifica a forma como `meta-tag`, que ele marca como não auto-patchável. Medições feitas por `javascript_tool` no mundo principal.

## Problemas prioritários

### [P0] Ícones do menu de contexto a 112–165px — CORRIGIDO nesta sessão

`PesoDeIcone.tsx` fazia `useMemo(() => ({ weight: "fill" }), [])`. `IconContext.Provider` **substitui** o default do Phosphor (`{color, size:"1em", weight, mirrored}`), não mescla — `size` virava `undefined` e `IconBase` faz `width: prop ?? contexto` sem fallback.

Medido no build de produção: **104 dos 109 `<svg>` sem atributo `width`**. A maioria sobrevivia por acidente (42 regras de container). O menu de mensagem é PORTALADO e nem `menu.ts` nem `menu.module.css` dizem uma palavra sobre `svg` — os dez ícones dele saíam entre 112 e 165px, menu **264×950, a altura inteira da janela**, no segundo gesto mais repetido do app.

Depois: menu **264×388**, ícones **13/15px**, itens **24/30px**, **0** svg sem `width`.

⚠ **Nenhuma guarda pegou.** `dev/tamanhoDeIcone.ts` existe exatamente para isto e não podia ver: ela varre o documento no mount e some do bundle de produção — camada portalada nunca esteve na varredura.

### [P1] A barra de ações da mensagem é inalcançável pelo teclado

`article` da linha é `tabindex="-1"`. A revelação é `:hover > .acoes, :focus-within > .acoes`, e o pai direto é `.conteudo` — então `:focus-within` só dispara se o foco cair DENTRO do conteúdo, o que exige link, anexo ou citação. **Para mensagem de texto puro — a maioria — não há caminho de teclado para responder, reagir, encaminhar, criar tópico ou fixar.** Shift+F10 não abre menu.

A tese declarada do produto é "teclado é a navegação primária". **Fix:** roving tabindex na lista (uma linha focável, setas movem) — não acrescenta paradas de tabulação, que é a restrição protegida. **`/impeccable harden`**

### [P2] A linha de mensagem é a única que ESCURECE no hover, tem o contraste mais fraco, e não tem tempo nenhum

| Superfície | Direção | Contraste | Transição |
|---|---|---|---|
| **Linha de mensagem** | **escurece** | **1,047:1** | **0s** |
| Linha de membro | clareia | 1,118:1 | 120ms |
| Linha de canal | clareia | — | 120ms |

A superfície mais apontada do app está do lado errado das duas coisas — e o passe desta rodada não a tocou. Pior: o fundo troca num quadro e a barra leva 120ms, então há **dois relógios no mesmo gesto**, o que é mais visível que os dois instantâneos. **`/impeccable animate`**

### [P3] O token de revelação foi aplicado em 2 de 6 superfícies, e o comentário afirma alcance que não existe

`visibility: hidden` de revelação: **seis** arquivos. `--vx-revelar`: **dois**. Ficaram sem tempo `CaixaDeEntrada.marcar`, `PainelDeFixados.acoes`, `GradeDeChamada`, e — o pior — **`ListaDeCanais .acoesDaLinha` usa `display: none → flex`, que não é transicionável**, a poucos pixels do `+` que acabou de ganhar o fade. Dois alvos vizinhos na mesma coluna com física diferente: exatamente o defeito que o passe declarou corrigir.

O comentário em `tokens.css` cita "a marca da caixa de entrada" entre as três — e ela **não** recebeu o token. **`/impeccable polish`**

### [P4] Cinco vocabulários de press, e o `scale` volta teleportando

`scale:0.94` · `scale:0.98` · `--vx-state-press` · `--vx-surface-3` · `rgba(255,255,255,.1)` cru no chip de reação (fora do sistema de tokens — lei nº 4). A regra que a rodada escreveu ("compacto encolhe, linha larga usa camada") descreve dois e ignora três.

E nenhum `scale` está na `transition-property`: afundar instantâneo é defensável, **voltar instantâneo é teleporte**. Fix: `transition: scale 90ms` na saída, 0s na entrada. **`/impeccable polish`**

### [P5] `--vx-text-4` usado como texto de leitura — 4 reprovações reais

| texto | par | razão |
|---|---|---|
| `shift + nova linha` | `#4c5563 / #1b2028` | **2,17:1** |
| `Buscar em #spike` | `#4c5563 / #0f1318` | **2,47:1** |
| `Buscar` | `#4c5563 / #08090b` | **2,64:1** |
| `Ctrl K` | `#4c5563 / #08090b` | **2,64:1** |

`--vx-text-4` é o tom de PONTUAÇÃO (o glifo `#`) e de controle desativado. Aqui ele carrega texto que se lê. Fora do `EXCECOES` documentado. **`/impeccable audit`**

## Bandeiras vermelhas de persona

**Usuário avançado de teclado** (a persona que o produto diz servir primeiro)
- Chega à timeline e não pode responder, reagir, encaminhar, editar nem apagar. A paleta existe e é boa — o que torna a ausência mais gritante, porque prova que a intenção estava lá.
- O fallback documentado ("o teclado continua no menu de contexto") pressupõe elemento focável para o `contextmenu` mirar. Ele não existe.

**Pessoa com leitor de tela**
- O scroller é `role="log"` + `aria-live="polite"` + `aria-relevant="additions"` **sem `aria-label`** — anunciado como "log", sem nome. Num canal movimentado cada mensagem é falada, sem pausa e sem silenciar. Numa jornada de 8h isso é inutilizável, e é pior que não ter live region.
- O `HoverCard` de perfil abre por FOCO e cobre parte do composer — conteúdo aparecendo sem ter sido pedido no percurso de Tab.

**Quem chega pela primeira vez**
- Oito alvos aparecem de uma vez no hover, sem hierarquia e **sem Tooltip** (decisão registrada por custo de render). Quatro dos oito são adivinhação.
- Nenhuma primeira execução nem canal vazio com orientação. O empty state da casa é bom e prova que o time sabe fazer — ele só não existe onde a pessoa passa o dia.

## Observações menores

- `AvatarDoAutor`: o `:active` novo foi inserido ENTRE o comentário "Offset positivo porque o avatar é redondo…" e o `:focus-visible` que ele explica. Comentário órfão.
- Dois atrasos para o mesmo gesto: `HoverCard` abre em 500ms na member list e 400ms na linha.
- Dois relógios dentro do mesmo botão de 24px: o `+` transiciona `color` em 80ms e `opacity` em 120ms.
- `scale` não é neutralizado sob `prefers-reduced-motion` — defensável, mas a decisão não está escrita.
- Durante os 120ms de fade-out a barra segue `visibility: visible` e recebe ponteiro. Numa varredura vertical rápida ficam 2-3 barras esmaecendo juntas.
- Rejeição de promessa não tratada no console: `SyntaxError: Unexpected token '<'` — o SDK resolve a API contra `location.origin` e sem back-end recebe o `index.html` do SPA.
- CSP `img-src 'self' data: blob:` bloqueia imagem de embed em host remoto: essa superfície não é exercitável neste build.

## Consertado durante a crítica

- **P0 dos ícones** (acima).
- **Regra morta minha:** `.membro:active` que eu adicionei era sombreada por uma que já existia 119 linhas abaixo, com a mesma justificativa escrita. Removida.
- **Dois comentários meus que afirmavam o que não era verdade:** que a linha de membro "trocava fundo e cor num quadro" (o fundo já tinha tempo) e que `prefers-reduced-motion` encurta a duração do revelar (não encurta — `fast` não é remapeado; o que torna o par conforme é ser só opacidade, sem `transform`).
- **Contagem defasada:** o comentário do `visibility` dizia "cinco paradas × dez mil linhas = cinquenta mil". Medido: são oito alvos por linha, logo oitenta mil.
- **Duas sombras pré-existentes** achadas pela guarda nova: `Rail .marcaCasa` (fundidas preservando o que a tela mostra) e `AdicionarServidor .sobrancelha` (duplicata literal).

## Mecanismo novo

**`pnpm sombra`** — declaração sombreada por seletor repetido no mesmo módulo e mesmo contexto de at-rule. Nasceu do defeito acima: a regra tinha consumidor, então `pnpm utilities` a via viva; o que morreu foi a DECLARAÇÃO, e nenhuma das nove guardas olhava para dentro do bloco. Verificada por mutação (repõe o defeito exato) e por três controles (`@media` isento, propriedades diferentes isentas, comentário ignorado). Achou duas sombras pré-existentes na primeira corrida.

**`pnpm movimento`** — codifica a doutrina do Foundations ("Só transform e opacity. Nada anima acima de 240ms; listas nunca animam altura"). Confere teto de 240ms, propriedade que provoca layout, e `transition: all`. **A primeira versão passou de primeira e estava quebrada:** varria por início de linha, e 3 de 4 mutações passaram por ela. Reescrita sobre o texto, passou a conferir 112 declarações onde via 58 — metade. Fora de fluxo (`position: absolute`) é DERIVADO, não enumerado: as exceções caíram de 4 escritas à mão para 1.

## Perguntas

1. **A linha de mensagem deveria ter `:active`?** Ela não é botão — clicar nela não faz nada. Dar-lhe press ensina que é clicável e não cumpre.
2. **O que o movimento deste produto DIZ?** Hoje diz "isto é interativo", que é o mínimo.
3. **Se `visibility: hidden` foi certo por causa das paradas de tabulação, por que a linha não é focável de outro jeito?** As duas restrições foram resolvidas separadamente e a segunda nunca foi.
4. **Quantas superfícies existem hoje só dentro de um portal?** Menu, popover, hovercard, diálogo, lightbox — e a assertion de ícone varre o documento no mount e some em produção. **Nenhuma delas jamais foi medida por guarda nenhuma.** O P0 é a primeira consequência a aparecer, não a última.
