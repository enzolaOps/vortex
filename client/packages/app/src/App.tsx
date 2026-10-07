import { ChamadaRecebida } from "./jornadas/casa";
import { ShellDasSalas } from "./jornadas/salas";
import { JanelaDestacada } from "./jornadas/voz";
import { BotaoDeSair, PortaoDeSessao } from "./jornadas/sessao";
import { Avisos } from "./ui/primitivos/Avisos";

/**
 * Raiz do app: o portão de sessão (M3) e, dentro dele, o shell fixo ligado à
 * jornada de salas. A restauração da sessão é UMA só: a do portão.
 */
export function App() {
  return (
    <>
      <PortaoDeSessao>
        <ShellDasSalas rodapeDasSalas={<BotaoDeSair />} />
        <JanelaDestacada />
        <ChamadaRecebida />
      </PortaoDeSessao>
      <Avisos />
    </>
  );
}
