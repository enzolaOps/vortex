# Superfícies ausentes — o que o Stoat tem e o Vortex não tem NADA

> Levantado por diferença entre `web/packages/client` (upstream Solid) e
> `web-react/packages/client` (nosso port). **"Ausente" aqui não quer dizer
> "diferente" — quer dizer que não existe arquivo, rota, modal nem botão.**
>
> É mapa, não roadmap. A ordem de construção é decisão separada; o que este
> documento entrega é o tamanho real do buraco e as duas dependências
> estruturais que gateiam quase tudo.

---

## Os números, para calibrar

| Upstream | Quantidade | Nosso |
|---|---|---|
| Modais de produto | **59** | **0** — o wrapper `Dialog` da fase 2 tem UM consumidor, a paleta de comandos |
| Páginas de configuração | **42** | **0** |
| Fluxos de autenticação | **12** | **1** (login) |
| Menus de contexto | **9** | **2** (mensagem, canal) |
| Rotas | URL completa (`/server/:id/channel/:id/:msg`, `/invite/:code`, `/bot/:id`) | **nenhuma** — não há router |

O port cobriu **a superfície de leitura de um canal**, com profundidade que o
upstream não tem (slots, preset, picker de paleta, leitura como posição). Tudo
o que fica em volta dela está por construir.

---

## As duas ausências estruturais

Elas não são telas. São o que faz metade da lista abaixo ser impossível hoje,
e por isso vêm antes de qualquer item individual.

### 1. Não há router

`store/navegacao.ts` guarda servidor e canal ativos em memória de módulo. Não
há URL, não há histórico, não há `back`. Consequências que não são óbvias:

- **Link de convite não pode existir.** `/invite/:code` é uma rota; sem ela,
  entrar em servidor por link é irrepresentável.
- **Permalink de mensagem não pode existir.** "Pular para a mensagem" dentro do
  app funciona (a paleta e as menções já fazem), mas colar um link no chat e
  alguém abrir, não.
- **F5 sempre volta ao mesmo lugar.** Numa jornada de 8h isso cobra.
- **Deep-link do Electron** (`vortex://`) não tem onde pousar.

Decisão pendente e não trivial: um router introduz uma segunda fonte de verdade
de navegação ao lado do store. O caminho provável é a URL ser **projeção** do
store, não o contrário — mas isso é design, não escolha de biblioteca.

### 2. Não há região "Home"

O rail lista **só servidores**. Não existe botão de home, e portanto não
existem, de uma vez:

- **DMs** — conversa direta, o `DirectMessage` do protocolo
- **Grupos** — `Group`
- **Amigos** — lista, pedidos recebidos/enviados, bloqueados
- **Mensagens salvas** — `SavedMessages`
- **Adicionar servidor** — o `+` do rail, que é o único ponto de entrada para
  criar OU entrar em servidor

O adapter já modela canal sem `serverId` (`ChannelSnapshot.serverId` é
`string | undefined`), então o domínio comporta DM sem mudança. O que falta é a
**coluna** e o **estado de rail** que a acompanham.

---

## Ausentes, por classe

### A. Criação e administração — o buraco que você citou primeiro

Nada disto existe. Todo item aqui **escreve no protocolo**, então cada um é
trabalho de fase 6 em diante, não de acabamento.

| Superfície | Upstream | Nota |
|---|---|---|
| Criar servidor | `CreateServer`, `CreateOrJoinServer`, `CreateGroupOrServer` | Ponto de entrada é o `+` do rail, que também não existe |
| Entrar em servidor | `JoinServer`, `Invite` | Depende do router (`/invite/:code`) |
| Criar canal | `CreateChannel` | Texto e voz |
| Criar / editar / apagar categoria | `CreateCategory`, `EditCategory`, `DeleteCategory` | A coluna já LÊ `orderedChannels`; falta escrever |
| Criar convite | `CreateInvite` | |
| Criar grupo · adicionar membros | `CreateGroup`, `AddMembersToGroup` | Depende da região Home |
| Cargos: criar, editar, apagar | `CreateRole`, `DeleteRole`, `ServerRoleEditor`, `ServerRoleOverview` | Já LEMOS cor de cargo e cargo hasteado |
| Apagar canal / servidor / sair | `DeleteChannel`, `DeleteServer`, `LeaveServer` | |
| Moderação | `KickMember`, `BanMember`, `BanNonMember`, `RemoveMember`, `ListBans` | `havePermission` já é regra do projeto — os botões nascem escondidos certos |
| Webhooks | `CreateWebhook`, `ViewWebhook`, `WebhooksList` | |
| Emojis do servidor | `EmojiList`, `EmojiPreview` | |
| Bots | `CreateBot`, `AddBot`, `DeleteBot`, `EditBotUsername`, `ResetBotToken`, `MyBots`, `ViewBot` | Superfície inteira ausente |

### B. Configurações — 42 páginas, zero

Não existe **nenhum** ponto de entrada de configuração no app. A entrada do
modo edição de layout mora hoje no cabeçalho do arnês, com comentário dizendo
que "no cliente de verdade é de lá que ela sai" — e esse "lá" nunca foi
construído.

- **Usuário:** conta, perfil, sessões (listar/renomear/derrubar), aparência,
  notificações, sons, idioma, voz (entrada, processamento, compartilhamento de
  tela), desktop/native, avançado, feedback, assinaturas
- **Servidor:** visão geral, cargos, banimentos, convites, emojis
- **Canal:** visão geral, permissões (editor + visão geral), webhooks

⚠ **Duas dessas páginas já têm dono no Vortex e não sabem disso:** "aparência"
é o `PickerDePaleta` + o `PainelDeEdicao` que a fase 4 construiu. Elas não
precisam ser portadas — precisam de um **contêiner de configurações** onde
morar. Isso torna o esqueleto de settings mais barato do que a contagem de 42
sugere.

