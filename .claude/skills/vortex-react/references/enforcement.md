# Enforcement

Regra escrita depende de alguém lembrar. Regra mecanizada não.

Este arquivo mapeia cada invariante do projeto para o mecanismo que a faz falhar
sozinha. **Nenhuma regra crítica deve depender de revisão humana.**

Ordem de preferência, sempre: tipo > lint > teste > assertion em dev >
checklist > prosa.

---

## Lint — bloqueia no editor e no CI

**Arbitrary values do Tailwind proibidos**
`bg-[#2b2d31]`, `p-[13px]`, `max-w-[--vx-message-max-w]`. Regra de lint com
erro, não warning.

O seletor precisa de um lookahead negativo: variante arbitrária é sintaxe
legítima e documentada (`data-[state=open]:opacity-100`, `[&>svg]:size-4`) e
termina em `:`. O que se proíbe é colchete que carrega VALOR.

Propriedade arbitrária (`[scrollbar-gutter:stable]`) cai na regra de propósito:
o lugar dela é um CSS Module, como manda `styling.md`.

Instalada na fase 1, pegou três violações que já estavam no código — uma delas
escrita na fase 0 por quem estava justamente enunciando a regra. Além de
proibida, ela não funcionava: a coluna corria a viewport inteira e só apareceu
numa captura de tela. É o argumento para instalar mecanismo cedo, e não depois
de escrever o código que ele deveria ter guardado.

**Escala de cor default do Tailwind desativada**
Não é lint: remova as cores default do `@theme`. Se `bg-zinc-800` não existe, não
há o que proibir. Prefira sempre tornar impossível a proibir.

**Índice como `key` proibido** em qualquer `.map()` que renderize entidade.

**`any` proibido na fronteira do SDK** — `no-explicit-any` como erro no diretório
do adapter, no mínimo.

**Import direto de primitivo em código de feature proibido.**
Radix só pode ser importado dentro de `src/components/ui/`. Regra de boundary
por `patterns: [{ group: ["@radix-ui/*"] }]`, com os próprios wrappers isentos —
eles SÃO a fronteira, e ali o import é o trabalho, não a violação.

É isso que mantém viva a possibilidade de trocar Radix→Base UI depois,
componente por componente, sem tocar em código de produto — e a troca está
prevista: Base UI hoje não tem Context Menu, Hover Card nem Toast, e quando
tiver, a decisão é reavaliada.

Instalada na fase 2, junto do primeiro wrapper, e verificada reprovando de
propósito.

**Import de `stoat.js` fora do adapter proibido.**
O SDK só pode ser importado dentro de `src/sdk/`. Regra de boundary
(`no-restricted-imports`), simétrica à do Radix — e pela mesma razão, um nível
acima.

O Vortex é um produto separado do Stoat, não um cliente Stoat reestilizado. O
`stoat.js` é o transporte de hoje. Esta regra é o que torna essa frase
verdadeira em vez de aspiracional: sem ela, um `import` de tipo do SDK dentro de
um componente acopla o app ao protocolo, não dá erro nenhum, e só cobra o preço
quando alguém tentar adicionar a primeira feature que o Stoat não tem.

Vale para valor **e** para tipo — `import type` acopla igual.

**`left`/`right` proibidos em componente de painel** — só propriedades lógicas
(`inline-start`/`inline-end`). Sustenta a lei nº 6 mecanicamente em vez de
depender de disciplina.

---

## Tipos — tornam o erro irrepresentável

**Schema de preset fechado.**

O preset carrega layout e tema, e **nada mais**. O tipo deve tornar impossível
representar ID de canal, servidor ou usuário. Não um campo opcional que alguém
possa preencher: um tipo onde o campo não existe.

```ts
type PresetV1 = {
  version: 1
  layout: { slots: SlotConfig[] }      // sem IDs de domínio
  theme?: Record<TokenName, string>    // TokenName é união fechada
}
```

