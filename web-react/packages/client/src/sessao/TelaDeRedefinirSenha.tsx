import { useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Caixa } from "../components/ui/Marcador";
import { Campo } from "../components/ui/Campo";
import { PASSOS_DA_SENHA, Passos } from "./Passos";
import { forcaDaSenha, MINIMO_DA_SENHA } from "./forcaDaSenha";
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
/** As quatro barras do medidor. Constantes porque `key` nunca é índice. */
const BARRAS = ["b1", "b2", "b3", "b4"] as const;

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

  const forca = forcaDaSenha(senha);
  const podeEnviar = senha.length >= MINIMO_DA_SENHA && !enviando;

  if (pronto) {
    return (
      <div className={css.tela}>
        <div className={css.cartaoDeCadastro}>
          <div className={css.sobrancelhaDoCartao}>Recuperação de senha</div>
          <h1 className={css.saudacao}>Senha alterada</h1>
          <p className={css.instrucao}>
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
        className={css.cartaoDeCadastro}
        onSubmit={(e) => {
          e.preventDefault();
          if (!podeEnviar) return;
          setEnviando(true);
          void confirmarRedefinicao(token, senha, derrubar)
            .then((ok) => setPronto(ok))
            .finally(() => setEnviando(false));
        }}
      >
        <div className={css.sobrancelhaDoCartao}>Recuperação de senha</div>
        <Passos atual={3} nomes={PASSOS_DA_SENHA} />

        <h1 className={css.saudacao}>Escolha uma nova senha</h1>
        {/*
          A consequência ANTES do campo, e é o que o design escreve: "Todas as
          sessões ativas serão encerradas." Dizê-la depois do botão seria dizer
          depois do ato.
        */}
        <p className={css.instrucao}>
          As outras sessões vão ser encerradas — você entra de novo com a senha
          nova em cada aparelho.
        </p>

        <div>
          <Campo
            rotulo="Senha"
            type="password"
            revelavel
            autoComplete="new-password"
            autoFocus
            required
            disabled={enviando}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

          {/* O mesmo medidor do cadastro — a régua da senha não pode mudar
              entre a tela que a cria e a que a troca. */}
          <div className={css.medidor} aria-hidden>
            {BARRAS.map((b, i) => (
              <span
                key={b}
                className={css.barraDeForca}
                data-acesa={i < forca.nivel || undefined}
                data-tom={forca.tom}
              />
            ))}
          </div>

          <div className={css.linhaDaForca}>
            <span className={css.rotuloDaForca} data-tom={forca.tom}>
              {forca.rotulo}
            </span>
            <span className={css.minimo}>
              mín. {MINIMO_DA_SENHA} caracteres
            </span>
          </div>
        </div>

        {/* `checkbox` é o único controle nativo que o lint permite fora de
            `components/ui`: `accent-color` o traz para o sistema de cor e ele
            não abre superfície própria. */}
        <Caixa
          className={css.lembrar}
          marcado={derrubar}
          disabled={enviando}
          aoAlternar={setDerrubar}
        >
          Desconectar os outros dispositivos
        </Caixa>

        {motivo ? (
          <Banner tom="perigo" role="alert">
            {motivo}
          </Banner>
        ) : null}

        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {enviando ? "Salvando…" : "Salvar senha"}
        </Botao>
      </form>
    </div>
  );
}
