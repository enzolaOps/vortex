import { plural } from "nucleo/lib/plural";

/** Textos do painel de mensagens fixadas: botão do cabeçalho, painel, estados e avisos. */
export const fixados = {
  /** O botão do cabeçalho (liga e desliga o painel). */
  botao: "Mensagens fixadas",
  painel: "Mensagens fixadas do canal",
  titulo: "Fixadas",
  fechar: "Fechar as fixadas",
  fecharComAtalho: "Fechar as fixadas com Esc",
  contagemDoBotao: (n: number, temMais: boolean) => `${String(n)}${temMais ? "+" : ""}`,

  lista: {
    rotulo: "Mensagens fixadas",
    contagem: (n: number, temMais: boolean) =>
      temMais ? `${plural(n, "fixada", "fixadas")} ou mais` : plural(n, "fixada", "fixadas"),
    ir: (autor: string) => `Ir até a mensagem fixada de ${autor}`,
    semTexto: "Mensagem sem texto",
    anexo: (nome: string, total: number) =>
      total > 1 ? `Anexo: ${nome} e mais ${String(total - 1)}` : `Anexo: ${nome}`,
    indo: "Indo até a mensagem…",
    desafixar: "Desafixar",
    desafixarDe: (autor: string) => `Desafixar a mensagem de ${autor}`,
    carregarMais: "Carregar mais fixadas",
    carregandoMais: "Carregando mais fixadas",
  },

  estados: {
    carregando: "Carregando as fixadas…",
    vazio: "Nenhuma mensagem fixada neste canal",
    vazioDica: "Fixe uma mensagem pelo menu dela para ela ficar aqui, à mão.",
    erro: "Não foi possível carregar as fixadas.",
    tentarDeNovo: "Tentar de novo",
    semConexao: "Sem conexão. As fixadas voltam quando a internet voltar.",
  },

  salto: {
    ausente: "Essa mensagem não está mais no canal.",
    falhou: "Não foi possível chegar até a mensagem. Tente de novo.",
  },
} as const;
