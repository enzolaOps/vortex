import { WifiSlash, WifiHigh } from "../components/ui/icones";
import { useEffect, useSyncExternalStore } from "react";

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

  /*
    ⚠ **`data-offline` no `<html>`, e é o que CONGELA a presença.**

    Sem conexão o cliente não sabe quem está online — sabe o que sabia quando
    caiu. Os pontos de presença somem por CSS (ver `PontoDePresenca.module.css`)
    e a lista fica no último estado conhecido, que é o que o design manda:
    "todos offline" seria informação falsa.

    Mora aqui porque este já é o único assinante da conexão na raiz. Um
    atributo no documento é UMA subscrição para o app inteiro; a alternativa —
    cada ponto assinando — faria um engasgo de rede acordar as dezenas de
    pontos montados na member list.
  */
  useEffect(() => {
    const raiz = document.documentElement;
    if (estado === "conectado") delete raiz.dataset.offline;
    else raiz.dataset.offline = "";
    return () => {
      delete raiz.dataset.offline;
    };
  }, [estado]);

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
