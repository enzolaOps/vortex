import { toast } from "../components/ui/toastStore";

/**
 * Os controles DESENHADOS que ainda não fazem nada.
 *
 * ⚠ **Este arquivo existe por decisão explícita de quem toca o produto, e ela
 * se sobrepõe às regras do projeto que diziam o contrário.** A régua anterior
 * era "não desenhar o que não funciona" — o lint de `onSelect` foi instalado
 * justamente para matar item de menu inerte, e `superficies-ausentes.md` manda
 * superfície nova nascer com porta. A decisão nova é outra: a interface é
 * construída 1:1 com o design AGORA, e a implementação vem numa rodada
 * própria depois.
 *
 * O risco dessa ordem é conhecido e tem nome no próprio briefing: alvo que
 * recebe foco, parece clicável e não faz nada é indistinguível de um bug. O
 * que este registro faz é trocar "não faz nada" por "diz que ainda não faz", e
 * transformar a dívida em LISTA em vez de arqueologia.
 *
 * Três propriedades que valem mais que o toast:
 *
 * 1. **União fechada.** Controle pendente novo não compila até entrar aqui com
 *    superfície, descrição e do que depende. É a mesma mecânica de `ModalId`,
 *    `PainelId` e `SecaoId`.
 * 2. **`depende` é o plano da rodada seguinte.** Agrupar por ele dá a ordem de
 *    implementação sem ninguém reler tela nenhuma.
 * 3. **Sai do bundle quando esvaziar.** O dia em que a última entrada for
 *    removida, o módulo inteiro vira código morto e o `pnpm utilities` acusa.
 */
