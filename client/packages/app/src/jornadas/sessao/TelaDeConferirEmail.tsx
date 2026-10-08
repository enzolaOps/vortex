import { useState } from "react";

import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { Email } from "../../ui/icones";
import { AvisoSimples } from "./AvisoDeEntrada";
import { CampoDeTexto } from "./CampoDeTexto";
import css from "./Entrada.module.css";
import { MoldeDaEntrada } from "./MoldeDaEntrada";
import { useContagem } from "./useContagem";

/** Segundos entre um reenvio e outro. */
export const ESPERA_DO_REENVIO = 60;

export interface TelaDeConferirEmailProps {
  /** Para onde o link foi. Falta quando a página recarregou: o e-mail nunca vai para a URL. */
  email: string | undefined;
  /** Falha do último reenvio, na frase do servidor. */
  motivo?: string;
  /** Devolve se o servidor aceitou o pedido. */
  aoReenviar: (email: string) => Promise<boolean>;
  aoUsarOutroEmail: () => void;
  aoVoltar: () => void;
}

/**
 * "Confira seu e-mail" e o reenvio, na MESMA tela.
 *
 * Quem não recebeu precisa achar o caminho de reenviar a partir da tela que não
 * ofereceria nada; aqui a ação está onde a dúvida aparece. O link espera 60 s depois
 * da criação (o e-mail acabou de sair) e depois de cada reenvio.
 *
 * O endereço é opcional: depois de um F5 ele se perdeu de propósito, e a tela pede
 * de novo em vez de mostrar um reenvio para ninguém.
 */
export function TelaDeConferirEmail({ email, motivo, aoReenviar, aoUsarOutroEmail, aoVoltar }: TelaDeConferirEmailProps) {
  const [digitado, setDigitado] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const { restante, reiniciar } = useContagem(ESPERA_DO_REENVIO);

  const endereco = email ?? digitado.trim();
  const podeReenviar = endereco !== "" && restante === 0 && !enviando;

  function reenviar() {
    if (!podeReenviar) return;
    setEnviando(true);
    setReenviado(false);
    void aoReenviar(endereco)
      .then((ok) => {
        setReenviado(ok);
        if (ok) reiniciar();
      })
      .finally(() => {
        setEnviando(false);
      });
  }

  return (
    <MoldeDaEntrada titulo={sessao.conferir.titulo}>
      <div className={css.resultado}>
        <span className={css.selo}>
          <Email tamanho={20} />
        </span>
        {email === undefined ? (
          <p className={css.recado}>{sessao.conferir.semEndereco}</p>
        ) : (
          <>
            <p className={css.recado}>{sessao.conferir.paraEndereco}</p>
            <p className={css.destaque}>{email}</p>
          </>
        )}
        <p className={css.recado}>{sessao.conferir.instrucao}</p>
      </div>

      {email === undefined && (
        <CampoDeTexto
          rotulo={sessao.conferir.emailDoReenvio}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={sessao.criar.emailExemplo}
          value={digitado}
          readOnly={enviando}
          onChange={(e) => {
            setDigitado(e.target.value);
            setReenviado(false);
          }}
        />
      )}

      {motivo !== undefined && <AvisoSimples tom="erro">{motivo}</AvisoSimples>}
      {reenviado && <AvisoSimples tom="sucesso">{sessao.conferir.reenviado}</AvisoSimples>}

      <div className={css.acoes}>
        <Botao
          variante="secundario"
          className={css.largo}
          carregando={enviando}
          disabled={!podeReenviar && !enviando}
          onClick={reenviar}
        >
          {enviando
            ? sessao.conferir.reenviando
            : restante > 0
              ? sessao.conferir.reenviarEm(restante)
              : sessao.conferir.reenviar}
        </Botao>
        <Botao variante="fantasma" className={css.largo} disabled={enviando} onClick={aoUsarOutroEmail}>
          {sessao.conferir.outroEmail}
        </Botao>
        <Botao variante="fantasma" className={css.largo} disabled={enviando} onClick={aoVoltar}>
          {sessao.conferir.voltar}
        </Botao>
      </div>
    </MoldeDaEntrada>
  );
}
