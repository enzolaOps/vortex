import { useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Caixa } from "../components/ui/Marcador";
import { Campo } from "../components/ui/Campo";
import { confirmarRedefinicao } from "../sdk/conta";
import { voltarParaEntrar } from "../store/entrada";
import css from "./TelaDeLogin.module.css";

/**
 * Definir a senha nova, a partir do token do link de e-mail.
 *
 * O token vem da URL e vive no store de entrada, nunca no `localStorage`: é
 * segredo de uso único e vida curta, e guardá-lo seria mantê-lo depois de ele
 * ter servido.
 */
export function TelaDeRedefinirSenha({
  token,
  motivo,
}: {
  token: string;
  motivo: string | undefined;
}) {
  const [senha, setSenha] = useState("");
  /*
    Marcado por padrão, e é a escolha segura.

    Quem redefine senha costuma fazê-lo porque perdeu o acesso ou desconfia
    dele. Manter as sessões antigas vivas manteria quem invadiu lá dentro — e o
    padrão é o que a maioria aceita sem ler.
  */
  const [derrubar, setDerrubar] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  const curta = senha.length > 0 && senha.length < 8;
  const podeEnviar = senha.length >= 8 && !enviando;

  if (pronto) {
    return (
      <div className={css.tela}>
        <div className={css.cartao}>
          <h1 className={css.titulo}>Senha alterada</h1>
          <p className={css.recado}>
            {derrubar
              ? "Os outros dispositivos foram desconectados. Entre com a senha nova."
              : "Entre com a senha nova."}
          </p>
          <Botao variante="primario" onClick={voltarParaEntrar}>
            Ir para a entrada
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <div className={css.tela}>
      <form
        className={css.cartao}
        onSubmit={(e) => {
          e.preventDefault();
          if (!podeEnviar) return;
          setEnviando(true);
          void confirmarRedefinicao(token, senha, derrubar)
            .then((ok) => setPronto(ok))
            .finally(() => setEnviando(false));
        }}
      >
        <h1 className={css.titulo}>Nova senha</h1>

        <Campo
          rotulo="Senha"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          disabled={enviando}
          dica="Pelo menos 8 caracteres."
          erro={curta ? "Curta demais — mínimo de 8 caracteres." : undefined}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {/* `checkbox` é o único controle nativo que o lint permite fora de
            `components/ui`: `accent-color` o traz para o sistema de cor e ele
            não abre superfície própria. */}
        <Caixa
          className={css.opcao}
          marcado={derrubar}
          disabled={enviando}
          aoAlternar={setDerrubar}
        >
          Desconectar os outros dispositivos
        </Caixa>

        {motivo ? (
          <p className={css.erro} role="alert">
            {motivo}
          </p>
        ) : null}

        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {enviando ? "Salvando…" : "Salvar senha"}
        </Botao>
      </form>
    </div>
  );
}
