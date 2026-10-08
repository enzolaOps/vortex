import { definirModoDaGaveta } from "nucleo/store/preferenciasDaSala";
import { useModoDaGaveta } from "nucleo/store/hooks";
import type { ReactNode } from "react";

import { AreaPrincipal } from "./AreaPrincipal";
import { BarraDeTitulo } from "./BarraDeTitulo";
import { ColunaDeSalas } from "./ColunaDeSalas";
import { DockDeServidores } from "./DockDeServidores";
import { GavetaDeMembros } from "./GavetaDeMembros";
import { Shell } from "./Shell";

export interface ShellDoAppProps {
  /** O que a jornada ativa pendura na área central (o arnês pendura a lista de mensagens). */
  principal?: ReactNode;
  /** Conteúdo da dock de servidores. Sem ele, o estado vazio do catálogo. */
  dock?: ReactNode;
  /** A coluna de salas inteira (já com o próprio cabeçalho). Sem ela, a coluna vazia. */
  salas?: ReactNode;
  /** Corpo da gaveta de membros. Sem ele, o estado vazio do catálogo. */
  membros?: ReactNode;
  /** A área central já montada pela jornada (substitui `principal`). */
  area?: ReactNode;
  /** Esconde a gaveta (fora de um servidor não há membros a listar). */
  gavetaOculta?: boolean;
  /** A faixa estreita que substitui a coluna de salas com o palco em tela cheia (ver `Shell`). */
  faixaDeSalas?: ReactNode;
  /** O palco ocupa a tela: a coluna de salas vira a faixa. */
  salasEmFaixa?: boolean;
  /** O que é da pessoa (sair da conta), fixo no rodapé da coluna de salas. */
  rodapeDasSalas?: ReactNode;
}

/**
 * O shell com as cinco regiões montadas. As regiões sem dado ainda (servidores,
 * salas, membros) mostram o estado vazio do catálogo; a jornada ativa entra por
 * props. O modo da gaveta é preferência do dispositivo e vive num store, não
 * aqui: sobrevive a fechar e abrir o app.
 */
export function ShellDoApp({ principal, dock, salas, membros, area, gavetaOculta = false, rodapeDasSalas, faixaDeSalas, salasEmFaixa = false }: ShellDoAppProps) {
  const modo = useModoDaGaveta();
  return (
    <Shell
      salasEmFaixa={salasEmFaixa}
      faixaDeSalas={faixaDeSalas}
      modoDaGaveta={gavetaOculta ? "oculta" : modo}
      barraDeTitulo={<BarraDeTitulo />}
      dock={<DockDeServidores>{dock}</DockDeServidores>}
      salas={salas ?? <ColunaDeSalas rodape={rodapeDasSalas} />}
      principal={area ?? <AreaPrincipal>{principal}</AreaPrincipal>}
      gaveta={
        <GavetaDeMembros modo={modo} aoMudarModo={definirModoDaGaveta}>
          {membros}
        </GavetaDeMembros>
      }
    />
  );
}
