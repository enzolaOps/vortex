import { useSyncExternalStore } from "react";

import { assinarConexao, lerConexao } from "../store/conexao";
import css from "./NotaDePresencaOffline.module.css";

/**
 * "Presença indisponível offline" na coluna de canais (D-LAC-46).
 *
 * ⚠ **Componente próprio, e é a mesma razão do `Rtt` e do `Cronometro`:** a
 * subscrição fica numa folha de uma linha em vez de na coluna inteira. Se
 * `ListaDeCanais` assinasse, cada engasgo de rede re-renderizaria as dezenas
 * de linhas de canal com as ações de cada uma — para trocar um parágrafo.
 *
 * Arquivo próprio e não uma função dentro de `ListaDeCanais.tsx`: aquele
 * arquivo é o mais disputado do app, e o que é da conexão fica com a conexão.
 *
 * Ela repete o que a member list já diz, e repetir é o ponto: quem olha a
 * coluna não tem por que abrir o painel de membros para descobrir que a
 * bolinha sumiu por falta de dado e não porque todo mundo saiu.
 */
export function NotaDePresencaOffline() {
  const semConexao =
    useSyncExternalStore(assinarConexao, lerConexao) !== "conectado";
  if (!semConexao) return null;
  return (
    <p className={css.nota}>
      Presença indisponível offline — todos aparecem sem status.
    </p>
  );
}