`TokenName` como união fechada dos tokens de `tokens.css` significa que tema com
chave arbitrária não compila. Cobre a regra "picker no nível do token, nunca do
componente" no tipo, e não na revisão.

**Snapshot readonly.** Snapshots do store marcados `readonly` impedem mutação
acidental em componente — a classe de bug mais difícil de rastrear numa ponte de
estado.

---

## Testes — falham o build

**Preset: round-trip entre versões.**
Fixtures de preset de versão anterior e de versão futura. Asserções:
chave desconhecida **preservada** após ler e reescrever; chave ausente recebe
default; migração v(n-1)→v(n) roda.

Sem isso, a regra "chave desconhecida é preservada" morre na primeira release.

**Preset: nenhum dado de sessão no output.**
Serializa um preset a partir de um estado completo e afirma que a string não
contém nenhum ID em formato de domínio (ULID/snowflake). Teste feio, mas é o que
transforma uma regra de privacidade em algo que não pode ser violado em silêncio.

**Firehose como gate de merge — sempre contra build de produção.**

500 eventos/s de presença, mensagem, typing e reaction contra o store, com
canal de 10k mensagens carregado. Obrigatório em qualquer PR que toque store,
lista virtualizada ou linha de mensagem.

**Critérios, em dois patamares.** Quem roda declara a condição no arnês; o
gate não adivinha throttle, e ajustar limiar em silêncio conforme o resultado
é como se perde um gate.

| | com CPU 4x | sem throttle |
|---|---|---|
| janela válida (sem suspensão de rAF, lista colada no fim) | exigido | exigido |
| frames perdidos (>16,7ms) | ≤ 5% | ≤ 1% |
| zero long tasks | exigido | exigido |

**O teto de 5% é o antigo `p95 ≤ 16,7ms`, reescrito — não afrouxado.** A
equivalência é aritmética e tem teste: o 95º percentil dentro de 16,7ms
significa que no máximo 5% dos deltas passam de 16,7ms. Mesmo conjunto de
corridas aprovadas.

O que muda é a resolução, e a razão é a entrada sobre quantização de vsync
acima. Num display de 160Hz o percentil só assume 6,25 · 12,5 · 18,75 e salta
entre degraus: o p95 deu 18,7ms em quatro corridas seguidas enquanto os frames
perdidos variavam de 217 a 248 — sem ver uma diferença de 30 frames, quando a
diferença que separava o gate de passar era de 29. Contagem anda de frame em
frame; percentil de grandeza quantizada anda de degrau em degrau.

O antigo quarto critério virou o patamar deste: sem throttle o teto continua
1%, que é mais duro e portanto o único que vale ali.

O teto de frames perdidos é mais duro que o briefing — que pede "500
eventos/s segurando 60fps" — e foi calibração nossa. A 4x, o que resta da
cauda é custo de montagem de linha de altura variável no frame de append, e
apertá-lo é retorno decrescente contra um alvo inventado. p95 dentro do
orçamento e ausência de bloqueio de main thread é o que caracteriza "segurar
60fps" na prática.

**Resultado que fechou a fase 0** (build de produção, CPU 4x, janela válida de
30s): p95 12,5ms · p99 18,8ms · pior 37,5ms · **0 long tasks** · 2,9% de
frames perdidos · 1.006 renders de lista, 1.612 de linha, 1.023 snapshots.
Sem throttle, a mesma carga passa em todos os quatro critérios.

Medido no spike, a 4x de throttle: o dev server (React em modo de
desenvolvimento + StrictMode dobrando renders) produziu 32 long tasks
somando 2,1s numa janela de 30s; o build de produção, na mesma máquina e
mesma carga, produziu **zero** — e o p95 caiu de 43,8ms para 12,5ms. Medir
no dev reprova o ambiente, não o código. `vite preview`, nunca `vite dev`.

Regressão de escopo **nunca aparece em uso normal de desenvolvimento**. Este é o
único mecanismo que a pega.