export const PENDENCIAS = {
  /* ---------------------------------------------------------- eventos */
  /*
    O resto do assistente de evento é real — local, quando, repetição,
    lembrete, nome, descrição e capa. Anunciar não: o design promete "publica
    o card ao criar", e card de evento dentro de um canal é embed que o
    protocolo não tem. Mandar um link em texto seria outra coisa com o mesmo
    rótulo.
  */
  anunciarEvento: {
    superficie: "Criar evento · passo Detalhes",
    faz: "Publicar o card do evento no canal de avisos ao criar.",
    depende: "embed de evento na mensagem — o protocolo não tem",
  },

  /* --------------------------------------------- editor de cargo */
  /*
    Quatro entradas para uma aba, e a divisão é por DEPENDÊNCIA — igual à da
    tag. Menção precisa de campo no protocolo; o ícone precisa de upload;
    holográfico e gerenciar em lote precisam só de tela.
  */
  /*
    ⚠ **Era `estiloDeCargo`, cobrindo gradiente E holográfico, com a razão
    errada para os dois.** Dizia "o protocolo tem só colour, ou seja fork do
    serviço api" — e o `RE_COLOUR` do servidor aceita gradiente em `colour`.
    O gradiente saiu daqui e funciona. O holográfico do design também é um
    gradiente ESTÁTICO (`100deg, #8FE9F0, #C9B6F5 45%, #F3C6A8`), sem
    animação, então ele também cabe em `colour`: o que falta é só a tela —
    reconhecer esse preset na leitura e desenhar a pílula clara com texto
    escuro que o design pede.
  */
  estiloHolografico: {
    superficie: "Configurações do servidor · Cargos · Exibição",
    faz: "Pintar o nome do cargo com o gradiente holográfico do design.",
    depende:
      "só a tela — o preset é um gradiente estático que colour já aceita; falta reconhecê-lo na leitura e a pílula clara de texto escuro",
  },
  /*
    A IMAGEM entrou (`config/IconeDoCargo.tsx`); sobrou o emoji. `Role.icon` é
    um arquivo do `autumn` na tag `icons` — emoji personalizado mora em
    `emojis` e o servidor recusa, e emoji Unicode não é arquivo nenhum.
  */
  emojiComoIconeDeCargo: {
    superficie: "Configurações do servidor · Cargos · Exibição",
    faz: "Usar um emoji como ícone do cargo, em vez de uma imagem.",
    depende:
      "desenhar o emoji numa imagem e subi-la em `icons` — o protocolo só guarda arquivo",
  },
  /* ----------------------------------------------- tag do servidor */
  /*
    Tag, emblema e a escolha de exibir são do fork e FUNCIONAM. O que sobra é
    a restrição por cargo: o fork não guarda qual cargo a tag exige.
  */
  exigirCargoDaTag: {
    superficie: "Configurações do servidor · Tag do servidor",
    faz: "Deixar só quem tem o cargo escolhido exibir a tag.",
    depende: "um campo de cargo exigido na tag do servidor — o fork guarda só a tag e o emblema",
  },
  /* --------------------------------------------------------- entrada */
  /*
    ⚠ **O QR é do design e o protocolo não tem o conceito.** Entrar por código
    exige um canal onde o aparelho já autenticado autoriza a sessão nova — no
    Stoat não há rota, evento nem tipo para isso. Fica desenhado porque a tela
    de entrada é a primeira que alguém vê, e um caminho a menos ali é a
    diferença entre entrar e desistir.
  */
  entrarComQr: {
    superficie: "Tela de entrada",
    faz: "Entrar lendo um código com um aparelho onde a sessão já está aberta.",
    depende:
      "autorização de sessão por outro dispositivo no protocolo — não há rota nem evento",
  },


  /* --------------------------------------------------------- privacidade */
  exportarDados: {
    superficie: "Configurações · Privacidade",
    faz: "Pedir uma cópia de tudo que a conta guarda, por e-mail.",
    depende: "exportação de dados no protocolo — não há rota, nem no upstream",
  },

  /* ---------------------------------------------------------------- voz */
  /*
    ⚠ Os dois são CONCEITO que o protocolo Stoat não tem — nem tipo, nem
    campo, nem evento —, e por isso entram aqui em vez de serem construídos:
    o registro existe justamente para o controle que o design desenha e o
    back-end não sustenta. Clicá-los diz o que fariam, em vez de não fazer
    nada.
  */
  atividades: {
    superficie: "Faixa de voz",
    faz: "Abrir uma atividade compartilhada na sala — jogo, quadro, vídeo.",
    depende: "conceito de atividade no protocolo, e um host para embutir",
  },
  /* ------------------------------------------------------------ composer */
  /*
    ⚠ **O seletor de emoji EXISTE e funciona**, com tom de pele. O que sobrou
    pendente é o que ele não alcança sozinho: ONDE o seletor abre e o dado do
    servidor.

    ⚠ **A lista curada de ~170 emojis NÃO é pendência**, e já esteve aqui como
    `emojiCompleto`. Ela não tem controle: nada na tela promete os 3.800 do
    Unicode e falha em entregar. O limite está escrito em `seletores/emojis.ts`,
    que é onde quem for trocar o dataset vai olhar — mesma família da etiqueta
    FÓRUM e da reação SUPER, que ficam fora deste registro pelo mesmo motivo.
  */
  /*
    ⚠ **O seletor de GIF saiu daqui: ele busca e envia pelo `gifbox`** — o
    proxy do próprio servidor, que guarda a chave do provedor. O que sobrou é
    a estrela ao lado da busca.
  */
  gifFavoritos: {
    superficie: "Seletor de GIF",
    faz: "Guardar GIFs favoritos e abri-los pela estrela.",
    depende: "lista guardada por conta — o `gifbox` não tem favoritos e o protocolo não tem campo para eles",
  },

  /* ------------------------------------------------------- linha de mensagem */
  /*
    ⚠ O `depende` dizia "`Attachment.description` no protocolo", e o campo NÃO
    existe: `File` (`crates/core/models/src/v0/files.rs`) não tem descrição e
    `DataMessageSend.attachments` é lista de IDs. É fork, não tela.
  */
  textoAlternativo: {
    superficie: "Anexo",
    faz: "Ler e escrever a descrição de uma imagem para quem não a vê.",
    depende:
      "descrição de anexo no protocolo — `File` não tem o campo e o envio leva só IDs (fork de delta + autumn)",
  },

  /*
    ⚠ **`criarTopico`, `topicos` e `topicoDaMensagem` SAÍRAM daqui — os três
    dependiam de threads no protocolo, e o servidor deste fork as tem:** tópico
    é `TextChannel` com `thread`, fora de `server.channels`. Ver
    `sdk/topicos.ts` e o painel `topicos`.
  */

  /* ---------------------------------------------------- cabeçalho do canal */
  /*
    ⚠ **`buscaNoCanal` e `filtroDeBusca` SAÍRAM daqui — o painel existe, a
    busca é real e os filtros também (`busca/filtros.ts`).**
  */

  /* ------------------------------------------- modal do sino (notificações) */
  notificarEventosDoServidor: {
    superficie: "Notificações do servidor",
    faz: "Avisar quando um evento agendado do servidor começar.",
    depende: "evento agendado no protocolo — não há tipo, campo nem rota",
  },
  seguirTopicosAutomaticamente: {
    superficie: "Notificações do canal",
    faz: "Seguir sozinho os tópicos em que você responder.",
    depende: "threads no protocolo",
  },
  /*
    ⚠ **`caixaDeEntrada` e `marcarTudoLido` SAÍRAM daqui.** O painel existe, e
    marcar tudo é uma fila de `ack` com concorrência limitada
    (`marcarTodosLidos`). O que dependia de protocolo era só a aba de tópicos,
    e ela diz isso na própria tela.
  */

  /* ------------------------------------------- ações da mensagem (fase 5) */
  /* `marcarNaoLida` e `removerEmbed` saíram: os dois existem no menu. */

  /* ------------------------------------------- menu do usuário na timeline */
  /*
    ⚠ **Três saíram daqui na fase 6, e a causa das três era a MESMA:** a
    tabela de cargos resolvida. `cargosDoMembro`, `alterarApelido` e
    `moverParaCanal` dependiam de saber quais cargos a pessoa tem e onde ela
    está na hierarquia — `MemberSnapshot` carregava a cor e o nome do cargo
    HASTEADO, e nada mais. `cargosIds` e `abaixoDeMim` destravaram os três de
    uma vez, junto com as pílulas de cargo e o item "acima da sua hierarquia".
  */
  /* --------------------------------------------------- assistir */
  /*
    ⚠ **Um pendente só na tela de assistir, e o resto dela é REAL** — vale
    registrar porque a lista costuma dar a impressão contrária. Qualidade do
    stream é `RemoteTrackPublication.setVideoQuality`, "só áudio" é
    `setEnabled(false)`, volume individual e "silenciar só para mim" são
    `RemoteParticipant.setVolume`, e "transmitir também" é o mesmo
    `alternarTela` de sempre. Os quatro escrevem no LiveKit de verdade.

    ⚠ **A contagem de quem está ASSISTINDO fica de fora do registro**, pelo
    contrato dele: não há controle para clicar. Ela é DADO que nem o protocolo
    do Stoat nem o `livekit-client` produzem — quem publica não recebe
    contagem de assinantes, isso é webhook de servidor. Mesma família da
    etiqueta FÓRUM e do selo LIVE. O cabeçalho mostra "N na sala", que é
    verdade.
  */

  /* ------------------------------------------------ transmitir tela */
  /*
    ⚠ **Um pendente só no palco de transmissão, e a razão de os outros não
    estarem aqui vale registrar.** Pausar, trocar fonte e o áudio da fonte são
    REAIS — `mute()` na faixa, recaptura, e a faixa de `ScreenShareAudio`. O
    que o design desenha e o LiveKit não entrega é escolher a codificação DE
    DENTRO da transmissão em curso.

    A contagem de quem está ASSISTINDO fica de fora do registro de propósito,
    pelo contrato dele: não há controle para clicar. Ela é DADO que nem o
    protocolo do Stoat nem o `livekit-client` produzem — quem publica não
    recebe contagem de assinantes; isso é webhook de servidor. É a mesma
    família da etiqueta FÓRUM e do selo LIVE, e mora em comentário no arquivo
    que a mostraria.
  */

  /* ---------------------------------------------------- criar canal */
  /*
    ⚠ **`canalDeForum` e `canalDeMidia` SAÍRAM daqui.** O Stoat não tem os
    dois conceitos, e este fork os acrescentou de forma aditiva: `type: Forum |
    Media` na criação, e o canal nasce `TextChannel` com `forum` — um cliente
    antigo vê texto. Ver `sdk/vortexCanal.ts`.
  */

  /* ------------------------------------------------- criar servidor */

  /* ------------------------------------------- acesso e segurança do servidor */
  /*
    ⚠ **O grupo encolheu de sete para três quando o fork do `api` ganhou
    `security`.** Modo de entrada, fila de aprovação, e-mail verificado, nível
    de verificação, DM entre membros, filtro de convites e emergência saíram
    daqui: são campo, rota e evento do servidor agora. Sobraram os três que
    precisam de algo que nem o fork tem.
  */
  telefoneVerificado: {
    superficie: "Configurações do servidor · Acesso e Segurança",
    faz: "Exigir telefone verificado para entrar e para o nível de verificação mais alto.",
    depende:
      "telefone na conta — o sistema de contas do Stoat não tem campo nem verificação de telefone",
  },
  filtroDeMidia: {
    superficie: "Configurações do servidor · Segurança",
    faz: "Analisar a mídia enviada e borrar o que for explícito.",
    depende:
      "`explicit_content_filter` no protocolo + um analisador no lado do servidor",
  },
  pausaAutomatica: {
    superficie: "Configurações do servidor · Segurança",
    faz: "Pausar convites sozinho num pico anormal de entradas e avisar a moderação.",
    depende:
      "detecção de pico no serviço `api` — a emergência manual existe, o gatilho automático não",
  },

  /* --------------------------------------------- configurações de canal */
  /*
    ⚠ **Os cinco de configuração de canal têm a MESMA causa e mereciam ficar
    juntos: `DataEditChannel`.** O protocolo aceita `name`, `description`,
    `nsfw` e `voice.max_users`, e mais nada. `slowmode` é o pior deles porque
    ENGANA — o objeto do canal carrega o valor e o `stoat.js` expõe o getter,
    então a tela mostra o estado real e o controle não move. A tabela medida
    está em `sdk/canal.ts`.
  */

  /* -------------------------------------------------------- perfil */
  /*
    ⚠ **O interruptor existia e gravava, e não havia NADA atrás dele** — nem na
    casca nem no cliente. As outras preferências da tela Desktop chegaram à
    casca; esta seria a única gravada sem efeito, então virou pendente.
  */
  preCarregarAnexos: {
    superficie: "Configurações · Desktop",
    faz: "Baixar as imagens dos canais com não lidas antes de você abri-los.",
    depende:
      "decidir o que pré-carregar (quais canais, quantas mensagens) e um limite de banda — não há nada disso no app hoje",
  },
  /*
    O `⋯` da chamada direta. O design desenha o alvo na barra e não desenha o
    menu; ensurdecer, que é o item óbvio, já está no painel de usuário e no
    cartão flutuante — inventar a lista seria escrever o design.
  */
  menuDaChamada: {
    superficie: "Chamada direta, na barra de controles",
    faz: "Abrir as ações que não cabem na barra (ensurdecer, dispositivos, tela cheia).",
    depende: "o conteúdo do menu, que o design não desenha",
  },
} as const satisfies Record<
  string,
  { superficie: string; faz: string; depende: string }
