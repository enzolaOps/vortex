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


  /* ------------------------------------------------------------- grupo */
  /*
    ⚠ **Três pendências num painel de CINCO ações, e as outras quatro são
    escrita de protocolo de verdade** — renomear, remover, transferir e sair
    chamam o servidor. O que sobra depende de coisas fora do painel.
  */
  iconeDeGrupo: {
    superficie: "Gerenciar grupo",
    faz: "Trocar a imagem do grupo.",
    depende: "upload ao servidor de mídia (autumn) — a mesma de `anexar`",
  },
  adicionarAoGrupo: {
    superficie: "Gerenciar grupo",
    faz: "Chamar mais alguém para o grupo.",
    depende:
      "o seletor de pessoas do `NovoGrupo` reaproveitado com os atuais já fora da lista — `addMember` já existe no adapter",
  },
  notificacoesDoGrupo: {
    superficie: "Gerenciar grupo",
    faz: "Escolher o que notifica neste grupo, sem mexer no resto.",
    depende:
      "preferência POR CANAL — hoje `store/notificacoes.ts` guarda só o padrão global",
  },

  /* ------------------------------------------------------------ avançado */
  /*
    ⚠ **Só UM pendente em Avançado, e é o menor dos dois controles.** O modo
    desenvolvedor FUNCIONA — ele acrescenta "Copiar ID" aos menus, e ID é dado
    que o app já tem na mão. O overlay é que precisa de instrumento.
  */
  overlayDeDebug: {
    superficie: "Configurações · Avançado",
    faz: "Mostrar FPS, latência e re-renders num canto da janela, no app inteiro.",
    depende:
      "o medidor do arnês (`dev/`) fora dele — hoje ele mora na tela de teste e mede o firehose, não o uso real",
  },

  /* --------------------------------------------------------- privacidade */
  exportarDados: {
    superficie: "Configurações · Privacidade",
    faz: "Pedir uma cópia de tudo que a conta guarda, por e-mail.",
    depende: "exportação de dados no protocolo — não há rota, nem no upstream",
  },

  /* ------------------------------------------------------- voz e vídeo */
  /*
    ⚠ **Cinco pendências e NENHUMA delas é "a tela não existe".** Todas as
    preferências desta seção são guardadas, e quatro chegam ao WebRTC de
    verdade (`constraintsDeAudio` em `store/preferenciasDeVoz.ts`). O que está
    aqui é o que precisa de algo que o navegador ou o sistema não dão.
  */
  testeDeMicrofone: {
    superficie: "Configurações · Voz e vídeo",
    faz: "Gravar 5 s do seu microfone e tocar de volta.",
    depende: "`MediaRecorder` + um medidor ao vivo — o mesmo trabalho de `mensagemDeVoz`",
  },
  medidorDeEntrada: {
    superficie: "Configurações · Voz e vídeo",
    faz: "Mostrar o nível do seu microfone em tempo real.",
    depende: "`AudioContext` com analisador sobre um stream aberto só para isto",
  },
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
  previaDaCamera: {
    superficie: "Configurações · Voz e vídeo",
    faz: "Mostrar o que a câmera está vendo, antes de entrar na chamada.",
    depende: "`getUserMedia` de vídeo fora do motor — hoje a câmera só abre em chamada",
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
  anexar: {
    superficie: "Composer",
    faz: "Escolher arquivos para enviar junto com a mensagem.",
    depende: "upload ao servidor de mídia (autumn)",
  },
  /*
    ⚠ **O seletor de emoji EXISTE e funciona.** O que sobrou pendente é o que
    ele não alcança sozinho, e os três estão separados de propósito: um é
    dado, um é dado do servidor, um é modificador de glifo.
  */
  emoji: {
    superficie: "Reação",
    faz: "Escolher um emoji para reagir a esta mensagem.",
    depende: "o seletor ancorado ao chip — hoje ele só abre pelo composer",
  },
  emojiCompleto: {
    superficie: "Seletor de emoji",
    faz: "Oferecer os ~3.800 emojis do Unicode com nome e alias.",
    depende: "dataset de emoji (`emojibase`) carregado sob demanda",
  },
  emojiDoServidor: {
    superficie: "Seletor de emoji",
    faz: "Usar os emojis personalizados deste servidor.",
    depende: "servidor de mídia (autumn) servindo os arquivos",
  },
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
  formaDeOndaReal: {
    superficie: "Mensagem de voz",
    faz: "Desenhar as amplitudes REAIS do áudio na forma de onda.",
    depende: "`decodeAudioData` fora do caminho de render + cache por anexo",
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
  canaisOcultos: {
    superficie: "Coluna de canais",
    faz: "Mostrar os canais que você escondeu ou silenciou.",
    depende: "`Mostrar todos os canais` em configuração de usuário",
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
  pastaDeServidor: {
    superficie: "Rail",
    faz: "Agrupar servidores em pasta, com nome e cor.",
    depende: "ordenação de servidor em configuração de usuário",
  },

  /* ------------------------------------------- ações da mensagem (fase 5) */
  topicoDaMensagem: {
    superficie: "Ações da mensagem",
    faz: "Abrir um tópico a partir desta mensagem.",
    depende: "threads no protocolo",
  },
  responderSemMencionar: {
    superficie: "Menu da mensagem",
    faz: "Responder sem que a pessoa receba uma menção.",
    depende: "corpo de envio com `replies:[{ id, mention }]` — fase 6",
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
  perfilCompleto: {
    superficie: "Menu do usuário",
    faz: "Abrir o perfil inteiro desta pessoa, com bio, cargos e histórico.",
    depende: "página de perfil — o `HoverCard` de hoje é o resumo, não a página",
  },
  conversaDireta: {
    superficie: "Menu do usuário",
    faz: "Abrir (ou criar) a conversa direta com esta pessoa.",
    depende: "`User.openDM()` + rota para a conversa recém-criada",
  },
  ligar: {
    superficie: "Menu do usuário",
    faz: "Começar uma chamada direta com esta pessoa.",
    depende: "chamada em DM (`Channel.joinCall` fora de canal de servidor)",
  },
  cargosDoMembro: {
    superficie: "Menu do usuário",
    faz: "Dar e tirar cargos desta pessoa sem sair da conversa.",
    depende: "`ServerMember.edit({ roles })` + submenu de cargos",
  },
  alterarApelido: {
    superficie: "Menu do usuário",
    faz: "Trocar o apelido desta pessoa neste servidor.",
    depende: "`ServerMember.edit({ nickname })` + modal de campo único",
  },
  notaPrivada: {
    superficie: "Menu do usuário",
    faz: "Guardar uma anotação sobre esta pessoa, visível só para você.",
    depende: "notas de usuário — conceito de cliente, sem store ainda",
  },
  moverParaCanal: {
    superficie: "Menu do usuário",
    faz: "Puxar esta pessoa para outro canal de voz.",
    depende: "`ServerMember.edit({ voice_channel })` + submenu de canais",
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
  bannerDeSincronia: {
    superficie: "Permissões do canal",
    faz: "Avisar quando as permissões do canal divergem da categoria.",
    depende: "categoria não tem permissões no protocolo — não há com o que comparar",
  },
  overrideDeMembro: {
    superficie: "Permissões do canal",
    faz: "Dar ou tirar permissão de UMA pessoa neste canal, sem mexer no cargo.",
    depende:
      "`setPermissions` do protocolo aceita cargo, não membro — em canal de servidor só há override por cargo",
  },
  silenciarUsuario: {
    superficie: "Menu do usuário",
    faz: "Esconder as mensagens desta pessoa só para você.",
    depende: "lista de silenciados — conceito de cliente, sem store ainda",
  },
} as const satisfies Record<
  string,
  { superficie: string; faz: string; depende: string }
>;

export type PendenciaId = keyof typeof PENDENCIAS;

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
