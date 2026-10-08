import { ChamadaRecebida } from "./jornadas/casa";
import { BotaoDeConfiguracoes, CascaDeConfig } from "./jornadas/config";
import { ShellDasSalas } from "./jornadas/salas";
import { JanelaDestacada } from "./jornadas/voz";
import { BotaoDeSair, PortaoDeSessao } from "./jornadas/sessao";
import { Avisos } from "./ui/primitivos/Avisos";

/** O que é da pessoa, fixo no rodapé da coluna de salas. */
function RodapeDaPessoa() {
  return (
    <>
      <BotaoDeConfiguracoes />
      <BotaoDeSair />
    </>
  );
}

/**
 * Raiz do app: o portão de sessão (M3) e, dentro dele, o shell fixo ligado à
 * jornada de salas. A restauração da sessão é UMA só: a do portão. As
 * configurações são rota por cima do shell e ficam dentro do portão: sem sessão
 * não há perfil nem conta para ajustar.
 */
export function App() {
  return (
    <>
      <PortaoDeSessao>
        <ShellDasSalas rodapeDasSalas={<RodapeDaPessoa />} />
        <CascaDeConfig />
        <JanelaDestacada />
        <ChamadaRecebida />
      </PortaoDeSessao>
      <Avisos />
    </>
  );
}
