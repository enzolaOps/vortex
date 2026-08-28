/**
 * O modo edição: ligado/desligado, e o desfazer.
 *
 * "Preview ao vivo, sem aplicar separado" e "sair sem salvar reverte" parecem
 * duas frases da referência e são uma coisa só: como não há botão de aplicar,
 * TODA mudança já está valendo — então cancelar precisa de um retrato tirado
 * na entrada, e não de um diff acumulado.
 *
 * O retrato inclui o bruto de origem, não só o preset: cancelar uma sessão de
 * edição sobre um preset de versão futura tem que devolver também as chaves
 * que este código não entende. Um desfazer que preserva o que entende e perde
 * o que não entende é pior que não ter desfazer, porque o dano fica invisível.
 */
import type { Preset } from "../preset/schema";
import { aplicarPreset, lerBruto, lerLayout } from "./layout";

type Ouvinte = () => void;

type Retrato = { preset: Preset; bruto: Record<string, unknown> };

const ouvintes = new Set<Ouvinte>();

let ativo = false;
let retrato: Retrato | null = null;

function emitir() {
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarEdicao(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** Primitivo: `useSyncExternalStore` compara por valor e nunca entra em laço. */
export function lerEdicao(): boolean {
  return ativo;
}

export function entrar(): void {
  if (ativo) return;
  retrato = { preset: lerLayout(), bruto: lerBruto() };
  ativo = true;
  emitir();
}

/**
 * Sai do modo edição.
 *
 * `salvar: false` devolve o retrato da entrada. `salvar: true` só desliga o
 * modo — não há nada a aplicar, porque tudo já estava valendo.
 */
export function sair(salvar: boolean): void {
  if (!ativo) return;
  const anterior = retrato;
  ativo = false;
  retrato = null;
  if (!salvar && anterior) aplicarPreset(anterior.preset, anterior.bruto);
  emitir();
}

/** O layout tinha mudado desde que o modo abriu? Decide se "cancelar" descarta algo. */
export function temMudanca(): boolean {
  return retrato !== null && retrato.preset !== lerLayout();
}
