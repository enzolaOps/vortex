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
  emoji: {
    superficie: "Composer",
    faz: "Seletor de emoji com recentes, frequentes e busca.",
    depende: "seletor de emoji + emojis do servidor",
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
  enquete: {
    superficie: "Composer",
    faz: "Criar uma enquete com opções e voto.",
    depende: "enquete no protocolo + linha de enquete na timeline",
  },
  mensagemDeVoz: {
    superficie: "Composer",
    faz: "Gravar e enviar mensagem de voz.",
    depende: "gravação de áudio + upload",
  },

  /* ------------------------------------------------------- linha de mensagem */
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
  caixaDeEntrada: {
    superficie: "Cabeçalho do canal",
    faz: "Menções, não lidos e tópicos seguidos num painel só.",
    depende: "painel `caixaDeEntrada` em `PainelId`",
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
