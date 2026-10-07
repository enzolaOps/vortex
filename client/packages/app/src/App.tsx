import { BotaoDeSair, PortaoDeSessao } from "./jornadas/sessao";
import { ShellDoApp } from "./shell";

/**
 * Raiz do app: o portão de sessão e, dentro dele, o shell fixo. As demais jornadas
 * (salas, chat…) entram nos próximos marcos e penduram o conteúdo na área principal.
 */
export function App() {
  return (
    <PortaoDeSessao>
      <ShellDoApp rodapeDasSalas={<BotaoDeSair />} />
    </PortaoDeSessao>
  );
}