**Medição comparada contra a linha de base certa.**

Não é uma invariante do produto: é uma do instrumento, e ganhou lugar aqui
porque já produziu dois diagnósticos falsos neste projeto.

O caso do prepend: a fase de remedição comparava o movimento da linha contra o
`scrollTop` LÍQUIDO — que já embute a compensação do virtualizador. Rolando
260px com as linhas acima crescendo X, compensação funcionando dá líquido
`260−X` e movimento `260`; compensação falhando dá líquido `260` e movimento
`260+X`. Contra o líquido, os dois casos devolvem `X`. O instrumento acusou
"SALTOU 242px" sem conseguir distinguir sucesso de falha.

A regra que fica: quando a coisa medida reage à medição, a linha de base é a
**intenção**, não o resultado observado — e o quanto o sistema compensou vira
número próprio. Com salto zero e compensação alta, funciona; com salto alto e
compensação zero, não funciona. Sem separar os dois, o número não decide nada.

Verificado depois do conserto: compensação de 1436px contra 1441px de
crescimento real, salto máximo de 1px.

**Delta de rAF é intervalo de vsync, não custo de frame.**

Invariante do instrumento, e a terceira desta família — depois da linha de
base do prepend e do dev server. Custou três corridas de 30s e três hipóteses
erradas.

O `requestAnimationFrame` entrega o tempo até o PRÓXIMO vsync, então o delta é
sempre um múltiplo do refresh do display. Num monitor de 160Hz os valores
possíveis são 6,25 · 12,5 · 18,75 — e nada entre eles. Um percentil pousado
num degrau fica imóvel enquanto o código muda de verdade: o p95 deu 18,7ms em
três corridas idênticas até a decimal, enquanto tirar a máscara do ponto de
presença e o menu de contexto por linha moviam o p99 e a cauda.

Pior: o teto de 16,7ms cai ENTRE o segundo e o terceiro degrau. Nessa máquina
"p95 ≤ 16,7ms" significa "p95 ≤ 12,5ms" — 95% dos frames dentro de dois
refreshes, e não dentro do orçamento de 60fps que a frase queria dizer. O
mesmo código num monitor de 60Hz reportaria 16,7ms e passaria.

**O critério não foi alterado.** O que mudou é que o relatório agora estima o
intervalo de refresh (1º percentil dos deltas — o frame mais rápido é sempre
um intervalo; a mediana já seria dois num app engasgado) e mostra o p95 também
em MÚLTIPLOS de refresh. O veredito carrega os dois números.

A regra que fica: percentil de uma grandeza quantizada precisa reportar o
quantum junto, senão a diferença entre "não mudou nada" e "mudou menos que um
degrau" é invisível — e as duas levam a conclusões opostas sobre o que fazer
em seguida.

Consequência prática para comparar corridas: `dropped` (frames acima de
16,7ms) é contagem, não percentil, e por isso mede diferença pequena onde o
p95 não mede. Fase 0: 2,9%. Depois da fase 3: 6,0%. Sem o menu por linha:
5,4%.

**Uma janela só não decide diferença pequena.**

A quarta invariante de INSTRUMENTO, e a que encerra uma investigação inteira.

Cinco configurações medidas — com e sem menu de contexto por linha, com e sem
máscara no ponto de presença, 1.000 contra 10.000 mensagens, estimativa de
altura chutada contra medida — deram entre 5,4% e 6,3% de frames perdidos.
**0,9 ponto percentual de espalhamento.** A diferença que separava o gate de
passar era **0,72 ponto**.

Ruído maior que o efeito procurado. A partir daí todo A/B de corrida única é
cara ou coroa com aparência de medição, e foi exatamente assim que três
hipóteses plausíveis foram testadas, cada uma "não mudou nada", sem que
nenhuma delas tivesse sido de fato refutada.

