# Concorrentes — o que copiar, o que recusar, e o que cada coisa custa

## Como ler este documento

A pergunta errada é *"quais features copiar"*. Ela produz o Rocket.Chat:
superfície máxima, sem espinha de design.

A pergunta daqui é outra: **qual problema cada produto resolveu que o Vortex
também tem, que aposta aquilo exigiu, e o que a aposta custou a eles.** Feature
copiada sem a aposta que a sustenta chega com o custo e sem o retorno — e num
fork construído por uma pessoa, custo permanente é o que mata.

Todo item termina com um **nível de custo**, porque é isso que decide fase:

| Nível | O que é | Onde cabe |
|---|---|---|
| **T0** | CSS e componente. Nenhum dado novo. | Fase 5, cabe agora |
| **T1** | Estado no cliente — adapter e store, sem backend. | Fase 5–6 |
| **T2** | O protocolo **já tem** o campo; o cliente ignora. | Fase 6 |
| **T3** | Exige forkar um serviço do backend. | Não é roadmap — é o mapa de QUANDO |

O T2 é a categoria mais desperdiçada de todas: coisa que já chega pelo socket e
que ninguém está lendo.

---

## 1. Zulip — o tópico como terceira coordenada

**A ideia, e é a maior da lista.** Em todo o resto, o endereço de uma mensagem
é `(canal, tempo)`. No Zulip é `(canal, tópico, tempo)`. Essa terceira
coordenada é o produto inteiro.

O que ela compra:

- Três conversas no mesmo canal viram três listas legíveis, não uma intercalada
- **"Estar em dia" vira alcançável.** Marca-se um TÓPICO como resolvido, não um
  canal como visto
- Entrar num canal com 200 mensagens deixa de ser perda total: lê-se o tópico
  que interessa
- O contador de não-lidas passa a significar alguma coisa, em vez de ser um
  número que se aprende a ignorar

**O que custou, e por isso ninguém copiou:** o imposto é cobrado no **envio**.
É preciso nomear o tópico antes de falar. Numa equipe de trabalho isso passa;
numa comunidade mata a conversa solta — que é exatamente por que comunidades de
Discord não migram para Zulip. E a sidebar vira de dois níveis, brigando com a
densidade.

**A leitura do Vortex — e a abertura de produto que ela revela.** O imposto é no
envio; o retorno é na leitura. Essa assimetria é a brecha. Se o tópico puder ser
**atribuído depois** — mensagem nasce num balde corrente, e qualquer mensagem
pode ser elevada a tópico levando as respostas junto — obtém-se o lado de
leitura do Zulip pelo custo de envio do Discord. **Ninguém construiu isso.**

É a maior diferenciação de produto disponível, e é literalmente o cenário que o
`CLAUDE.md` antecipa: *"feature que o protocolo não suporta exige mexer no
backend"*.

**Design, e este é T0 hoje:** a *recipient bar* do Zulip — o cabeçalho que nomeia
canal › tópico e reaparece a cada bloco durante a rolagem — é a mesma peça que o
nosso divisor de data. Se o divisor for escrito para carregar um **contexto
genérico** em vez de só uma data, tópico depois custa mudança de dado, não
reescrita de tela.

> **T3** o modelo · **T0** preparar o divisor para ele

---

## 2. Discord — presença como lugar, e leitura como posição

**A inovação real não é voz, é ausência de ritual.** Um canal de voz é uma
**sala em que você está**, não uma chamada que você faz. Não toca, ninguém
aceita, ninguém agenda. Vê-se quem está lá e entra-se. Isso converte um ato
síncrono e caro num ato ambiente e gratuito — e é por isso que as pessoas ficam
horas dentro do Discord.

**A segunda ideia é a mais aproveitável agora: não-lida é um LUGAR, não um
badge.** O Discord trata "onde parei de ler" como destino: a barra de ir para a
primeira não lida, a linha de *novas mensagens* que sobrevive à sessão, marcar
canal como lido, marcar servidor como lido. Slack faz pior; quase todo clone não
faz.

Isso encaixa direto numa decisão que a fase 3 já tomou — **não-lidas são do
cliente, o protocolo só tem um booleano**. O que esta análise acrescenta: o
cliente deve contar **posição**, não só quantidade. Ver o item 9.

