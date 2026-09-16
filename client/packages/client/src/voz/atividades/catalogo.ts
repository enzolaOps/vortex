import type { PendenciaId } from "../../pendente/pendencias";

/**
 * O catálogo de atividades — os quatro itens do `ActivitiesModal` da
 * referência, com os textos do design.
 *
 * ⚠ **Uma funciona; três são desenho registrado.** O que existe de ponta a
 * ponta é a INFRAESTRUTURA (sessão por canal, registro, fluxo de operações,
 * host isolado) e o quadro branco em cima dela. As outras três precisam cada
 * uma do seu host — ver `pendente/pendencias.ts` —, e nenhuma precisa de
 * servidor novo: o servidor não sabe o que uma atividade é.
 *
 * ⚠ **O Xadrez do design aparece BLOQUEADO "por falta da permissão Usar
 * atividades", e aqui não.** Essa permissão não existe no protocolo; mostrar o
 * cadeado com esse motivo seria afirmar uma regra que o servidor não aplica.
 */
export type Atividade = {
  readonly id: string;
  readonly nome: string;
  readonly capacidade: string;
  readonly destaque: boolean;
  /** O host embutido. Sem ele, a atividade é pendência. */
  readonly host:
    | { readonly tipo: "pronto"; readonly caminho: string }
    | { readonly tipo: "pendente"; readonly pendencia: PendenciaId };
};

export const ATIVIDADES: readonly Atividade[] = [
  {
    id: "quadro",
    nome: "Quadro branco",
    capacidade: "até 16 pessoas · sem instalação",
    destaque: true,
    host: { tipo: "pronto", caminho: "/atividades/quadro.html" },
  },
  {
    id: "assistir-junto",
    nome: "Assistir junto",
    capacidade: "até 10 pessoas",
    destaque: false,
    host: { tipo: "pendente", pendencia: "atividadeAssistirJunto" },
  },
  {
    id: "poker",
    nome: "Poker",
    capacidade: "2 a 8 pessoas",
    destaque: false,
    host: { tipo: "pendente", pendencia: "atividadePoker" },
  },
  {
    id: "xadrez",
    nome: "Xadrez",
    capacidade: "2 pessoas",
    destaque: false,
    host: { tipo: "pendente", pendencia: "atividadeXadrez" },
  },
];

export function atividadePorId(id: string): Atividade | undefined {
  return ATIVIDADES.find((a) => a.id === id);
}
