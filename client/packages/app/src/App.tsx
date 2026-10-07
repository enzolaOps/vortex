import { ligarLogoutDoServidor, restaurarSessao } from "nucleo/sdk/autenticacao";
import { useEffect } from "react";

import { ShellDasSalas } from "./jornadas/salas";
import { Avisos } from "./ui/primitivos/Avisos";

let iniciado = false;

/**
 * Raiz do app. O shell fixo ligado à jornada de salas (4.2). A entrada (login,
 * criar conta) é a jornada de sessão e ainda não monta aqui: a sessão guardada é
 * restaurada na abertura, e sem ela o shell mostra o estado de carregamento.
 */
export function App() {
  useEffect(() => {
    // Uma vez por página: StrictMode roda o efeito duas vezes em dev.
    if (iniciado) return;
    iniciado = true;
    ligarLogoutDoServidor();
    restaurarSessao();
  }, []);

  return (
    <>
      <ShellDasSalas />
      <Avisos />
    </>
  );
}
