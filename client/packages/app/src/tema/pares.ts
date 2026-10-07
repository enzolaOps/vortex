import type { NomeadoPar, SuperficieId } from "./contraste";

/**
 * Os pares que todo tema precisa passar: a tabela "Contraste" do README do design
 * system, porta a porta. Mínimos: 4,5:1 para texto; 3:1 para texto grande, ícone
 * funcional, borda de controle e anel de foco. NÃO existe lista de exceções, aqui
 * nem em lugar nenhum: par que reprova é tema que reprova.
 */

const LEITURA: readonly SuperficieId[] = [
  "panel",
  "reading",
  "overlay",
  "overlay/panel",
  "overlay/reading",
  "base",
];
const PRESENCA: readonly SuperficieId[] = ["solid", "panel", "reading", "overlay"];
const SELECIONADO: readonly SuperficieId[] = ["panel+selected", "reading+selected"];

const texto = (fg: string): NomeadoPar => ({
  nome: `${fg} (texto)`,
  par: { fg, sobre: LEITURA, minimo: 4.5 },
});

const sobrePreenchimento = (fg: string, fundoPapel: string): NomeadoPar => ({
  nome: `${fg} / ${fundoPapel}`,
  par: { fg, fundoPapel, minimo: 4.5 },
});

export const PARES: readonly NomeadoPar[] = [
  ...["text-1", "text-2", "text-3", "text-4"].map(texto),
  ...[
    "accent",
    "accent-hover",
    "live",
    "speaking",
    "danger",
    "warning",
    "success",
    "info",
    "mention",
    "quality-good",
    "quality-fair",
    "quality-poor",
    "muted",
  ].map(texto),

  { nome: "unread (indicador)", par: { fg: "unread", sobre: LEITURA, minimo: 3 } },
  { nome: "muted (ícone)", par: { fg: "muted", sobre: LEITURA, minimo: 3 } },
  { nome: "deafened (ícone)", par: { fg: "deafened", sobre: LEITURA, minimo: 3 } },
  ...["presence-online", "presence-idle", "presence-dnd", "presence-offline"].map(
    (fg): NomeadoPar => ({
      nome: `${fg} (selo)`,
      par: { fg, sobre: PRESENCA, minimo: 3 },
    }),
  ),
  { nome: "focus-ring", par: { fg: "focus-ring", sobre: [...LEITURA, "stage"], minimo: 3 } },
  {
    nome: "border-strong (borda de controle)",
    par: { fg: "border-strong", sobre: LEITURA, minimo: 3 },
  },
  { nome: "accent em stage (borda/ícone)", par: { fg: "accent", sobre: ["stage"], minimo: 3 } },
  { nome: "live em stage (borda)", par: { fg: "live", sobre: ["stage"], minimo: 3 } },

  // Texto sobre preenchimento sólido.
  sobrePreenchimento("text-on-accent", "accent"),
  sobrePreenchimento("text-on-accent", "accent-hover"),
  sobrePreenchimento("text-on-accent", "accent-press"),
  sobrePreenchimento("text-on-live", "live"),
  sobrePreenchimento("text-on-danger", "danger"),
  sobrePreenchimento("text-on-mention", "mention"),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => sobrePreenchimento("#ffffff", `avatar-${n}`)),

  // Item selecionado: texto sobre o painel com o véu de seleção por cima.
  { nome: "text-1 em state-selected", par: { fg: "text-1", sobre: SELECIONADO, minimo: 4.5 } },
  { nome: "text-2 em state-selected", par: { fg: "text-2", sobre: SELECIONADO, minimo: 4.5 } },
  {
    nome: "accent (texto) em state-selected",
    par: { fg: "accent", sobre: SELECIONADO, minimo: 4.5 },
  },
];