O arnês passou a rodar N janelas e reportar a MEDIANA, com a faixa min–max ao
lado. Mediana e não média: uma janela azarada — pico do próprio gerador,
coleta de lixo — desloca a média e não a mediana. A faixa aparece junto porque
esconder o espalhamento é como se chegou aqui.

**Regra: antes de acreditar numa diferença medida, compare-a com o
espalhamento entre janelas da MESMA configuração.** Se for menor, não há
diferença — há ruído.

**Corrida de firehose só vale colada no fim.**
No arnês: ao fechar a janela de medição, medir a distância da lista até o
fim; acima do `scrollEndThreshold`, a corrida é marcada INVÁLIDA — junto com
a checagem de suspensão de rAF.

Descoberto no spike da fase 0 da pior forma: uma sequência de PASS medindo
uma lista que não seguia o fim — `followOnAppend` desligado — e portanto um
app parado, enquanto a corrida real reprovava. Duas causas encadeadas:
faltava `scrollToEnd()` após a carga inicial, e `useFlushSync: false` (ligado
para silenciar warnings) quebra a compensação de âncora do TanStack. Nunca
desligar o flushSync; os warnings de console são o preço documentado.

**Carga em massa não passa pelo caminho de evento.**
Teste: popular um canal com N mensagens e afirmar que a lista foi publicada
uma vez, e que a âncora terminou no fim.

Descoberto no spike da fase 0, e o erro de diagnóstico custou mais que o bug.
Assinar o SDK antes de carregar faz a lista crescer evento a evento; a
publicação final, em bloco, então salta de N para o total e **destrói a
âncora**. A lista termina no começo do histórico.

O sintoma não parece âncora: parece reatividade quebrada. As linhas montadas
assinam as mensagens erradas, editar uma mensagem recente não muda nada na
tela, e a conclusão natural — errada — é que a ponte Solid → React não
funciona.

Vale para histórico paginado tanto quanto para carga inicial.

**Publicação de coleção coalescida por frame.**
Teste: semear N mensagens cedendo a thread entre lotes e afirmar que o número
de publicações da lista de IDs é da ordem de frames, não de N.

Descoberto no spike da fase 0, medindo. A versão ingênua publicava a cada
`messageCreate`: N cópias do array de IDs e N renders do React. Semear 10k
passou de **334ms para 23.165ms** — 70x — assim que o seed passou a ceder a
thread entre lotes.

O que torna isto traiçoeiro é que **o caso síncrono esconde o problema**: sem
yield, o React agrupa os N renders num só e o custo some. Ele aparece no
caminho que a app real percorre — mensagem chegando ao longo do tempo,
paginação de histórico, carga de canal.

Coalescer no frame resolve carga e regime permanente com o mesmo mecanismo.

**`cn()` resolve conflito na escala do projeto.**
`pnpm classes` afirma que a última classe vence em cada grupo renomeado.

O `tailwind-merge` resolve por grupo, e os grupos que ele conhece são os do
Tailwind de fábrica. Cada escala que este projeto renomeia é uma chance de ele
deixar as duas classes passarem. Foi o caso de `rounded-*`: a escala default
está desativada em `tokens.css` e a nossa é numérica, então
`cn("rounded-2", "rounded-4")` devolvia **as duas** e quem decidia era a ordem
no CSS, não quem chamou.

A falha é silenciosa — nada quebra, o canto só fica errado. Corrigida com
`extendTailwindMerge`; o teste existe para a próxima escala renomeada não
repetir o episódio sem avisar.

**Contraste de tokens.**
Teste que percorre os pares de token realmente usados (`--text-3` sobre
`--surface-3` inclusive) e afirma 4.5:1 em texto e 3:1 em borda. Roda sobre o
tema default e sobre qualquer preset embutido.

**Gitlinks de `stoat.js` em lockstep.**
`web/` e `web-react/` são ilhas independentes, cada uma com seu próprio submodule
do SDK, apontando para o mesmo commit. Check em CI que compara os dois gitlinks
e falha se divergirem — `.github/workflows/sdk-lockstep.yml`.

