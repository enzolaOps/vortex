import { plural } from "nucleo/lib/plural";

export const chat = {
  mensagem: "Mensagem",
  campoDeMensagem: "Escrever mensagem",
  placeholderDoCampo: (canal: string) => `Conversar em ${canal}`,
  placeholderDasNotas: "Escreva uma nota",
  /** DM e grupo: o campo fala com pessoas, não com um canal. */
  placeholderDaConversa: (nome: string) => `Conversar com ${nome}`,
  enviar: "Enviar",
  responder: "Responder",
  anexar: "Anexar arquivo",
  semMensagens: "Ainda não há mensagens aqui.",
  falhaNoEnvio: "Não foi possível enviar a mensagem.",
  novasMensagens: (n: number) => plural(n, "nova mensagem", "novas mensagens"),
  digitando: (nome: string) => `${nome} está digitando…`,
  editada: "editada",
  listaDeMensagens: "Mensagens",
  autorDesconhecido: "Alguém",
  eventoDoCanal: "Aconteceu algo no canal.",
  comecoDoCanal: "Este é o começo do canal.",

  /* Histórico */
  carregandoMensagens: "Carregando mensagens…",
  carregandoAnteriores: "Carregando mensagens anteriores…",
  falhaAoCarregar: "Não foi possível carregar as mensagens.",
  tentarDeNovo: "Tentar de novo",
  comecoDoCanalDe: (nome: string) => `Este é o começo de #${nome}`,
  comecoDaSala: (nome: string) => `Este é o começo do chat de ${nome}`,
  comecoDaConversa: (nome: string) => `Este é o começo da sua conversa com ${nome}`,
  comecoDasNotas: "Este é o começo das suas notas",
  dicaDoComeco: "Escreva a primeira mensagem logo abaixo.",
  dicaDoComecoSemPermissao: "Quem pode escrever aqui ainda não escreveu nada.",

  /* Leitura como posição */
  novas: "Novas mensagens",
  irParaNaoLida: "Ir para a primeira não lida",
  proximaMencao: "Próxima menção",
  irParaOFim: "Ir para as mensagens recentes",

  /* Composer */
  semPermissaoParaEscrever: "Você não pode escrever neste canal.",
  semPermissaoNaSala: "Você não pode escrever no chat desta sala.",
  respondendoA: (nome: string) => `Respondendo a ${nome}`,
  cancelarResposta: "Cancelar resposta",
  respostaIndisponivel: "Mensagem indisponível",
  removerAnexo: (nome: string) => `Remover ${nome}`,
  anexosSelecionados: "Arquivos para enviar",
  arquivoGrande: (nome: string) => `${nome} é grande demais para enviar.`,
  limiteDeEnvio: (teto: string) => `O limite aqui é ${teto}.`,
  semConexao: "Sem conexão. As mensagens saem quando voltar.",
  naFila: (n: number) => plural(n, "mensagem na fila", "mensagens na fila"),
  negrito: "Negrito",
  italico: "Itálico",

  /* Estados de envio */
  enviando: "Enviando…",
  naFilaSemConexao: "Na fila · sem conexão",
  naoEnviada: "Não foi enviada.",
  reenviar: "Reenviar",
  descartar: "Descartar",
  enviandoArquivo: (porcento: number) => `Enviando arquivo… ${porcento}%`,
  cancelarEnvio: "Cancelar envio",

  /* Ações da mensagem */
  reagirComEmoji: (emoji: string) => `Reagir com ${emoji}`,
  reagirRotulo: "Reagir",
  copiarTexto: "Copiar texto",
  textoCopiado: "Texto copiado.",
  editar: "Editar",
  apagar: "Apagar",
  fixar: "Fixar",
  desafixar: "Desafixar",
  fixada: "Fixada",
  marcarNaoLida: "Marcar como não lida",
  editandoMensagem: "Editando mensagem",
  salvarEdicao: "Salvar",
  cancelarEdicao: "Cancelar",
  dicaDeEdicao: "Esc cancela · Enter salva",
  falhaAoEditar: "Não foi possível salvar a edição.",
  confirmarApagarTitulo: "Apagar mensagem?",
  confirmarApagarTexto: "A mensagem some para todo mundo e não dá para desfazer.",
  falhaAoApagar: "Não foi possível apagar a mensagem.",
  menuDaMensagem: "Ações da mensagem",

  /* Anexos */
  baixar: "Baixar",
  abrirAnexo: (nome: string) => `Abrir ${nome}`,
} as const;