>;

export type PendenciaId = keyof typeof PENDENCIAS;

/* ============================================================
   As superfícies que não existem
   ============================================================ */

/**
 * O que a referência tem e este app NÃO — sem nenhum controle na tela.
 *
 * ⚠ **Lista SEPARADA, e não nove chaves a mais em `PENDENCIAS`, porque o
 * teste do registro reprovaria — e ele está certo.** `pendencias.test.ts`
 * exige que toda entrada tenha um controle que a alcance, e a mensagem de
 * falha prescreve exatamente esta saída: *"se não há o que clicar, o lugar da
 * limitação é um comentário no arquivo dela"*. Aqui não há arquivo — a
 * superfície inteira não existe —, então o lugar é este.
 *
 * A diferença entre as duas listas é o que se pode fazer com elas:
 *
 * - `PENDENCIAS` é **alvo inerte**: o controle está desenhado, recebe foco, e
 *   ao ser clicado diz que ainda não faz. Trocar "não faz nada" por "diz que
 *   ainda não faz" é todo o valor dela.
 * - `SUPERFICIES_AUSENTES` é **buraco**: não há alvo, e por isso não há toast.
 *   O valor aqui é só o que `depende` sempre deu — tornar visível e dar a
 *   ordem da rodada seguinte sem ninguém reler tela nenhuma.
 *
 * ⚠ **Entrada daqui MUDA DE LISTA quando ganhar um controle**, e não fica nas
 * duas. Uma superfície com botão desenhado é uma pendência; uma sem botão é
 * uma ausência. O teste guarda a fronteira nos dois sentidos.
 *
 * ⚠ **Nove entradas achadas por varredura, não por memória.** A referência tem
 * 104 componentes e 39 telas; o cruzamento contra esta árvore encontrou nove
 * superfícies que não estavam em registro NENHUM — nem aqui, nem no
 * `CLAUDE.md`, nem em `superficies-ausentes.md`. Eram invisíveis: ninguém
 * sabia que faltavam. As demais divergências já tinham razão escrita (a
 * reação SUPER depende de fork do serviço `api`; modo compacto, registro de
 * auditoria e os três primitivos de campo estão no `CLAUDE.md`).
 *
 * `referencia` é o arquivo do projeto de referência, para a próxima pessoa não
 * ter de procurar o desenho.
 */
