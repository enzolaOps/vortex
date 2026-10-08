import { ChamadaRecebida } from "./jornadas/casa";
import { CascaDeConfig } from "./jornadas/config";
import { ShellDasSalas } from "./jornadas/salas";
import { JanelaDestacada } from "./jornadas/voz";
import { PortaoDeSessao } from "./jornadas/sessao";
import { Avisos } from "./ui/primitivos/Avisos";

/**
 * Raiz do app. Configurações ficam na dock, opostas ao Home. Sair só dentro
 * das configurações, com confirmação.
 */
export function App() {
  return (
    <>
      <PortaoDeSessao>
        <ShellDasSalas />
        <CascaDeConfig />
        <JanelaDestacada />
        <ChamadaRecebida />
      </PortaoDeSessao>
      <Avisos />
    </>
  );
}
