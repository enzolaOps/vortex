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
  /* -------------------------------------------------------- notificação */
  /*
    ⚠ **Só UM pendente na tela de notificações, e é de propósito.** As
    preferências ali são reais e ficam guardadas; o que falta é quem as
    CONSOME — áudio para o som, service worker para o push, casca Electron
    para o badge. Registrar cada interruptor como pendente daria quatro
    controles que não guardam o que se escolhe, o que é pior que guardar sem
    consumir: a forma da tela não muda quando o notificador chegar.

    Pedir permissão é diferente: é chamada ao navegador que só faz sentido
    com o notificador atrás, e não teria o que guardar.
  */
  permissaoDeNotificacao: {
    superficie: "Configurações · Notificações",
    faz: "Pedir ao navegador ou ao sistema para liberar notificações.",
    depende: "um notificador que as dispare — áudio, service worker ou Electron",
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

  /* ------------------------------------------------------- voz e vídeo */
  /*
    ⚠ **Seis pendências e NENHUMA delas é "a tela não existe".** Todas as
    preferências desta seção são guardadas, e quatro chegam ao WebRTC de
    verdade (`constraintsDeAudio` em `store/preferenciasDeVoz.ts`). O que está
    aqui é o que precisa de algo que o navegador ou o sistema não dão.

    ⚠ **O medidor de nível ao vivo saiu daqui**, e não porque passou a
    funcionar: ele nunca foi DESENHADO. A seção tem "Volume de entrada", que é
    um deslizante real, e nenhum medidor ao lado dele — uma entrada num
    registro de controles pendentes, sem controle, é dívida que ninguém
    consegue ver na tela para cobrar.
  */
  ruidoAgressivo: {
    superficie: "Configurações · Voz e vídeo",
    faz: "Supressão de ruído mais forte que a do navegador.",
    depende: "RNNoise (`@livekit/krisp-noise-filter`) — o `noiseSuppression` do navegador é booleano",
  },
  atenuarOutrosApps: {
    superficie: "Configurações · Voz e vídeo",
    faz: "Baixar o volume dos outros programas quando alguém fala.",
    depende: "mixer do sistema operacional, via casca Electron",
  },
  fundoDeVideo: {
    superficie: "Configurações · Voz e vídeo",
    faz: "Desfocar o fundo ou trocá-lo por uma imagem.",
    depende: "segmentação de imagem (`@livekit/track-processors`) — meio megabyte de modelo",
  },
  atalhoGlobal: {
    superficie: "Configurações · Voz e vídeo",
    faz: "Gravar uma combinação que funciona mesmo com o app em segundo plano.",
    depende: "`globalShortcut` do Electron — o navegador não vê tecla fora da aba",
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
    ⚠ **O seletor de emoji EXISTE e funciona.** O que sobrou pendente é o que
    ele não alcança sozinho, e os três estão separados de propósito: um é
    ONDE o seletor abre, um é dado do servidor, um é modificador de glifo.

    ⚠ **A lista curada de ~170 emojis NÃO é pendência**, e já esteve aqui como
    `emojiCompleto`. Ela não tem controle: nada na tela promete os 3.800 do
    Unicode e falha em entregar. O limite está escrito em `seletores/emojis.ts`,
    que é onde quem for trocar o dataset vai olhar — mesma família da etiqueta
    FÓRUM e da reação SUPER, que ficam fora deste registro pelo mesmo motivo.
  */
  tomDePele: {
    superficie: "Seletor de emoji",
    faz: "Escolher o tom de pele padrão dos emojis de pessoa.",
    depende: "modificadores Fitzpatrick no dataset de emoji",
  },
  gif: {
    superficie: "Composer",
    faz: "Seletor de GIF.",
    depende: "provedor de GIF (rede externa)",
  },
  figurinha: {
    superficie: "Composer",
    faz: "Seletor de figurinhas do servidor.",
    depende: "figurinhas no protocolo + upload",
  },
  /* Dois consumidores, uma entrada: o conceito é o mesmo, e duplicar a
     pendência daria duas frases para manter em dia sobre o mesmo bloqueio. */
  soundboard: {
    superficie: "Composer e faixa de voz",
    faz: "Tocar um efeito sonoro curto — no canal ou para a sala inteira.",
    depende: "soundboard no protocolo + upload",
  },
  /*
    ⚠ **A linha de enquete na timeline EXISTE agora**, e o que ficou pendente é
    só criar — porque criar é o que precisa de um servidor que saiba guardar.
    Ver `store/enquetes.ts`: uma enquete guardada só no cliente daria uma
    contagem que só quem criou enxerga.
  */
  enquete: {
    superficie: "Criar enquete",
    faz: "Publicar a enquete para todo mundo do canal poder votar.",
    depende: "enquete no protocolo (tipo de mensagem + evento de voto)",
  },
  /*
    ⚠ **Tocar já EXISTE** — ver `list/ReprodutorDeVoz.tsx`. O que continua
    pendente é gravar, e a dependência é a mesma de `anexar`: sem upload, uma
    gravação não tem para onde ir, e pedir o microfone para produzir um arquivo
    que morre na aba é pior que não ter o botão.
  */
  mensagemDeVoz: {
    superficie: "Composer",
    faz: "Gravar e enviar mensagem de voz.",
    depende: "upload ao servidor de mídia (autumn) + `MediaRecorder`",
  },

  /* ------------------------------------------------------- linha de mensagem */
  baixarAnexo: {
    superficie: "Visualizador de mídia",
    faz: "Salvar o arquivo no computador.",
    depende: "`Content-Disposition` do servidor de mídia — `<a download>` de origem cruzada é ignorado pelo navegador",
  },
  textoAlternativo: {
    superficie: "Anexo",
    faz: "Ler e escrever a descrição de uma imagem para quem não a vê.",
    depende: "`Attachment.description` no protocolo + campo no envio",
  },

  /* --------------------------------------------------- coluna de canais */
  criarTopico: {
    superficie: "Linha de canal",
    faz: "Abrir um tópico a partir do canal.",
    depende: "threads no protocolo",
  },

  /* ---------------------------------------------------- cabeçalho do canal */
  topicos: {
    superficie: "Cabeçalho do canal",
    faz: "Abrir o painel de tópicos ativos, seguindo e arquivados.",
    depende: "threads no protocolo + painel `topicos` em `PainelId`",
  },
  /*
    ⚠ **`buscaNoCanal` SAIU daqui — o painel existe e a busca é real.** O que
    sobrou pendente são as duas coisas que o protocolo não sabe fazer, e elas
    ficam separadas porque bloqueiam por razões diferentes: uma é sintaxe de
    consulta que a rota não aceita, a outra é escopo que a rota não tem.
  */
  filtroDeBusca: {
    superficie: "Painel de busca",
    faz: "Filtrar por autor (`de:`), por tipo de anexo (`tem:`) e por data.",
    depende:
      "`POST /channels/{id}/search` aceita só `query`, `sort`, `limit` e cursor — filtrar no cliente esvaziaria páginas inteiras e a contagem mentiria",
  },
  buscaNoServidor: {
    superficie: "Painel de busca",
    faz: "Buscar em todos os canais do servidor de uma vez.",
    depende:
      "a rota de busca é POR CANAL — varrer N canais no cliente seriam N chamadas e uma ordenação que nenhuma delas conhece",
  },
  /*
    ⚠ **`caixaDeEntrada` SAIU daqui — o painel existe.** O que dependia de
    protocolo era só a aba de tópicos, e ela diz isso na própria tela.
  */
  marcarTudoLido: {
    superficie: "Caixa de entrada",
    faz: "Zerar as não-lidas de todos os canais de uma vez.",
    depende: "`ack` em lote — hoje é uma chamada por canal, e são dezenas",
  },

  /* ------------------------------------------------------------- rail */
  baixarApp: {
    superficie: "Rail",
    faz: "Baixar o Vortex para desktop.",
    depende: "casca Electron empacotada e publicada",
  },

  /* ------------------------------------------- ações da mensagem (fase 5) */
  topicoDaMensagem: {
    superficie: "Ações da mensagem",
    faz: "Abrir um tópico a partir desta mensagem.",
    depende: "threads no protocolo",
  },
  marcarNaoLida: {
    superficie: "Menu da mensagem",
    faz: "Voltar o cursor de leitura para antes desta mensagem.",
    depende: "`ack` para trás — o protocolo só move o cursor para a frente",
  },
  removerEmbed: {
    superficie: "Menu da mensagem",
    faz: "Esconder o cartão de link gerado para esta mensagem.",
    depende: "supressão de embed no protocolo",
  },

  /* ------------------------------------------- menu do usuário na timeline */
  /*
    ⚠ **Três saíram daqui na fase 6, e a causa das três era a MESMA:** a
    tabela de cargos resolvida. `cargosDoMembro`, `alterarApelido` e
    `moverParaCanal` dependiam de saber quais cargos a pessoa tem e onde ela
    está na hierarquia — `MemberSnapshot` carregava a cor e o nome do cargo
    HASTEADO, e nada mais. `cargosIds` e `abaixoDeMim` destravaram os três de
    uma vez, junto com as pílulas de cargo e o item "acima da sua hierarquia".
  */
  /* ------------------------------------------------- criar categoria */
  /*
    ⚠ **Categoria não tem PERMISSÃO no protocolo.** `Category` é
    `{id, title, channels}` e nada mais — a própria referência diz que a lista
    de acesso escreve "overrides de categoria", e eles não existem no Stoat. A
    lista de "quem pode ver" vem junto com a privacidade, porque só faz sentido
    com ela: sem privacidade não há a quem restringir.
  */
  categoriaPrivada: {
    superficie: "Criar categoria",
    faz: "Fechar a categoria e escolher quem enxerga — canais criados nela herdam.",
    depende:
      "permissão em categoria no protocolo — `Category` só tem id, título e canais",
  },

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
  qualidadeDaTransmissao: {
    superficie: "Palco de transmissão",
    faz: "Trocar resolução e taxa de quadros sem parar de transmitir.",
    depende:
      "encoding dinâmico — `setScreenShareEnabled` só aceita as constraints na PUBLICAÇÃO, e trocá-las hoje é parar e recomeçar",
  },

  /* ---------------------------------------------------- criar canal */
  /*
    ⚠ **Os dois tipos que o Stoat não tem.** `forum` e uma galeria de mídia dão
    ZERO ocorrências no schema — não são campos que faltam, são conceitos que
    não existem. O design desenha os quatro tipos no mesmo painel, e a regra
    deste projeto é construir 1:1 e registrar: clicar diz o que fará, em vez
    de o tipo sumir da lista e ninguém saber que ele foi pensado.
  */
  canalDeForum: {
    superficie: "Criar canal",
    faz: "Criar um canal onde cada assunto é um post com respostas próprias.",
    depende: "fórum no protocolo — nem tipo de canal, nem campo, nem evento",
  },
  canalDeMidia: {
    superficie: "Criar canal",
    faz: "Criar uma galeria de imagens e vídeos, com legenda por item.",
    depende: "canal de mídia no protocolo",
  },

  /* ------------------------------------------------- criar servidor */

  /* ------------------------------------------- acesso e segurança do servidor */
  /*
    ⚠ **As seis são a MESMA causa, e ela é maior que "falta a rota": o Stoat
    não tem o CONCEITO.** Medido no `OpenAPI.json` de `stoat-api@0.14.0`:
    `verification_level`, `join_request`, `approval`, `explicit_content_filter`
    e `dm_settings` dão ZERO ocorrências, e as rotas de `/servers/{id}` são só
    membros, banimentos, convites, cargos, permissões, emojis e auditoria.

    Ficam separadas em vez de virar uma entrada só porque destravam em ORDEM
    diferente: requisito de conta e nível de verificação são um campo em
    `DataEditServer`; fila de aprovação é um recurso novo com rota, evento e
    tela de moderação atrás.

    ⚠ **E nenhuma delas vira store de cliente**, ao contrário de
    `privacidadeDoServidor.ts`. Aquela é a decisão de UMA pessoa sobre o que
    ela recebe, e é o cliente dela que a aplica. Estas são política do
    SERVIDOR: guardá-las nesta máquina daria uma regra que só quem a marcou
    enxerga e que servidor nenhum aplica — o mesmo defeito que manteve `criar
    enquete` como pendência.
  */
  modoDeEntrada: {
    superficie: "Configurações do servidor · Acesso",
    faz: "Escolher entre entrada por convite, aprovação manual e servidor fechado.",
    depende: "modo de entrada no protocolo — não há campo em `DataEditServer`",
  },
  filaDeAprovacao: {
    superficie: "Configurações do servidor · Acesso",
    faz: "Revisar, aprovar e recusar quem pediu para entrar.",
    depende:
      "pedido de entrada no protocolo — rota, evento e o próprio conceito não existem",
  },
  requisitosDeEntrada: {
    superficie: "Configurações do servidor · Acesso",
    faz: "Exigir email ou telefone verificado antes de deixar entrar.",
    depende: "requisito de conta no protocolo",
  },
  nivelDeVerificacao: {
    superficie: "Configurações do servidor · Segurança",
    faz: "Escalonar o que uma conta nova precisa cumprir antes de falar.",
    depende: "`verification_level` no protocolo",
  },
  filtroDeMidia: {
    superficie: "Configurações do servidor · Segurança",
    faz: "Analisar a mídia enviada e borrar o que for explícito.",
    depende:
      "`explicit_content_filter` no protocolo + um analisador no lado do servidor",
  },
  contatoEntreMembros: {
    superficie: "Configurações do servidor · Segurança",
    faz: "Limitar DM entre membros e filtrar convites de terceiros.",
    depende: "política de DM por servidor no protocolo",
  },
  /*
    ⚠ **Esta é a única do grupo cuja auditoria JÁ EXISTE** —
    `/servers/{target}/audit_logs` está no schema. O que falta são as três
    escritas que ela dispararia: pausar convite (só existe revogar), silenciar
    @everyone e congelar entrada. Nenhuma tem rota.
  */
  emergencia: {
    superficie: "Configurações do servidor · Segurança",
    faz: "Pausar convites, silenciar @everyone e congelar entradas por 1 hora.",
    depende:
      "pausar convite, silenciar cargo e congelar entrada — três escritas que o protocolo não tem",
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
  modoLento: {
    superficie: "Configurações do canal",
    faz: "Limitar quanto tempo cada pessoa espera entre uma mensagem e outra.",
    depende: "`slowmode` em `DataEditChannel` — hoje é só leitura",
  },
  canalDeSpoiler: {
    superficie: "Configurações do canal",
    faz: "Entrar com toda a mídia borrada, com clique para revelar.",
    depende: "conceito de spoiler no protocolo — não há campo nem evento",
  },
  bitrateDeVoz: {
    superficie: "Configurações do canal",
    faz: "Escolher a qualidade de áudio da sala.",
    depende: "bitrate no protocolo + repasse ao LiveKit",
  },
  regiaoDeVoz: {
    superficie: "Configurações do canal",
    faz: "Fixar a região do servidor de voz, em vez de deixar automática.",
    depende: "região de voz no protocolo",
  },
  modoDeVideo: {
    superficie: "Configurações do canal",
    faz: "Fixar resolução e taxa de quadros do vídeo.",
    depende: "modo de vídeo no protocolo + repasse ao LiveKit",
  },
  sincronizarComCategoria: {
    superficie: "Permissões do canal",
    faz: "Copiar as permissões da categoria para este canal e manter em sincronia.",
    depende: "categoria não tem permissões no protocolo — ela é só um array de IDs",
  },
  pausarConvites: {
    superficie: "Convites do canal",
    faz: "Suspender todos os convites do canal sem apagá-los.",
    depende: "pausar convite no protocolo — só existe revogar",
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
 * sabia que faltavam. As demais divergências já tinham razão escrita (Fórum e
 * reação SUPER dependem de fork do serviço `api`; modo compacto, registro de
 * auditoria e os três primitivos de campo estão no `CLAUDE.md`).
 *
 * `referencia` é o arquivo do projeto de referência, para a próxima pessoa não
 * ter de procurar o desenho.
 */
export const SUPERFICIES_AUSENTES = {
  /* ------------------------------------------------------------- voz */
  /*
    ⚠ **As duas primeiras são o par que torna a voz 1:1 INALCANÇÁVEL, e não
    incompleta.** Não é uma tela faltando no fim de um fluxo: sem a chamada
    recebida não há como ATENDER, então nenhuma ligação de DM chega ao outro
    lado. É a de maior valor das nove.

    E ela é a única que não teria controle nem depois de pronta: quem chama é
    a outra pessoa. Por isso não há como registrá-la em `PENDENCIAS` nem
    hoje nem nunca — ela nasce de um evento, não de um clique.
  */
  chamadaRecebida: {
    superficie: "Sobreposta ao app, e em tela cheia",
    faz: "Anunciar quem está ligando, com atender e recusar.",
    depende: "nada no protocolo — é trabalho de tela mais o evento do LiveKit",
    referencia: "components/voice/IncomingCall.tsx",
  },
  chamadaDireta: {
    superficie: "Coluna de conteúdo, numa DM",
    faz: "A chamada de duas pessoas: vídeo grande, o seu no canto, controles.",
    depende: "a chamada recebida, que é quem abre esta — e um botão de ligar na DM",
    referencia: "components/voice/CallStage.tsx · DirectCallStage",
  },
  chatDoCanalDeVoz: {
    superficie: "Painel dentro da sala de voz",
    faz: "O chat embutido do canal de voz, com entradas e saídas como eventos do sistema.",
    depende: "decidir se é painel do shell ou coluna dentro da sala",
    referencia: "components/voice/VoiceChannelChat.tsx",
  },
  menuDoUsuarioEmVoz: {
    superficie: "Botão direito num participante da sala",
    faz: "Volume individual, silenciar só para mim, mover de canal, mudo de servidor.",
    depende:
      "a tabela de cargos resolvida para a hierarquia, e `ServerMember.edit({voice_channel})` para mover",
    referencia: "components/voice/VoiceUserMenu.tsx",
  },

  /* --------------------------------------------------------- eventos */
  /*
    ⚠ **Três arquivos da referência e zero rastro aqui** — a maior ausência
    das nove em volume. O protocolo do Stoat não tem evento agendado, então
    ela cai na mesma família do Fórum: entra junto com o fork do serviço
    `api`. A diferença é que o Fórum já estava registrado e esta não estava.
  */
  eventosDoServidor: {
    superficie: "Destino próprio do servidor, com cartão e assistente",
    faz: "Agendar, listar e confirmar presença em eventos do servidor.",
    depende: "evento agendado no protocolo — não há tipo, campo nem rota",
    referencia:
      "screens/events/EventsScreen.tsx · CreateEventWizard.tsx · components/events/EventCard.tsx",
  },

  /* ----------------------------------------------------------- casa */
  solicitacoesDeMensagem: {
    superficie: "Aba na tela de pessoas",
    faz: "Separar a DM de quem você não conhece, para aceitar ou recusar antes de ler.",
    depende:
      "o protocolo não separa — toda DM entra igual, então a fila é conceito de cliente",
    referencia: "components/directs/MessageRequestsPanel.tsx",
  },

  /* -------------------------------------------------- notificações */
  duracaoDoSilencio: {
    superficie: "Submenu do silenciar, no menu do canal e do servidor",
    faz: "Silenciar por 15 minutos, 1 hora, 8 horas, 24 horas ou até eu reativar.",
    depende:
      "o SDK DELEGA `muted` ao cliente, então o prazo também é nosso — falta o store com relógio",
    referencia: "components/navigation/MuteDurationSubmenu.tsx",
  },
  notificacoesPorServidorECanal: {
    superficie: "Modal do sino, no servidor e no canal",
    faz: "Escolher entre tudo, só menções ou nada, por servidor e por canal.",
    depende:
      "distinto de `permissaoDeNotificacao`, que é o pedido ao navegador — este é a REGRA",
    referencia: "components/notifications/NotificationModals.tsx",
  },

  /* --------------------------------------------------------- casca */
  /*
    ⚠ **A opção existe em Configurações · Desktop; o MENU não.** É a mesma
    distinção do overlay de jogo: o que falta mora no processo main do
    Electron, não no cliente — e por isso nenhum controle do app poderia
    alcançá-lo.
  */
  menuDaBandeja: {
    superficie: "Ícone da bandeja do sistema",
    faz: "Abrir, silenciar e sair pelo ícone ao lado do relógio.",
    depende: "`Tray` no processo main da casca — é trabalho de Electron, não de cliente",
    referencia: "components/desktop/TrayMenu.tsx",
  },
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
