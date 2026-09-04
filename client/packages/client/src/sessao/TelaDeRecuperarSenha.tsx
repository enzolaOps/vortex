import { useEffect, useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { pedirRedefinicao } from "../sdk/conta";
import { instanciaMandaEmail } from "../sdk/config";
import { irParaRedefinir, voltarParaEntrar } from "../store/entrada";
import { PASSOS_DA_SENHA, Passos } from "./Passos";
import css from "./TelaDeLogin.module.css";

/** Os segundos do design entre um reenvio e outro. */
const ESPERA = 60;

/**
 * `a•••@estudio.co` — o e-mail com o miolo escondido, como o design escreve.
 *
 * ⚠ Ele não é decoração: quem tem duas contas precisa saber para QUAL caixa
 * olhar, e mostrar o endereço inteiro numa tela que qualquer um pode abrir
 * digitando um e-mail alheio entregaria que aquela conta existe.
 */
function mascarar(email: string): string {
  const [antes, dominio] = email.split("@");
  if (!antes || !dominio) return email;
  return `${antes.slice(0, 1)}•••@${dominio}`;
}

/**
 * Recuperar senha — passos 1 e 2 dos três do design.
 *
 * O terceiro é `TelaDeRedefinirSenha`, e ela mora noutro arquivo porque é
 * alcançada por ROTA (`/redefinir/:token`), normalmente noutro navegador — a
 * pessoa clica no link do e-mail onde quer que ele esteja aberto. Um
 * componente só com os três passos daria a impressão de que o segundo leva ao
 * terceiro nesta aba, e não leva.
 *
 * ⚠ **O passo 2 do design é um CÓDIGO de seis dígitos, e aqui é um link.** O
 * Stoat manda `token` por e-mail e `DataPasswordReset` o exige; não há código
 * para digitar. Ver `Passos`.
 */
export function TelaDeRecuperarSenha({ motivo }: { motivo: string | undefined }) {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [colado, setColado] = useState("");
  const [espera, setEspera] = useState(0);

  /*
    A contagem para reenviar — "Reenviar em 0:42" no design.

    ⚠ Ela existe para proteger de DUAS coisas, e só uma é o servidor: apertar
    de novo antes de o e-mail chegar é o reflexo de todo mundo, e cada toque
    invalida o link anterior. Sem a espera, a pessoa acumula três e-mails e o
    único que funciona é o último — que costuma ser o que ela não abriu.
  */
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const podeEnviar = email.trim().length > 0 && !enviando && espera === 0;

  function pedir() {
    setEnviando(true);
    void pedirRedefinicao(email.trim())
      .then((ok) => {
        if (!ok) return;
        setEnviado(true);
        setEspera(ESPERA);
      })
      .finally(() => setEnviando(false));
  }

  return (
    <div className={css.tela}>
      <form
        className={css.cartaoDeCadastro}
        onSubmit={(e) => {
          e.preventDefault();
          if (podeEnviar) pedir();
        }}
      >
        <div className={css.sobrancelhaDoCartao}>Recuperação de senha</div>
        <Passos atual={enviado ? 2 : 1} nomes={PASSOS_DA_SENHA} />

        <h1 className={css.saudacao}>
          {enviado ? "Confira seu e-mail" : "Recuperar senha"}
        </h1>

        <p className={css.instrucao}>
          {enviado ? (
            <>
              Se houver uma conta confirmada em{" "}
              <strong>{mascarar(email.trim())}</strong>, o link já está a
              caminho. Ele vale por pouco tempo.
            </>
          ) : (
            "Informe o e-mail da conta. Se houver uma conta confirmada com esse endereço, você receberá um link para redefinir a senha."
          )}
        </p>

        {/*
          ⚠ **O aviso mais importante desta tela, e ele é sobre a INSTÂNCIA.**
          `features.email` vem da configuração do servidor. Com SMTP desligado
          — que é o estado desta instância hoje — o pedido é aceito e o e-mail
          nunca sai. Sem dizer isso, a pessoa fica esperando uma mensagem que
          não existe, e a única saída é pedir a senha a quem administra.
        */}
        {!instanciaMandaEmail() ? (
          <Banner tom="aviso">
            Este servidor está com o envio de e-mail desligado, então o link não
            vai chegar. Peça a redefinição a quem administra a instância.
          </Banner>
        ) : null}

        {motivo ? (
          <Banner tom="perigo" role="alert" className={css.aviso}>
            {motivo}
          </Banner>
        ) : null}

        {enviado ? (
          <>
            <Botao
              variante="sutil"
              type="submit"
              disabled={espera > 0 || enviando}
            >
              {espera > 0
                ? `Reenviar em 0:${String(espera).padStart(2, "0")}`
                : "Reenviar o link"}
            </Botao>

            {/*
              ⚠ **O campo de colar existe porque o link abre onde o e-mail
              está, e isso raramente é esta aba.** Quem lê e-mail no celular e
              usa o Vortex no computador clicaria no link no aparelho errado —
              e a sessão que precisa da senha nova é a daqui. Colar o endereço
              resolve sem exigir que a pessoa entenda por que não funcionou.
            */}
            <Campo
              rotulo="Ou cole o link que chegou"
              dica="Se você abriu o e-mail em outro aparelho."
              autoComplete="off"
              spellCheck={false}
              disabled={enviando}
              value={colado}
              onChange={(e) => setColado(e.target.value)}
            />

            <Botao
              variante="primario"
              disabled={tokenDoLink(colado) === undefined}
              onClick={() => {
                const t = tokenDoLink(colado);
                if (t) irParaRedefinir(t);
              }}
            >
              Continuar
            </Botao>
          </>
        ) : (
          <>
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

            <Botao variante="primario" type="submit" disabled={!podeEnviar}>
              {enviando ? "Enviando…" : "Enviar link"}
            </Botao>
          </>
        )}

        <p className={css.rodape}>
          <button
            type="button"
            className={css.trocarTela}
            disabled={enviando}
            onClick={voltarParaEntrar}
          >
            Voltar para a entrada
          </button>
        </p>
      </form>
    </div>
  );
}

/**
 * O token dentro do que a pessoa colou.
 *
 * ⚠ **Aceita o link inteiro E o token sozinho**, porque os dois acontecem:
 * copiar do e-mail traz a URL, e quem copia com o dedo no celular costuma
 * pegar só o pedaço final. Exigir um formato faria a metade das tentativas
 * falhar sem explicação.
 *
 * O casamento é pelo formato do token e não pelo domínio: o link chega com o
 * endereço que o SERVIDOR conhece (`REVOLT__HOSTS__APP`), que não é
 * necessariamente o que está na barra — túnel, preview e localhost divergem.
 */
function tokenDoLink(bruto: string): string | undefined {
  const t = bruto.trim();
  if (t === "") return undefined;
  const m = /([A-Za-z0-9_-]{16,})\/?$/.exec(t);
  return m?.[1];
}