**Terceira: identidade por servidor** (apelido e avatar por servidor). Parece
detalhe, e é o que faz a mesma conta parecer nativa num servidor de trabalho e
num de jogo. Já está como pendência aqui — a análise diz que não é firula, é
parte de por que o modelo multi-comunidade funciona.

**O que o Discord errou, e que NÃO devemos seguir:** o redesenho recente trocou
densidade por arredondamento e respiro. Num app aberto 8h isso é regressão.
Nossa referência de densidade é o Discord antigo e o Slack, não o Discord de
hoje.

**Correção da primeira passada.** Escrevi "T3 voz como sala" sem ter aberto o
SDK. Está errado: `channel.voiceParticipants` é populado por
`Ready.voice_states` — **quem está em cada canal de voz chega no login, antes de
entrar em coisa nenhuma** — e depois por `VoiceChannelJoin`, `VoiceChannelLeave`
e `UserVoiceStateUpdate` ao vivo. `VoiceParticipant` traz `joinedAt`,
`isPublishing`, `isScreensharing`, `isCamera`; `Server.voiceStatus` já agrega
para o rail.

O que faz o Stoat parecer chamada não é o protocolo, é o **cliente**: a linha do
canal de voz é renderizada igual à de texto, então não há nada dizendo que tem
gente lá dentro. A sala é T2.

> **T1** leitura como posição · **T2** apelido por servidor, **e a sala de voz**
> · resta só ligar o LiveKit para de fato ouvir

---

## 3. Slack — o rigor da arquitetura de informação

A contribuição do Slack não é uma feature, é uma disciplina. Quatro partes:

**a) `Cmd+K` como navegação primária.** Num app denso, a sidebar serve para
orientação e a paleta serve para movimento. O Slack provou que dá para operar o
produto inteiro pelo teclado; Linear e Notion generalizaram. Para o Vortex é a
**melhor relação valor/custo da lista inteira**: paleta sobre servidores, canais
e pessoas, sem backend, e é o que faz um cliente denso parecer *rápido* em vez
de *cheio*.

**b) O balde "depois".** Itens salvos e lembretes. O modo de falha central do
chat é que tudo é *agora* ou *perdido*. Um "guardar" por mensagem que produz uma
lista pessoal resolve isso.

**c) Canvas — o objeto durável ao lado do fluxo efêmero.** Um documento preso ao
canal. O Playbooks do Mattermost é a mesma ideia com outra forma. A intuição por
trás: um canal acumula decisões que se dissolvem no scrollback, e dar a ele
**um** objeto durável torna o fluxo efêmero tolerável. Caro. Não construir — mas
é argumento para o slot secundário que o shell já tem.

**d) A lição negativa, e é forte.** *"Also send to channel"* é o Slack admitindo
que o próprio modelo de thread falhou: thread escondida em canal movimentado é
conversa que ninguém vê. Isso é o argumento mais forte a favor do modelo de
tópico do Zulip — **ou a estrutura está no endereço da mensagem, ou você vai
parafusá-la para sempre.**

> **T1** paleta de comandos, guardar local · **T3** guardados sincronizados, canvas

---

## 4. Microsoft Teams — o exemplo negativo mais útil

Teams é o que acontece quando o cliente de chat é uma casca sobre cinco
produtos. Cada superfície tem densidade própria, navegação própria e uma ideia
própria do que é um "canal".