### C. Voz — sabemos quem está na sala, não sabemos entrar

Esta é a mais visível, porque é meia-feita **de propósito** e está registrada
assim: a fase 5 entregou "o canal de voz como LUGAR" (ocupantes visíveis antes
de entrar, ícone de tela/câmera, `VoiceChannelJoin`/`Leave` ao vivo) e deixou
"ouvir de fato" para depois.

Ausente:

- **Entrar e sair de uma chamada** — não há botão
- **Tela de chamada** — `VoiceCallCard`, `VoiceCallCardActiveRoom`,
  `ParticipantTile`, `VoiceCallCardStatus`
- **Picture-in-picture / chamada minimizada** — `VoiceCallCardPiP`, que é como
  o upstream mantém a chamada viva enquanto se navega
- **Controles** — mudo, ensurdecer, câmera, compartilhar tela, desligar
  (`VoiceCallCardActions`)
- **Compartilhamento de tela** — `ScreenSharePicker`, `ScreenShareSettings`
- **Áudio** — `RoomAudioManager` (elementos de áudio, saída, volume por pessoa)

Dependência: `@livekit/components-react`. **Não é fork de backend** —
`voice-ingress` e `livekit` já estão de pé no compose.

⚠ A armadilha já está escrita no briefing e vale repetir aqui porque é onde
esta superfície pode arruinar o gate: **quem está falando** vem do LiveKit
dezenas de vezes por segundo. Anel de fala em store efêmero com throttle na
fronteira, nunca no store de canais.

### D. Perfil de usuário — temos o hover, não temos o cartão

`CartaoDePerfil` existe e cobre `pronouns`, `status.text`, apelido e cor de
cargo **em hover**. O que não existe é o **perfil aberto**, que no upstream é
modal e carrega o que não cabe num hover:

- `UserProfile` — banner, bio, badges, entrou em (`ProfileJoined`)
- `UserProfileRoles` — cargos do servidor
- `UserProfileMutualFriends` / `UserProfileMutualGroups` — o que temos em comum
- `ProfileActions` — mandar mensagem, adicionar, bloquear
- `ServerIdentity` — meu apelido/avatar NESTE servidor
- `CustomStatus` — definir meu status

O `banner` é o último campo do protocolo que a fase 5 deixou para trás, e a
razão registrada era exatamente esta: falta a superfície onde ele cabe.

### E. Autenticação — temos login, e só

Dos 12 fluxos do upstream, existe 1.

Ausentes: **criar conta**, **verificar e-mail**, **reenviar verificação**,
**recuperar senha**, **confirmar nova senha**, **apagar conta**, **MFA**
(fluxo, TOTP, códigos de recuperação), **onboarding** (escolher nome de usuário
na primeira entrada), **sessão derrubada** (`SignedOut`).

Nota honesta: sem "criar conta" e sem "recuperar senha", o app só serve a quem
já tem conta criada por outro cliente.

### F. Superfícies da mensagem que faltam

A linha está madura — agrupamento, divisores, anexo com espaço reservado,
citação, reações, sistema, menção, estado de envio, barra de ações em hover.
O que falta é em volta dela:

| Ausente | Upstream | Nota |
|---|---|---|
| **Embeds** | `Embed`, `TextEmbed`, `SpecialEmbed`, `Invite` (embed) | `MessageSnapshot` **não tem campo de embed**. Muda a altura da linha — cuidado com o gate |
| **Anexar arquivo** | `FileCarousel`, `CompositionMediaPicker` | Lemos anexo, não enviamos |
| **Seletor de emoji** | `EmojiPicker` | Reagimos pelo menu; não há picker |
| **Seletor de GIF** | `GifPicker` | |
| **Editar mensagem in-line** | `EditMessage` | O item de menu foi removido por ser inerte; escreve no protocolo |
| **Apagar mensagem** | `DeleteMessage` | Idem |
| **Buscar no canal** | `TextSearchSidebar` | `PainelId` novo — nasce movível |
| **Visualizador de imagem** | `ImageViewer` | Clicar num anexo hoje não faz nada |
| **Aviso de link externo** | `LinkWarning` | É superfície de **segurança**, não de conveniência |
| **Denunciar conteúdo** | `ReportContent` | |
| **Mensagem de bloqueado** | `BlockedMessage` | Depende de bloqueio existir |
| **Autocomplete no composer** | `AutoComplete` | `@pessoa`, `#canal`, `:emoji:` |

### G. Diversos

- **Discover** — navegador de servidores públicos (`Discover.tsx`)
- **Server Home** — a tela do servidor sem canal escolhido (`ServerHome.tsx`)
- **Changelog / mudança de política** — `Changelog`, `PolicyChange`
- **Portão de idade** — `AgeGate`, `ChannelToggleMature`
- **Info de canal / servidor** — `ChannelInfo`, `ServerInfo`
- **Titlebar do Electron** — `Titlebar`. A casca Electron inteira ainda não
  existe no port
- **Notificações** — `NotificationsWorker`, service worker, sons

---

## O que este mapa NÃO diz

- **Não diz o que construir.** Vários itens aqui o Vortex pode escolher não
  ter (bots, assinaturas, denúncia), e "diverge do Stoat como produto" é
  decisão registrada — a lista é do que o upstream tem, não do que devemos ter.
- **Não estima custo.** Um modal de confirmação e o sistema de configurações
  aparecem como uma linha cada.
- **Não considera ordem.** Mas duas dependências são fato e não opinião: o
  **router** gateia convite, permalink e deep-link; a **região Home** gateia
  DM, grupo, amigos e o `+` de criar servidor.
