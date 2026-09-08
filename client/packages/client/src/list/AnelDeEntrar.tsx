import { MetalFx } from "metal-fx";
import type { ReactNode } from "react";

import { temaDoDocumento } from "../lib/efeito";

/**
 * Anel de metal no botão de entrar na chamada.
 *
 * Chunk próprio de propósito: `metal-fx` é WebGL, e o botão mora na timeline.
 * Import estático aqui puxaria o shader para o chunk da `MessageRow`.
 */
export function AnelDeEntrar({ children }: { children: ReactNode }) {
  return (
    <MetalFx
      preset="silver"
      variant="button"
      strength={0.65}
      theme={temaDoDocumento()}
      normalizeHostStyles={false}
    >
      {children}
    </MetalFx>
  );
}
