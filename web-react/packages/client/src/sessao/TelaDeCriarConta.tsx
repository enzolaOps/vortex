import { useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { criarConta } from "../sdk/conta";
import { definirEntrada, voltarParaEntrar } from "../store/entrada";
import css from "./TelaDeLogin.module.css";

/**
 * Criar conta.
 *
 * Sem ela, o app só servia a quem já tinha conta criada por outro cliente — o
 * que o mapa de superfícies registrou como a consequência mais grave da
 * autenticação incompleta.
 *
 * O campo de convite aparece SEMPRE, como opcional. O upstream o mostra só
 * quando `features.invite_only` está ligado, o que exige ler a configuração do
 * servidor antes de desenhar a tela — e este cliente ainda não fala com
 * servidor nenhum na abertura. Um campo opcional a mais é mais honesto que uma
 * tela que recusa sem dizer onde pôr o código.
 */
export function TelaDeCriarConta({ motivo }: { motivo: string | undefined }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [convite, setConvite] = useState("");
  const [enviando, setEnviando] = useState(false);

  /*
    Oito é o mínimo do protocolo, e o número está aqui em vez de só no servidor
    porque descobrir um limite depois de submeter é a pior hora de descobri-lo.
  */
  const curta = senha.length > 0 && senha.length < 8;
  const podeEnviar =
    email.trim().length > 0 && senha.length >= 8 && !enviando;

  return (
    <div className={css.tela}>
      <form
        className={css.cartao}
        onSubmit={(e) => {
          e.preventDefault();
          if (!podeEnviar) return;
          setEnviando(true);
          void criarConta(email.trim(), senha, convite.trim() || undefined)
            .then((ok) => {
              if (ok) {
                definirEntrada({ tipo: "conferirEmail", email: email.trim() });
              }
            })
            .finally(() => setEnviando(false));
        }}
      >
        <h1 className={css.titulo}>Criar conta</h1>

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

        <Campo
          rotulo="Senha"
          /* `new-password` e não `current-password`: é o que faz o gerenciador
             de senhas OFERECER uma senha forte em vez de tentar preencher a
             antiga. */
          autoComplete="new-password"
          type="password"
          required
          disabled={enviando}
          dica="Pelo menos 8 caracteres."
          erro={curta ? "Curta demais — mínimo de 8 caracteres." : undefined}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <Campo
          rotulo="Convite (opcional)"
          dica="Só se esta instância exigir."
          autoComplete="off"
          disabled={enviando}
          value={convite}
          onChange={(e) => setConvite(e.target.value)}
        />

        {motivo ? (
          <p className={css.erro} role="alert">
            {motivo}
          </p>
        ) : null}

        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {enviando ? "Criando…" : "Criar conta"}
        </Botao>

        <Botao variante="sutil" onClick={voltarParaEntrar} disabled={enviando}>
          Já tenho conta
        </Botao>
      </form>
    </div>
  );
}