A lição é a lei nº 5 e a regra do Electron (*"casca fina, não segunda
aplicação"*) ditas em outro vocabulário: **coerência é uma feature, e ela morre
por acumulação, não por escolha ruim.** Nenhuma decisão isolada do Teams é
absurda; o conjunto é.

Uma coisa vale levar: **status personalizado com expiração**. Barato, e resolve
o problema real de status que fica mentindo por três dias.

> **T2** status com expiração · o resto é aviso

---

## 5. Mattermost — a prova de que auto-hospedado não precisa ser feio

Playbooks: uma checklist que vive dentro do canal e conduz um incidente. É o
"objeto estruturado durável" de novo. Para o Vortex, não agora — mas **valida a
arquitetura de slots**: um playbook é um painel, e a união `PainelId` é
exatamente onde ele aterrissaria sem tocar no shell.

A lição mais útil é de posicionamento: dá para ser auto-hospedado e parecer
produto. O Rocket.Chat é o contraexemplo.

> **T3**, e só se alguém pedir

---

## 6. Rocket.Chat — o aviso

Superfície máxima de features, sem espinha de design: omnichannel, livechat,
marketplace, e uma UI que troca de idioma visual a cada tela. Para um fork
construído por uma pessoa, **este é o modo de falha a temer**: cada feature
adicionada fora do sistema de design é imposto permanente.

Uma coisa a levar, e é real: **a tela de administração como superfície de
primeira classe.** Auto-hospedado significa que o dono também é o admin — as
configurações vão ser usadas de verdade, diferente do Discord. O Rocket.Chat faz
isso mal; a necessidade existe.

---

## 7. Google Chat — quase nada, e uma coisa

Produto desenhado por organograma. O que sobra de aproveitável é uma prova
negativa: **chat dentro do cromo de outro app sempre perde.** Argumenta a favor
do modelo de janela destacável no Electron, em vez de embutir.

---

## 8. Signal — a ausência como identidade

A UI do Signal é quase nada, e isso **é** o design. Três coisas:

**a) A ergonomia das ações de mensagem** é a mais rápida da categoria, e é
contextual, não permanente. Compare com o que temos: cada `MessageRow` monta um
`ContextMenu` inteiro do Radix, e linha monta e desmonta na velocidade da
rolagem. O conserto que já está medido e listado — **um Root no nível da lista**
— não é só o mais rápido, é o melhor UX. As duas razões convergem, o que
raramente acontece e vale registrar.

**b) Cromo zero.** O Signal quase não tem borda: a separação vem de espaço e
peso. Nosso sistema já diz *"profundidade vem de camada, não de sombra"* — o
Signal prova que dá para ir além: **a maioria das separações não precisa de
linha nenhuma.** Diretamente acionável na fase 5, que vai revisar o ritmo de
espaçamento.

**c) Efêmeras com temporizador por conversa.** Feature real, cara.

> **T0** cromo zero · **T1** ações no nível da lista · **T3** efêmeras

---

## 9. Discourse — o melhor modelo de leitura que existe

**Estado de leitura por post, não booleano.** O Discourse sabe exatamente quais
posts foram lidos. É isso que permite dizer *"14 não lidas neste tópico, a
partir daqui"* — e *a partir daqui* é um lugar, não um número.

Junte com o item 2: **o "ir para a primeira não lida" do Discord e o estado por
post do Discourse são a mesma ideia vista de dois ângulos.** Dois produtos que
não se copiaram chegando ao mesmo lugar é o sinal mais forte que esta análise
produziu.

**Correção da primeira passada, e é a maior deste documento.** Escrevi que o
protocolo tem só um booleano e que o cliente conta. Errado nas duas metades:
`ChannelUnread` guarda **`lastMessageId`** — o ID da última mensagem lida, ou
seja, **o cursor de leitura** — e **`messageMentionIds`**, um conjunto de IDs de
mensagem, não um número. `Message.ack()` escreve o cursor de volta.

O `Channel.unread` booleano é um *getter derivado* que o SDK calcula em cima
disso.

Ou seja: o modelo do Discourse que este documento chamou de "o melhor que
existe" **já está no protocolo do Stoat, e é persistido no servidor.** Ir para a
primeira não lida, a linha de novas mensagens que sobrevive à sessão, e ir para
a próxima menção são T2 — e funcionam entre dispositivos de graça.

**Trust levels** — moderação automatizada por comportamento em vez de matriz de
permissão. É o desenho de governança mais sofisticado que existe, e para uma
instância de amigos é engenharia demais. Registrado e arquivado.

> **T2** leitura como posição · trust levels **recusado por escala**

---

## 10. Matrix — portabilidade, e a prova empírica da nossa fronteira

Não vamos federar. Duas coisas mesmo assim:

**Exportação e portabilidade como promessa visível.** Auto-hospedado já dá isso
de fato; torná-lo uma superfície visível é diferencial real contra o Discord,
que dificulta de propósito.

