import { useEffect, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { ligarLogoutDoServidor, restaurarSessao } from "../sdk/autenticacao";
import { assinarSessao, lerSessao } from "../store/sessao";
import { TelaDeLogin } from "./TelaDeLogin";

/**
 * Quem entra e quem espera.
 *
 * Envolve o app inteiro: sem sessão não há canal, não há autor para a mensagem
 * e não há a quem perguntar permissão. Um app que renderiza o shell antes de
 * saber quem é a pessoa passa o resto da vida checando `undefined`.
 *
 * ⚠ **O caminho de servidor real nunca rodou** — não há backend alcançável
 * deste repositório. Ver `sdk/autenticacao.ts`.
 */
export function PortaoDeSessao({ children }: { children: ReactNode }) {
  const sessao = useSyncExternalStore(assinarSessao, lerSessao);

  useEffect(() => {
    /*
      Uma vez, na abertura, e nesta ordem.

      Ligar o `logout` ANTES de restaurar: `useExistingSession` conecta, e um
      token revogado é recusado durante essa conexão. Ligar depois perderia
      exatamente o evento que a restauração existe para descobrir.
    */
    ligarLogoutDoServidor();
    restaurarSessao();
  }, []);

  /*
    `desconhecida` não renderiza NADA, e é isso que evita o flash.

    A pergunta ao armazenamento é síncrona mas acontece no efeito, depois do
    primeiro render. Mostrar a tela de login nesse instante a faria piscar em
    toda abertura de quem já está logado — que é a maioria das aberturas.
  */
  if (sessao.estado === "desconhecida") return null;

  if (sessao.estado === "dentro") return <>{children}</>;

  return (
    <TelaDeLogin
      entrando={sessao.estado === "entrando"}
      motivo={sessao.motivo}
    />
  );
}
