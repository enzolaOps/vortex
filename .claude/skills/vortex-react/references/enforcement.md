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
| p95 ≤ 16,7ms | exigido | exigido |
| zero long tasks | exigido | exigido |
| ≤1% de frames perdidos | **não se aplica** | exigido |

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
| Remedir após resize | Assertion em dev | Fase 0 |
| Linha virtualizada medindo 0px | Assertion em dev | Fase 0 |
| Publicação de coleção por frame | Teste | Fase 0 |
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