**A lição negativa é a mais valiosa do documento:** o Element mostra o que
acontece **quando o protocolo dita a UI**. É exatamente a justificativa da camada
anticorrupção em `src/sdk/`, que hoje é argumento teórico neste projeto. O
Element é a prova empírica de que a fronteira paga o próprio custo.

> **T3** exportação · a fronteira já está construída

---

## 11. Pumble — histórico ilimitado, e o que isso realmente exige

Uma ideia: **retenção como promessa.** O limite de histórico do plano grátis do
Slack é a propriedade mais odiada dele.

O Vortex auto-hospedado tem histórico ilimitado de graça — **mas só se o cliente
conseguir alcançá-lo.** A feature não é o armazenamento, é a recuperação. Isso
promove a busca de "seria bom ter" para **a coisa que torna nossa vantagem
estrutural real**. Busca com modificadores e ir-para-data.

> **T1** busca local · **T3** busca no servidor

---

# Segunda passada — o que já chega pelo socket

A primeira passada disse que **T2 é a categoria mais desperdiçada**, e depois
classificou por intuição em vez de abrir o SDK. Esta seção é a varredura que
faltava: o que `stoat.js` expõe e o cliente ignora hoje.

Duas correções grandes já estão nos itens 2 e 9 acima. O resto:

### Mensagem

| Já existe | O que habilita | Concorrente |
|---|---|---|
| `reactions` — `Map<emoji, Set<userId>>` | reações, com quem reagiu | todos |
| `replyIds` · `reply(msg, mention)` | responder com citação | todos |
| **`pinned`** | **o painel de fixados** — o slot secundário já tem onde aterrissar | Slack · Discord |
| `roleColour` · `iconRole` | nome de autor colorido por cargo | Discord |
| `editedAt` | marca de editado | todos |
| `masquerade` | identidade de ponte/webhook | — |
| `systemMessage` | entrou, saiu, renomeou — sem inventar linha | todos |
| `nonce` | a reconciliação da mensagem otimista já documentada | — |

### Canal

| Já existe | O que habilita | Concorrente |
|---|---|---|
| **`voiceParticipants`** | **a sala de voz** | Discord |
| `description` | o tópico do canal no cabeçalho | Slack · Discord |
| `muted` | silenciar canal | todos |
| `lastMessageAt` | ordenar por atividade, "ir para a data" | Pumble |
| `mature` | portão de conteúdo | — |
| `havePermission(...)` | UI que não oferece o que a pessoa não pode fazer | Slack |

### Servidor e membro

| Já existe | O que habilita | Concorrente |
|---|---|---|
| `categories` · **`orderedChannels`** | categorias **já ordenadas pelo SDK** — a pendência é menor do que parecia | Discord |
| **`hoistedRole`** | seções de cargo na member list, **já computadas** | Discord |
| `ranking` · `orderedRoles` | hierarquia | Discord |
| `nickname` · `avatar` por servidor | identidade por servidor | Discord |
| **`pronouns`** — em `User` **e** `ServerMember` | pronomes, inclusive por servidor | Discord |
| `timeout` | membro em castigo, visível | Discord |
| `banner` | cabeçalho do servidor | Discord |
| `User.status.text` | status personalizado | Teams · Discord |

**A `hoistedRole` merece nota, porque parece brigar com uma decisão da fase 3.**
A member list usa dois baldes de presença justamente para não reordenar —
presença é 55% da carga do firehose, e uma seção por estado custaria `n log n` a
cada piscada. Seção por **cargo** não tem esse problema: cargo não pisca. Dá para
seccionar por cargo e continuar bucketizando presença dentro de cada seção. A lei
nº 1 não proíbe seção; proíbe seção sobre estado de alta frequência.

### T2 não quer dizer barato

A tabela acima responde **de onde vem o dado**, e nada mais. Confundir isso com
custo é o erro que a própria tabela induz — `reactions` estar no fio é talvez 5%
do trabalho de ter reações. Os dezesseis se dividem em quatro custos diferentes:

**a) Barato de verdade — a superfície já existe, é ler o campo e desenhar.**
`roleColour` · `editedAt` · `nickname`/`avatar` por servidor · `timeout` ·
`hoistedRole` · `orderedChannels` · `voiceParticipants`. Todos caem em
`MessageRow`, `ListaDeMembros` ou `ListaDeCanais`, que são exatamente as telas
que a fase 5 já ia auditar. **São estes que a fase 5 absorve.**

