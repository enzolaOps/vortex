import { WifiSlash, WifiHigh } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";

import { assinarConexao, lerConexao } from "../store/conexao";
import css from "./FaixaDeConexao.module.css";

/**
 * A faixa que diz que a conexão caiu.
 *
 * Montada na raiz e FLUTUANDO, nunca no fluxo. Uma faixa que empurra o layout
 * muda a altura do container da lista virtualizada — e mudar a altura do
 * container é a âncora se movendo por causa de um aviso, que é o inverso do
 * que um aviso deve fazer. Vale a mesma regra da barra de ações da linha, e
 * pelo mesmo motivo técnico.
 *
 * Não tem botão de "tentar de novo": o SDK religa sozinho, e um botão que
 * apenas repete o que já está acontecendo ensina que os botões deste app não
 * fazem nada. Quando a reconexão automática não existir para algum caso, aí
 * ele nasce com trabalho de verdade para fazer.
 */
export function FaixaDeConexao() {
  const estado = useSyncExternalStore(assinarConexao, lerConexao);
  if (estado === "conectado") return null;

  const reconectando = estado === "reconectando";

  return (
    /*
      `role="status"` e não `alert`: `alert` interrompe o leitor de tela no
      meio da frase, e queda de conexão não é uma emergência que justifique
      cortar o que a pessoa está lendo. `status` anuncia na primeira pausa.
    */
    <div className={css.faixa} role="status" data-estado={estado}>
      {reconectando ? (
        <WifiHigh size={20} aria-hidden className={css.pulsando} />
      ) : (
        <WifiSlash size={20} aria-hidden />
      )}
      <span>
        {reconectando
          ? "Reconectando…"
          : "Sem conexão. O que você escrever fica guardado."}
      </span>
    </div>
  );
}
