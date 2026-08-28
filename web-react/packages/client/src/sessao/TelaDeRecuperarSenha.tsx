import { useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { pedirRedefinicao } from "../sdk/conta";
import { voltarParaEntrar } from "../store/entrada";
import css from "./TelaDeLogin.module.css";

/**
 * Pedir a redefinição de senha.
 *
 * ⚠ **A confirmação não diz se a conta existe, e isso é deliberado.** "Se
 * houver conta com esse e-mail, o link foi enviado" custa uma frase mais longa
 * e evita transformar esta tela num verificador de cadastro: com "e-mail não
 * encontrado", qualquer pessoa descobre quem tem conta aqui, um endereço por
 * vez.
 */
export function TelaDeRecuperarSenha({ motivo }: { motivo: string | undefined }) {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const podeEnviar = email.trim().length > 0 && !enviando;

  return (
    <div className={css.tela}>
      <form
        className={css.cartao}
        onSubmit={(e) => {
          e.preventDefault();
          if (!podeEnviar) return;
          setEnviando(true);
          void pedirRedefinicao(email.trim())
            .then((ok) => setEnviado(ok))
            .finally(() => setEnviando(false));
        }}
      >
        <h1 className={css.titulo}>Recuperar senha</h1>

        {enviado ? (
          <p className={css.recado} role="status">
            Se houver uma conta com esse e-mail, o link de redefinição já está a
            caminho. Ele vale por pouco tempo.
          </p>
        ) : (
          <>
            <p className={css.recado}>
              Digite o e-mail da conta e mandamos um link para definir uma senha
              nova.
            </p>

            <Campo
              rotulo="E-mail"
              type="email"
              autoComplete="username"
              autoFocus
              required
              disabled={enviando}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {motivo ? (
              <p className={css.erro} role="alert">
                {motivo}
              </p>
            ) : null}

            <Botao variante="primario" type="submit" disabled={!podeEnviar}>
              {enviando ? "Enviando…" : "Enviar link"}
            </Botao>
          </>
        )}

        <Botao variante="sutil" onClick={voltarParaEntrar} disabled={enviando}>
          Voltar para a entrada
        </Botao>
      </form>
    </div>
  );
}