**b) O custo é a SUPERFÍCIE, não o campo.** `description` quer um cabeçalho de
canal; `banner`, um cabeçalho de servidor; `pronouns` e `status.text`, um cartão
de perfil. **Nenhuma das duas superfícies existe** — o `HoverCard` da fase 2 é
primitivo sem uso. Quatro campos, dois trabalhos, e os dois nascem movíveis pela
lei nº 6.

**c) O campo é ~5% de uma feature.** `reactions` (picker, barra de hover,
agregação, otimista, teclado, e o custo numa linha virtualizada) · `replyIds`
(citação na linha, ir-para-original, composer em modo resposta) · `pinned` (um
`PainelId` novo mais a ação de fixar) · `systemMessage` (tipo de linha novo, com
altura própria — mexe na estimativa do virtualizador). **Cada uma pede decisão
própria; nenhuma é consequência desta análise.**

**d) Não é feature, é disciplina.** `havePermission()` não se "implementa": vira
regra — **nunca renderizar ação que a pessoa não pode executar**. Custa zero
adotada agora e é varredura em todo componente se adotada depois, exatamente
como a lei nº 6. `muted` e `lastMessageAt` só significam algo com persistência
real: fase 6.

### O que a varredura revelou sobre o nosso código

O adapter mantém contadores próprios de não-lidas, incrementando `+1` por
mensagem que chega, e **nunca consulta `client.channelUnreads`**. No firehose
isso funciona, porque toda mensagem chega ao vivo. **Com rede, não:** o que
chegou enquanto a pessoa estava offline não passou pelo incremento, e o app
abriria zerado.

Não é bug hoje — é o mesmo tipo de placeholder honesto que
`definirUsuarioLocal`. Vira bug no dia da fase 6. **A semeadura a partir de
`channelUnreads` no `Ready` é item de fase 6, e agora está listada.**

---

# A tese

Somando os onze, o Vortex é:

> **A física social do Discord · a estrutura conversacional do Zulip · o rigor
> de navegação do Slack · a contenção de cromo do Signal — auto-hospedado.**

Três consequências que decidem discussão:

1. **O endereço da mensagem tem três coordenadas.** O tópico, pago na leitura e
   não no envio.
2. **Leitura é lugar, não contador.** Discord e Discourse convergindo.
3. **Teclado é a navegação primária.** A paleta, não a sidebar.

**Recusado explicitamente**, para não voltar como discussão: federação,
marketplace, omnichannel, compliance empresarial, trust levels. E IA generativa
na v1 — a única forma que caberia num cliente denso é **recuperação** (resumir o
que perdi, busca semântica sobre histórico ilimitado), que é o mesmo eixo do
item 11; qualquer outra coisa é ruído numa ferramenta julgada por latência e
legibilidade.

---

# O que isto muda na fase 5

Sete itens **T0**, que são decisão de design e não feature:

1. **O divisor carrega contexto, não data.** Prepara tópico a custo zero hoje.
2. **A razão entre o respiro de mensagem agrupada e o de grupo novo** é a decisão
   tipográfica de maior alavancagem do app inteiro — é ela que faz a lista
   parecer conversa em vez de log. Não chutar: **medir** o custo vertical de uma
   linha agrupada no Discord, Slack e Zulip no mesmo corpo de fonte, e escolher o
   alvo. Este projeto mede antes de afirmar.
3. **Separação por espaço e peso, não por régua.** Auditar canais e membros: a
   régua fica reservada para separações raras, como o divisor.
4. **Disciplina de acento, contável:** `--vx-accent` só em (a) o que está focado
   ou ativo, (b) menção, (c) ação primária. Mais de três ocorrências na tela é
   decoração — e regra contável é candidata a lint, não a checklist.
5. **A lâmina marca não-lida. Não marca menção.** Não-lida é estado
   **posicional** — a lâmina na borda é exatamente esse gesto, e é o que a pílula
   do Discord faz. Menção é **contagem**, e contagem precisa de número. Usar a
   assinatura para as duas dilui a assinatura. *Isto responde a pergunta aberta
   da fase 5.*
