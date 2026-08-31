import { useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { reenviarVerificacao } from "../sdk/conta";
import { voltarParaEntrar } from "../store/entrada";
import css from "./TelaDeLogin.module.css";

/**
 * "Confira seu e-mail" — e o reenvio, na mesma tela.
 *
 * O upstream separa as duas em telas diferentes (`FlowCheck` e `FlowResend`),
 * e a separação cobra: quem não recebeu precisa achar sozinho o caminho de
 * reenviar, a partir de uma tela que não oferece nada. Aqui a ação está onde a
 * dúvida aparece.
 *
 * O endereço vem por prop e pode faltar: ele NÃO vai para a URL — e-mail em
 * barra de endereço fica em histórico, em log de proxy e em print de tela.
 * Quem recarrega vê o texto genérico e digita de novo para reenviar.
 */
export function TelaDeConferirEmail({ email }: { email: string | undefined }) {
  const [endereco, setEndereco] = useState(email ?? "");
  const [enviando, setEnviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  const limpo = endereco.trim();

  return (
    <div className={css.tela}>
      <div className={css.cartao}>
        <h1 className={css.titulo}>Confira seu e-mail</h1>

        <p className={css.recado}>
          {email
            ? `Mandamos um link de confirmação para ${email}. Abra-o para ativar a conta.`
            : "Mandamos um link de confirmação. Abra-o para ativar a conta."}
        </p>

        <p className={css.recado}>
          Não chegou? Confira o spam — ou peça outro.
        </p>

        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="username"
          disabled={enviando}
          value={endereco}
          onChange={(e) => {
            setEndereco(e.target.value);
            setReenviado(false);
          }}
        />

        {/*
          A confirmação é POSITIVA e não some sozinha: "mandamos de novo" é a
          resposta à única ação desta tela, e um aviso que evapora faz a pessoa
          duvidar se apertou.
        */}
        {reenviado ? (
          <p className={css.recado} role="status">
            Pronto — outro link foi enviado.
          </p>
        ) : null}

        <Botao
          variante="neutro"
          disabled={limpo.length === 0 || enviando}
          onClick={() => {
            setEnviando(true);
            void reenviarVerificacao(limpo)
              .then((ok) => setReenviado(ok))
              .finally(() => setEnviando(false));
          }}
        >
          {enviando ? "Enviando…" : "Enviar de novo"}
        </Botao>

        <Botao variante="sutil" onClick={voltarParaEntrar}>
          Voltar para a entrada
        </Botao>
      </div>
    </div>
  );
}