Sem isso, um lado sobe de versão e o outro não. As duas ilhas compilam, as duas
sobem, e o comportamento diverge em silêncio. Durante o porte, em que comparar
`web/` com `web-react/` lado a lado é o método de verificação, essa divergência é
indistinguível de bug de porte.

O gitlink já está na árvore, então o check não precisa clonar submodule nenhum.


**Não-lida nunca conta o canal aberto, e abrir zera só aquele canal.**

Testes: mensagem no canal aberto não incrementa; mensagem em canal fechado
incrementa o canal E o total do servidor; abrir o canal zera aquele contador e
BAIXA o total do servidor sem zerar os outros canais.

Nenhum dos três dá erro quando quebra, e o modo de falha é pior que parecer:
um badge que não zera ensina a pessoa a ignorar o badge, e aí a feature inteira
deixa de existir mesmo continuando na tela. O terceiro caso — zerar o servidor
inteiro ao abrir um canal — é o bug clássico de rollup, e some sozinho em uso
normal porque quem testa costuma ter só um canal com não-lidas.

Instalado na fase 3, junto da lista de canais.

**Presença que não troca de balde não republica a member list.**

Teste: assinar a lista de membros, emitir `online → idle → dnd` para um membro,
virar o frame, e afirmar que a lista NÃO foi publicada. E o complemento: duas
saídas para offline no mesmo tick publicam UMA vez.

É o que faz a member list sobreviver ao firehose. Presença é 55% da mistura e a
esmagadora maioria é troca entre estados que moram no mesmo balde — reordenar
neles seria `n log n` por frame num painel onde nada mudou de lugar. A escolha
de ter DOIS baldes em vez de quatro é essa invariante virando estrutura de
dados: com uma seção por estado, toda piscada de presença reordena.

O ponto de presença continua correto porque assina sozinho, um nível abaixo da
linha — a mesma granularidade do `MessageRow`.

Instalado na fase 3, junto da member list.

**Concordância de número nos rótulos de leitor de tela.**

Teste sobre `plural()` e `rotuloDeNaoLidas()`. Parece pequeno demais para ter
mecanismo, e é justamente por isso que tem: "1 menções" saiu na primeira
verificação em navegador, num texto que só leitor de tela lê. Texto que ninguém
relê é o que mais precisa de teste em vez de atenção.

O teste também registra uma surpresa em vez de escondê-la: o CLDR põe o ZERO na
categoria `one` em português (`i = 0..1`), então `Intl.PluralRules` devolve
"0 menção". Fica assim — o rótulo nunca renderiza com zero, e divergir do
padrão para cobrir um caso inalcançável seria trocar regra por exceção.

**Fila de rAF do teste não é zerada entre casos.**

Não é invariante do produto: é do instrumento, e entra aqui pelo mesmo motivo
que a linha de base do prepend entrou.

O `flushHandle` do adapter é module-level e sobrevive ao teste que o agendou.
Substituir a fila de callbacks por uma nova no `beforeEach` dessincroniza os
dois: o adapter continua achando que tem frame pendente, `agendarFlush` vira
`??=` sobre valor definido, e nenhuma publicação seguinte é agendada. O teste
seguinte mede um sistema que parou de publicar e conclui que o CÓDIGO está
errado.

A regra que fica: quando o instrumento guarda estado compartilhado com o
sistema medido, resetar metade dele é pior que não resetar nada. Drene a fila
(`splice`), não a substitua.

**Medição em aba sem composição estável mede o ambiente.**

Irmã da regra "medir no dev server reprova o ambiente, não o código", e
descoberta do mesmo jeito: perdendo tempo.

