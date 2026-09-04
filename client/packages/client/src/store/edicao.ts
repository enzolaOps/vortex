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

export type Retrato = { preset: Preset; bruto: Record<string, unknown> };

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

/**
 * O layout tinha mudado desde que o modo abriu? Decide a palavra do botão.
 *
 * ⚠ **Recebe o estado atual por PARÂMETRO, e isso não é estilo.** A versão sem
 * argumentos lia o store por dentro, e o React Compiler a tratava como pura:
 * `temMudanca() ? "descartar" : "fechar"` não depende de nada que ele veja
 * mudar, então o resultado ficava memoizado do primeiro render. Medido no
 * navegador: com o painel do fim escondido e a trilha já em `0px`, o botão
 * ainda dizia "fechar" — e clicar nele descartava de verdade e emitia o toast
 * de desfazer. O rótulo mentia; a ação estava certa.
 *
 * Passar `atual` faz a expressão depender do valor que o componente assina, e
 * aí não há o que hoistar. É a lei nº 1 pelo avesso: o que não entra no
 * snapshot não acorda ninguém — inclusive o compilador.
 *
 * ⚠ E comparava só o preset. O bruto de origem — as chaves que esta versão do
 * código não entende — podia ter mudado sem que ninguém notasse. É o mesmo
 * raciocínio que fez o retrato incluir o bruto: um desfazer que preserva o que
 * entende e perde o que não entende é pior que não ter desfazer, porque o dano
 * fica invisível.
 */
export function temMudanca(
  atual: Preset,
  brutoAtual: Record<string, unknown>,
): boolean {
  if (retrato === null) return false;
  return retrato.preset !== atual || retrato.bruto !== brutoAtual;
}

/** Reaplica um retrato guardado. É o desfazer do descarte. */
export function reaplicarRetrato(r: Retrato): void {
  aplicarPreset(r.preset, r.bruto);
}