6. **O empty state é o começo do canal**, não uma tela de consolo — o melhor
   padrão da categoria é o do Discord.
7. **Timestamp no gutter, em hover**, nas mensagens agrupadas: densidade sem
   perder o dado.

Os sete acima foram **aceitos**. Mais três, que não são acabamento — são
funcionalidade, e por isso a fase 5 deixou de ser só polimento:

8. **A paleta de comandos.** `Cmd+K` sobre servidores, canais e pessoas.
   **T1**, sem rede.
9. **Leitura como posição** — primeira não lida, linha de novas mensagens
   persistente, ir para a próxima menção, marcar canal e servidor como lidos.
   **T2**: o cursor é `ChannelUnread.lastMessageId` e as menções são
   `messageMentionIds`. Renderizável hoje sobre o arnês; ganha persistência
   sozinha quando a rede chegar.
10. **O canal de voz como sala. T2.** A linha do canal deixa de ser um botão de
    ligar e passa a mostrar quem está lá dentro, desde o `Ready`. É a única
    escolhida que muda o *produto*, e não a superfície — no Stoat um canal de voz
    é uma chamada; aqui vira um lugar.

**A física do item 10, e ela é uma armadilha de escopo de update.** A lista de
participantes muda por ação humana (entrar, sair, ligar câmera): baixa
frequência, store normal. **Quem está falando não** — o nível de áudio vem do
LiveKit a dezenas de vezes por segundo, e é exatamente o "quem está falando"
que o `CLAUDE.md` nomeia como estado efêmero. Anel de fala vai em store separado
e com throttle na fronteira do adapter, nunca no store de canais. Sem isso, um
canal de voz movimentado repinta a coluna de canais inteira.

Ouvir de fato é a parte que sobra: `@livekit/components-react`, sessão de mídia,
dispositivos. Trabalho real — mas os serviços `voice-ingress` e `livekit` já
estão de pé no compose, então **não é fork de backend.**

---

## Terceira passada — só design

A primeira passada gastou sete linhas em design e o resto em produto. Esta é a
comparação visual, e ela começou encontrando duas falhas nossas.

### O que a comparação revelou no nosso código

**1. O ritmo de agrupamento nunca chegou a existir.** A `MessageRow` usa
`py-0.5` na continuação e `pt-3 pb-0.5` na abertura de grupo. A escala do
projeto vai de 1 a 6 e o `@theme` faz `--spacing-*: initial` — **não existe
`--spacing-0.5`**, então a utility não é gerada. Confirmado no CSS de produção:
`pt-3` e `gap-3` saem, `py-0.5` e `pb-0.5` não.

O ritmo real hoje é **0px dentro do grupo e 12px entre grupos**, não o
`4 / 14` que o comentário do código descreve. A intenção estava escrita, o
resultado nunca foi aplicado, e nada falhou — é o modo de degradação que este
projeto inteiro existe para evitar.

**Vira mecanismo, não conserto:** utility fracionária em `className` deve
reprovar no lint. Só há duas ocorrências, ambas na mesma linha, então a regra
nasce limpa.

**2. O avatar da linha usa a escala de ESPAÇO.** `size-5` resolve para
`--vx-space-5`. Dá 24px, que por acaso é o valor de `--vx-avatar-sm` — e o
comentário desse token diz literalmente por que os dois não podem ser o mesmo:
*"mexer no respiro da lista mudaria o tamanho da foto de todo mundo"*. O acaso
some no dia em que o espaçamento mudar.

### O que dá para pegar deles

**Anatomia da linha — Discord.** Calha de avatar + coluna de conteúdo; a
continuação deixa a calha vazia e mostra a hora ali **no hover**. Densidade sem
perder o dado. Três níveis de separação e não mais: dentro do grupo, entre
grupos, e o divisor.

**Peso em vez de cor para não-lida — Slack.** A lista de canais codifica leitura
em **três estados do mesmo texto** — apagado, normal, forte — sem acrescentar
decoração. Barato, silencioso, e sobrevive a daltonismo melhor que qualquer
ponto colorido.