Numa aba que não compõe frames de forma estável — navegador headless, pane
oculta, janela minimizada — o `requestAnimationFrame` dispara com intervalos de
segundos e o `setTimeout(0)` é estrangulado. Sintomas observados: a semeadura de
10k mensagens passou de 0,6s para 14s, e a publicação coalescida ficou pendurada
com a lista vazia enquanto o contador de não-lidas — que é síncrono — estava
correto. O diagnóstico natural, e errado, é "bug de escopo no adapter".

A sonda `__fila()` existe para separar os dois casos em uma leitura:
`canaisSujos: []` significa que nada aconteceu; `canaisSujos: [id],
frameAgendado: 4` significa que aconteceu e o frame é que não veio.

O arnês do firehose já tinha a defesa certa para a corrida medida — a contagem
de suspensões de rAF invalida a janela. Esta entrada estende o aviso para a
verificação FUNCIONAL, que não tem gate nenhum.

---

## Assertions em dev — falham alto, cedo

Custo zero em produção; eliminam bugs que se manifestam como comportamento
estranho em vez de erro.

**Estabilidade de `getSnapshot`.**
No wrapper do `useSyncExternalStore`, em dev: chamar `getSnapshot` duas vezes
seguidas e lançar se as referências diferirem sem que a entidade tenha mudado.

Pega a armadilha nº 1 do projeto — a que se manifesta como aba travando, sem
erro. Uma assertion de cinco linhas paga por si na primeira ocorrência.

**Remedição após mudança de largura do container.**
No wrapper do virtualizador, em dev: se a largura do container mudar sem que uma
remedição tenha sido solicitada, avisar alto.

**Entra na fase 0, junto com o virtualizador que ela envolve** — não adianta o
mecanismo chegar duas fases depois do código que ele guarda. O custo é o mesmo:
é o mesmo wrapper, escrito uma vez.

A recompensa maior é na fase 4, onde a causa da mudança de largura é o usuário
arrastando a borda de um slot. Mas as causas já existem no spike: janela
redimensionada, sidebar colapsada, popout, painel de thread abrindo. A
invariante é a mesma nos dois casos.

**Composer e coluna de mensagem são a mesma caixa.**
Assertion em dev que MEDE as duas caixas e avisa se início ou largura
divergirem mais de 1px.

`design-system.md` dizia isto em prosa desde a fase 1 — "desalinhar os dois é
o erro visual mais perceptível da tela principal" — e a prosa não segurou: a
primeira versão do composer saiu 16px fora e mais estreita que a lista, com o
token do teto correto nos dois lados.

É por isso que a checagem é sobre geometria medida e não sobre valor
declarado. Comparar `max-inline-size` aprovaria exatamente o bug que
aconteceu: o teto estava igual, o que divergia era o padding e a reserva da
calha da barra de rolagem. A lista reserva a calha com `scrollbar-gutter:
stable` por estar dentro do container de scroll; o composer está fora e
precisa reservar a mesma coisa, senão fica mais largo pela largura da barra.

Verificada reproduzindo o bug original no DOM: início 16px, largura −32px.

**Reancoragem após mudança de ALTURA do container.**
No wrapper do virtualizador, em dev: se a altura encolher, a lista estava no
fim e ela terminar além do limiar, avisar alto.

É a irmã da regra acima, e nasceu com o composer. O campo cresce uma linha, o
container de scroll encolhe a mesma linha, e o navegador PRESERVA o
`scrollTop` — então a distância até o fim aumenta exatamente pela altura que
sumiu. Duas ou três linhas digitadas passam do `scrollEndThreshold` e o
`followOnAppend` desliga em silêncio: a pessoa digita e as mensagens dos
outros param de aparecer.

Não dá para perguntar "estava no fim?" dentro do ResizeObserver: quando ele
dispara, o layout novo já valeu. O estado tem que ser lido no scroll e
guardado — é a mesma regra da medição comparada contra a linha de base certa,
uma seção acima.

