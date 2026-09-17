/**
 * A densidade da galeria de mídia — "Confortável" ou "Denso".
 *
 * Store e não estado de componente porque o controle mora no CABEÇALHO do
 * shell e a grade mora na coluna de conteúdo: duas árvores irmãs que precisam
 * concordar. Da sessão, não do preset — é modo de leitura de um canal, e o
 * preset não carrega nada que dependa de canal.
 */

export type DensidadeDaGaleria = "confortavel" | "denso";

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();
let densidade: DensidadeDaGaleria = "confortavel";

export function assinarGaleria(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerDensidadeDaGaleria(): DensidadeDaGaleria {
  return densidade;
}

export function definirDensidadeDaGaleria(nova: DensidadeDaGaleria): void {
  if (nova === densidade) return;
  densidade = nova;
  for (const o of ouvintes) o();
}