**Menção como linha tingida com borda de início — Discord.** É o único uso bom
de `--vx-accent-soft`, token que já existe e o app não usa em lugar nenhum.

**Barra de ações flutuante com custo zero de layout — Discord.** Ela sobrepõe
para cima em vez de reservar altura. Aqui a razão é **técnica antes de
estética**: qualquer tratamento de hover que mude a altura da linha destrói a
âncora do virtualizador. Vira regra, não preferência.

**Skeleton com a geometria real — Discord.** E isto é a invariante *"linha nunca
mede 0px"* vista de outro ângulo: o estado de loading e o mecanismo que protege
a âncora são **a mesma peça**. Skeleton com altura diferente da estimativa faz a
lista pular na hidratação.

**A recipient bar do Zulip é assinatura ESTRUTURAL.** Todo concorrente tem
assinatura — a pílula do Discord, o hash do Slack, a bolha do Signal — mas
quase todas são decorativas. A do Zulip é uma **invenção de layout**, e por isso
é a mais forte da lista. A nossa lâmina hoje é posicional. Casar as duas coisas
é o caminho: **o divisor de contexto carregando a lâmina** — que é exatamente o
item T0 que já preparava tópico de graça.

**Cromo zero — Signal.** Separação por espaço e peso; régua reservada para
separação rara. O divisor merece régua; a lista de canais e a de membros, não.

**No máximo duas escalas de tipo dentro da linha** — corpo e metadata. É
consenso entre todos, e mais que isso vira ruído em rolagem rápida.

**Somos mais densos que qualquer um deles.** Avatar de 24px na linha, contra
~36 do Slack e ~40 do Discord. Não é erro — é escolha agressiva e coerente com
"ferramenta aberta 8h". O que não se sustenta é o mesmo tamanho servir à linha e
à member list: o Discord usa 40 e 32. Decisão a tomar de propósito.

### O que recusar, e por quê

- **O arredondamento novo do Discord.** Densidade trocada por respiro num app de
  sessão longa é regressão.
- **A morfose squircle do rail.** Anima `border-radius`, e nossa regra de
  movimento é `transform` e `opacity` só. Bom exemplo da regra funcionando: ela
  recusa a micro-interação mais imitada da categoria sem precisar de debate.
- **A sidebar saturada do Slack antigo.** Eles próprios saíram dela — cor
  saturada em painel grande compete com o conteúdo.
- **Drift visual por tela, do Rocket.Chat.** É o modo de falha, não uma escolha.

### A proposta de ritmo, para decidir em vez de herdar

Três níveis, **cada um pelo menos 2× o anterior** — é o que os faz lerem como
distintos em rolagem rápida, e é uma regra testável:

| Separação | Valor | Por quê |
|---|---|---|
| Dentro do grupo | `space-1` · 4px | Cola as linhas sem encostar |
| Entre grupos | `space-4` · 16px | 4× — a mudança de autor precisa ser óbvia |
| Divisor de contexto | `space-5` acima, `space-3` abaixo | Assimétrico de propósito: o divisor pertence ao que vem **depois** dele |

---

## A decisão tomada

**Tudo entrou**, features inclusive. A fase 5 deixou de ser acabamento e virou
acabamento **mais** superfície de produto — está registrado no `CLAUDE.md` com
a ordem de execução e a razão de cada posição.

O que a ordem protege, em uma linha: os sete campos baratos andam **junto** com
o passe de polimento de cada superfície, porque fazê-los depois é tocar cada
tela duas vezes; e os três que mudam a altura da linha (`systemMessage`,
citação, reações) entram **um de cada vez, com firehose entre eles**, porque o
patamar sob CPU 4x já está em ~6% contra teto de 5% e em lote não há como saber
qual deles pagou.

`havePermission()` não virou item: virou regra.

---

## Pendências que esta análise reclassifica

| Pendência | Era | Passa a ser |
|---|---|---|
| Menu de contexto no nível da lista | otimização de performance | **também** o melhor UX (Signal) |
| Apelido por servidor | detalhe da member list | peça do modelo multi-comunidade (Discord) |
| Painel secundário >2560px | espaço a preencher | onde canvas, playbook e thread aterrissam |
| Divisor de data | cosmético | a peça que prepara tópico de graça |
