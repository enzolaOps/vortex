export const admin = {
  servidor: "Servidor",
  canais: "Canais",
  convites: "Convites",
  cargos: "Cargos",
  moderacao: "Moderação",
  banir: "Banir",
  expulsar: "Expulsar",
  criarConvite: "Criar convite",
  confirmarApagar: (nome: string) => `Apagar ${nome}? Isso não pode ser desfeito.`,
} as const;
