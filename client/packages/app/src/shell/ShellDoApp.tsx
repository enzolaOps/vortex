import { useState, type ReactNode } from "react";

import { AreaPrincipal } from "./AreaPrincipal";
import { BarraDeTitulo } from "./BarraDeTitulo";
import { ColunaDeSalas } from "./ColunaDeSalas";
import { DockDeServidores } from "./DockDeServidores";
import { GavetaDeMembros, type ModoVisivelDaGaveta } from "./GavetaDeMembros";
import { Shell } from "./Shell";

/**
 * O shell com as cinco regiões montadas. As regiões sem dado ainda (servidores,
 * salas, membros) mostram o estado vazio do catálogo; `principal` é o que a
 * jornada ativa pendura na área central (o arnês pendura a lista de mensagens).
 */
export function ShellDoApp({ principal }: { principal?: ReactNode }) {
  const [modo, setModo] = useState<ModoVisivelDaGaveta>("lista");
  return (
    <Shell
      modoDaGaveta={modo}
      barraDeTitulo={<BarraDeTitulo />}
      dock={<DockDeServidores />}
      salas={<ColunaDeSalas />}
      principal={<AreaPrincipal>{principal}</AreaPrincipal>}
      gaveta={<GavetaDeMembros modo={modo} aoMudarModo={setModo} />}
    />
  );
}
