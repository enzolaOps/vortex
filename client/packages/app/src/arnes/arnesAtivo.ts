/**
 * Estamos no arnês de medição?
 *
 * Um predicado em um lugar só, lido do endereço CRU (`/dev` ou `#/dev`) e nunca
 * de um store de navegação: o arnês não é um lugar do produto, e um destino
 * "arnês" na união de navegação seria um destino que o produto não tem.
 *
 * O arnês só EXISTE em dev e no modo `gate` (`vite build --mode gate`). O gate de
 * merge mede um BUILD, não o dev server (medir no dev server reprova o ambiente
 * em vez do código), e este modo é o que dá a ele um bundle de produção com o
 * arnês dentro, sem pô-lo no bundle que vai ao ar. No build normal
 * `import.meta.env.MODE` vira a string "production", a condição é dobrada e o
 * `import()` de `main.tsx` some junto com o chunk.
 */
export const ARNES_DISPONIVEL = import.meta.env.DEV || import.meta.env.MODE === "gate";

export function arnesAtivo(): boolean {
  if (!ARNES_DISPONIVEL) return false;
  return location.pathname === "/dev" || location.hash === "#/dev";
}