O limiar é UM número, usado pelo `scrollEndThreshold` do virtualizador e pela
nossa noção de estar colado. Divergirem significa a lista se achar no fim
enquanto o virtualizador já desistiu de seguir — exatamente o estado que
aprovou uma corrida de firehose contra um app parado na fase 0.

**Linha virtualizada medindo zero.**
No wrapper do virtualizador, em dev: se um item medir 0px, erro no console.

Descoberto no spike da fase 0, e não estava na lista dos cinco. Uma linha cujo
snapshot ainda não resolveu devolvendo `null` mede zero — o total encolhe, a
janela visível muda, mais linhas montam sem snapshot, e o ciclo se realimenta
até "Maximum update depth exceeded".

O que faz este caso perigoso é que o `getSnapshot` está **estável o tempo
todo**: a assertion da armadilha nº 1 não dispara. O loop é entre a latência do
store e a medição do virtualizador, não dentro do getter.

Duas defesas, e as duas são necessárias: o adapter resolve o snapshot de forma
síncrona ao assinar, e linha não resolvida renderiza placeholder com altura de
linha real, nunca `null`.

**Dado de entidade em Context.**
Se houver um `createStore`/factory de Context próprio, em dev: rejeitar value que
pareça snapshot de entidade. Se não valer a complexidade, o boundary de import
já cobre a maior parte.

---

## Onde cada uma vive

| Invariante | Mecanismo | Existe desde |
|---|---|---|
| Arbitrary values | Lint (erro) | Fase 1 |
| Cores default do Tailwind | Ausência no `@theme` | Fase 1 |
| Contraste dos tokens | `pnpm contrast` | Fase 1 |
| Import direto de Radix | Lint de boundary | Fase 2 |
| `cn()` na escala do projeto | `pnpm classes` | Fase 2 |
| `left`/`right` em painel | Lint | Fase 2 |
| `getSnapshot` estável | Assertion em dev | Fase 0 |
| Índice como `key` | Lint | Fase 0 |
| `any` na fronteira do SDK | Lint | Fase 0 |
| Import de `stoat.js` fora do adapter | Lint de boundary | Fase 0 |
| Firehose 60fps | Teste, gate de merge | Fase 0 |
| Gitlinks de `stoat.js` em lockstep | Check em CI | Fase 0 |
| Remedir após resize de largura | Assertion em dev | Fase 0 |
| Reancorar após resize de altura | Assertion em dev | Fase 3 |
| Composer alinhado à coluna de mensagem | Assertion em dev | Fase 3 |
| Linha virtualizada medindo 0px | Assertion em dev | Fase 0 |
| Publicação de coleção por frame | Teste | Fase 0 |
| Quantum de vsync reportado junto do p95 | Arnês | Fase 3 |
| Mediana de N janelas, com faixa min–max | Arnês | Fase 3 |
| Equivalência p95 ≤ 16,7ms ⇔ perdidos ≤ 5% | Teste | Fase 3 |
| Não-lida ignora o canal aberto | Teste | Fase 3 |
| Abrir canal baixa só a parcela dele no servidor | Teste | Fase 3 |
| Presença no mesmo balde não republica membros | Teste | Fase 3 |
| Concordância de número em rótulo de a11y | Teste | Fase 3 |
| Carga em massa fora do caminho de evento | Teste | Fase 0 |
| Corrida de firehose colada no fim | Check no arnês | Fase 0 |
| Preset sem dado de sessão | Tipo + teste | **Fase 4, tipo desde a 2** |
| Preset round-trip | Teste | Fase 4 |

**Fase 0 e 1 não são opcionais.** São as que protegem as leis 1 a 4, e o custo de
adicioná-las depois é auditar código já escrito.

## Regra sobre esta lista

Invariante nova descoberta durante a implementação entra **aqui com um
mecanismo**, não só num arquivo de referência em prosa. Se não for possível
mecanizar, isso é informação — provavelmente a regra está vaga demais para ser
seguida de qualquer forma.
