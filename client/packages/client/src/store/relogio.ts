import { useSyncExternalStore } from "react";

/**
 * O "agora", em passos de um minuto, para quem escreve tempo relativo.
 *
 * ⚠ **Existe porque `Date.now()` no render é impuro** — o React Compiler
 * reprova, e com razão: dois renders do mesmo estado dariam "há 59 min" e
 * "há 1 h". Aqui o tempo é ESTADO externo, com snapshot estável dentro do
 * minuto, e quem assina re-renderiza uma vez por minuto — não por render.
 *
 * O intervalo só existe enquanto alguém assina: um painel fechado não paga
 * relógio.
 */

type Ouvinte = () => void;

const MINUTO = 60_000;
const ouvintes = new Set<Ouvinte>();
let agora = Math.floor(Date.now() / MINUTO) * MINUTO;
let intervalo: ReturnType<typeof setInterval> | undefined;

function assinar(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  if (intervalo === undefined) {
    agora = Math.floor(Date.now() / MINUTO) * MINUTO;
    intervalo = setInterval(() => {
      agora = Math.floor(Date.now() / MINUTO) * MINUTO;
      for (const o of ouvintes) o();
    }, MINUTO);
  }
  return () => {
    ouvintes.delete(ouvinte);
    if (ouvintes.size === 0 && intervalo !== undefined) {
      clearInterval(intervalo);
      intervalo = undefined;
    }
  };
}

export function useAgoraPorMinuto(): number {
  return useSyncExternalStore(assinar, () => agora);
}