export const SUPERFICIES_AUSENTES = {
  /* ------------------------------------------------------------- voz */
  /*
    ⚠ **O chat embutido e o menu do participante SAÍRAM daqui** — ver
    `voz/ChatDaSala.tsx` e `voz/MenuDoParticipante.tsx`. A dependência do menu
    ("`ServerMember.edit({voice_channel})` para mover") nunca foi bloqueio: o
    `member_edit.rs` aceita `voice_channel`, `can_publish`, `can_receive` e
    `remove: ["VoiceChannel"]` desde o upstream.

    O que sobra do chat é só a metade que o protocolo não guarda: entrar e sair
    da sala não vira mensagem de sistema, e mostrar só para quem estava olhando
    contradiria a promessa do próprio design de que "o histórico persiste".
  */
  entradasNoChatDaSala: {
    superficie: "Chat embutido do canal de voz",
    faz: "Entradas, saídas e início de transmissão como eventos no meio da conversa.",
    depende:
      "mensagem de sistema de voz no protocolo — `VoiceChannelJoin`/`Leave` são eventos de socket, não gravados",
    referencia: "components/voice/VoiceChannelChat.tsx",
  },

  /*
    ⚠ **`duracaoDoSilencio` e `notificacoesPorServidorECanal` SAÍRAM daqui.**
    O servidor tem silêncio próprio (`silenciarServidor`, submenu no menu do
    servidor) e o sino abre `ModalDeNotificacoes`, com herança servidor →
    canal.
  */
} as const satisfies Record<
  string,
  { superficie: string; faz: string; depende: string; referencia: string }
>;

export type SuperficieAusenteId = keyof typeof SUPERFICIES_AUSENTES;

/**
 * O que um controle pendente faz ao ser acionado.
 *
 * Um toast, e não silêncio. Silêncio é o modo de falha que o briefing
 * classifica como pior que a ausência: a pessoa clica, nada acontece, e não há
 * como distinguir "não existe ainda" de "quebrou". O toast custa uma linha e
 * responde a pergunta.
 *
 * `info` e não `erro`: não houve falha. A ação existe no desenho e ainda não no
 * código, que é uma informação sobre o produto, não sobre a tentativa.
 */
export function aindaNao(id: PendenciaId): () => void {
  return () => {
    const p = PENDENCIAS[id];
    toast({
      tipo: "info",
      titulo: "Ainda não está pronto",
      descricao: `${p.faz} Depende de: ${p.depende}.`,
    });
  };
}
