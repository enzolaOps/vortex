import { plural } from "nucleo/lib/plural";

/**
 * Textos de uso geral. Chaves que começam com `sinal` são rótulos em caixa alta
 * (badge, estado ao vivo) e escapam do teste de caixa de frase.
 */
export const comum = {
  nomeDoApp: "Vortex",
  fechar: "Fechar",
  cancelar: "Cancelar",
  confirmar: "Confirmar",
  salvar: "Salvar",
  voltar: "Voltar",
  copiar: "Copiar",
  copiado: "Copiado",
  editar: "Editar",
  apagar: "Apagar",
  buscar: "Buscar",
  maisOpcoes: "Mais opções",
  carregando: "Carregando",
  tentarDeNovo: "Tentar de novo",
  notificacoes: "Notificações",
  dispensarAviso: "Dispensar aviso",
  erroGenerico: "Algo deu errado. Tente de novo em instantes.",
  semPermissao: "Você não tem permissão para fazer isso.",
  sinalAoVivo: "AO VIVO",
  pessoas: (n: number) => plural(n, "pessoa", "pessoas"),
  repeticoes: (n: number) => `${n} vezes`,
} as const;
