import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { Alerta, Confirmado } from "../../ui/icones";
import css from "./Entrada.module.css";
import { MoldeDaEntrada } from "./MoldeDaEntrada";

export type EstadoDaVerificacao = "verificando" | "confirmado" | "falhou";

export interface TelaDeVerificarEmailProps {
  estado: EstadoDaVerificacao;
  /** O motivo que o servidor deu, quando falhou. */
  motivo?: string;
  aoEntrar: () => void;
}

/**
 * O destino do link do e-mail de confirmação (`/verificar/:token`).
 *
 * Confirma sozinha ao abrir (quem chama dispara): a pessoa já clicou uma vez, no
 * e-mail, e pedir um segundo clique para fazer o que o primeiro prometeu é
 * cerimônia. O estado intermediário existe porque a chamada leva tempo de rede, e
 * uma tela em branco enquanto ela corre parece link quebrado.
 */
export function TelaDeVerificarEmail({ estado, motivo, aoEntrar }: TelaDeVerificarEmailProps) {
  const t = sessao.verificar;

  if (estado === "verificando") {
    return (
      <MoldeDaEntrada titulo={t.verificando}>
        <p className={css.recado} role="status" aria-busy="true">
          {t.verificandoTexto}
        </p>
      </MoldeDaEntrada>
    );
  }

  if (estado === "confirmado") {
    return (
      <MoldeDaEntrada titulo={t.okTitulo}>
        <div className={css.resultado}>
          <span className={css.selo}>
            <Confirmado tamanho={20} />
          </span>
          <p className={css.recado}>{t.okTexto}</p>
        </div>
        <Botao className={css.largo} onClick={aoEntrar}>
          {t.entrar}
        </Botao>
      </MoldeDaEntrada>
    );
  }

  return (
    <MoldeDaEntrada titulo={t.falhouTitulo}>
      <div className={css.resultado}>
        <span className={`${css.selo} ${css.seloDeErro}`}>
          <Alerta tamanho={20} />
        </span>
        <p className={css.recado} role="alert">
          {motivo ?? t.falhouTexto}
        </p>
      </div>
      <Botao variante="secundario" className={css.largo} onClick={aoEntrar}>
        {t.voltar}
      </Botao>
    </MoldeDaEntrada>
  );
}
