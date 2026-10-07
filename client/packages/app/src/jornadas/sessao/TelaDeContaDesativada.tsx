import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import css from "./Entrada.module.css";
import { MoldeDaEntrada } from "./MoldeDaEntrada";

/**
 * A conta foi desativada pela administração.
 *
 * Tem tela própria porque a ação é outra: senha errada se resolve tentando de novo,
 * conta desativada não se resolve em tela nenhuma. O texto diz o que houve e qual é
 * o único caminho, sem acusar e sem pedir desculpa. "Entrar com outra conta" existe
 * para o caso comum de a máquina ter mais de uma, e apaga a sessão desativada que
 * ficaria guardada e traria esta tela de volta a cada abertura.
 */
export function TelaDeContaDesativada({ aoTrocarDeConta }: { aoTrocarDeConta: () => void }) {
  return (
    <MoldeDaEntrada titulo={sessao.desativada.titulo}>
      <p className={css.recado}>{sessao.desativada.texto}</p>
      <p className={css.recado}>{sessao.desativada.quemResolve}</p>
      <Botao variante="secundario" className={css.largo} onClick={aoTrocarDeConta}>
        {sessao.desativada.outraConta}
      </Botao>
    </MoldeDaEntrada>
  );
}
