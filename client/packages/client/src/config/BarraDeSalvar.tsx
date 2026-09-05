import { useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import {
  assinarBarraDeSalvar,
  lerBarraDeSalvar,
} from "../store/barraDeSalvar";
import css from "./Configuracoes.module.css";

/**
 * A faixa de "alterações não salvas", desenhada pela CASCA.
 *
 * ⚠ **Ela era da PÁGINA, e por isso vivia dentro do scroller.** A versão
 * anterior morava em `VisaoGeralDoCanal`, `position: sticky` com margem
 * negativa de −110 para sangrar até a borda do pane, e o scroller reservava
 * `--vx-config-rodape-h` (110px) em TODA página de configuração — inclusive
 * nas onze que nunca mostram faixa nenhuma.
 *
 * Medido na referência: ela é irmã do scroller (`shrink-0`, em fluxo),
 * `padding: 12px 40px`, régua em cima, `surface-base`, 59px de altura. Nada
 * de sticky, nada de margem negativa e nada reservado quando ela não existe —
 * quem cede altura é o scroller, que é o que um item de grid `auto` faz de
 * graça.
 *
 * ⚠ **A animação de chegada SAIU.** O relato de quem usa foi "aparece de forma
 * súbita", e a resposta anterior foi animar a entrada. Errada: uma faixa que
 * desliza para dentro chama MAIS atenção que uma que aparece. O que a
 * referência faz é não mover o conteúdo — e agora nós também não movemos, mas
 * pelo motivo certo (a linha do grid abre embaixo do scroller, não por cima
 * de um respiro reservado).
 */
export function BarraDeSalvar() {
  const barra = useSyncExternalStore(assinarBarraDeSalvar, lerBarraDeSalvar);

  if (barra === undefined) return null;

  return (
    /*
      `role="status"` e não `alert`: é uma pendência de gravação, não um erro.
      `alert` interrompe o leitor de tela no meio da palavra que a pessoa
      acabou de digitar, que é exatamente quando esta faixa aparece.
    */
    <div className={css.faixaDeSalvar} role="status">
      <span className={css.faixaRecado}>
        {barra.recado ?? "Você tem alterações não salvas."}
      </span>
      <div className={css.faixaAcoes}>
        <Botao
          variante="sutil"
          onClick={barra.aoDescartar}
          disabled={barra.salvando}
        >
          Descartar
        </Botao>
        <Botao
          variante="primario"
          onClick={barra.aoSalvar}
          disabled={barra.salvando}
        >
          {barra.salvando ? "Salvando…" : "Salvar alterações"}
        </Botao>
      </div>
    </div>
  );
}
