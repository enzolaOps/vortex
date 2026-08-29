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
  soundboard: {
    superficie: "Composer",
    faz: "Painel de efeitos sonoros do servidor.",
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
  reordenarResposta: {
    superficie: "Criar enquete",
    faz: "Arrastar uma resposta para mudar a ordem.",
    depende: "arrastar-e-soltar — hoje o app não tem nenhum",
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
  buscaNoCanal: {
    superficie: "Cabeçalho do canal",
    faz: "Buscar mensagens no canal por autor, data e tipo de anexo.",
    depende: "`Channel.search` + painel de resultados",
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
