import { plural } from "nucleo/lib/plural";

export const salas = {
  titulo: "Salas",
  entrarNaSala: "Entrar na sala",
  sairDaSala: "Sair da sala",
  vazia: "Ninguém está na sala agora.",
  participantes: (n: number) => plural(n, "participante", "participantes"),
  naSala: (n: number) => plural(n, "pessoa na sala", "pessoas na sala"),
  criarSala: "Criar sala",
} as const;
