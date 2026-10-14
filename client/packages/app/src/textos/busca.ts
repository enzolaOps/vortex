import { plural } from "nucleo/lib/plural";

/** Textos da busca no canal: botão do cabeçalho, painel, filtros, estados e avisos. */
export const busca = {
  /** O botão do cabeçalho (liga e desliga o painel). */
  botao: "Buscar no canal",
  painel: "Busca no canal",
  titulo: "Buscar",
  fechar: "Fechar a busca",
  fecharComAtalho: "Fechar a busca com Esc",
  campo: "Buscar mensagens",
  placeholder: "Buscar neste canal",
  dicaDoAtalho: (atalho: string) => `Atalho: ${atalho}`,

  filtros: {
    mostrar: "Filtros",
    de: "De",
    dePlaceholder: "Primeiro nome",
    depoisDe: "Depois de",
    antesDe: "Antes de",
    tem: "Tem",
    link: "Link",
    anexo: "Anexo",
    imagem: "Imagem",
    video: "Vídeo",
    audio: "Áudio",
    limpar: "Limpar filtros",
  },

  ficha: {
    rotulo: "Filtros ativos",
    de: (nome: string) => `De ${nome}`,
    antes: (data: string) => `Antes de ${data}`,
    depois: (data: string) => `Depois de ${data}`,
    durante: (data: string) => `Em ${data}`,
    tem: {
      arquivo: "Com anexo",
      imagem: "Com imagem",
      video: "Com vídeo",
      audio: "Com áudio",
      link: "Com link",
    },
    invalida: (bruto: string) => `Filtro não entendido: ${bruto}`,
    remover: (ficha: string) => `Remover filtro: ${ficha}`,
  },

  resultados: {
    rotulo: "Resultados da busca",
    contagem: (n: number) => plural(n, "resultado", "resultados"),
    contagemTemMais: (n: number) => `${plural(n, "resultado", "resultados")} ou mais`,
    carregarMais: "Carregar mais resultados",
    carregandoMais: "Carregando mais resultados",
    anexo: (nome: string) => `Anexo: ${nome}`,
    semTexto: "Mensagem sem texto",
    abrir: (autor: string) => `Ir até a mensagem de ${autor}`,
    indo: "Indo até a mensagem…",
  },

  estados: {
    convite: "Digite para buscar nas mensagens deste canal.",
    conviteDica: "Você também pode filtrar por pessoa, data ou tipo de conteúdo.",
    buscando: "Buscando…",
    vazio: (consulta: string) => `Nada encontrado para ${consulta}.`,
    vazioDica: "Tente outras palavras ou tire algum filtro.",
    erro: "Não foi possível buscar agora.",
    tentarDeNovo: "Tentar de novo",
    semConexao: "Sem conexão. A busca volta quando a internet voltar.",
    filtroInvalido: (bruto: string) => `Não entendi o filtro ${bruto}.`,
    filtroInvalidoDica: "Use um nome, uma data ou um destes tipos: link, anexo, imagem, vídeo ou áudio.",
    autorDesconhecido: (nome: string) => `Não achei ninguém chamado ${nome} por aqui.`,
    autorDesconhecidoDica: "A busca por pessoa procura entre quem já apareceu nesta sessão.",
  },

  salto: {
    ausente: "Essa mensagem não está mais no canal.",
    falhou: "Não foi possível chegar até a mensagem. Tente de novo.",
  },
} as const;
