import { useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Segmentado } from "../components/ui/Segmentado";
import { cancelarMfa, responderMfa } from "../sdk/autenticacao";
import type { MetodoDeMfa } from "../store/sessao";
import css from "./TelaDeLogin.module.css";

/**
 * O segundo fator.
 *
 * Existe porque `client.login()` do SDK **lança uma string crua** quando a
 * conta tem MFA — `throw "MFA not implemented!"`. Sem esta tela, exatamente as
 * contas mais protegidas eram as que não conseguiam entrar.
 *
 * ⚠ **Aplicativo autenticador ficou FORA do Vortex, por decisão de produto.**
 * Sobram senha e código de recuperação. Um desafio só de TOTP nem chega aqui:
 * `concluir` cai no ramo de lista vazia e a tela de entrada diz que este
 * cliente não usa aquele método — em vez de mostrar um campo inerte.
 *
 * Divide o CSS com a tela de entrada de propósito: é a mesma tela em outro
 * passo, e um cartão de largura ou respiro diferente faria a transição parecer
 * uma troca de contexto em vez da continuação que é.
 */

/** O rótulo e a explicação de cada fator, na voz da interface. */
const FATOR: Record<
  MetodoDeMfa,
  { readonly aba: string; readonly rotulo: string; readonly dica: string; readonly tipo: string }
> = {
  senha: {
    aba: "Senha",
    rotulo: "Senha",
    dica: "A mesma senha da conta.",
    tipo: "password",
  },
  recuperacao: {
    aba: "Recuperação",
    rotulo: "Código de recuperação",
    dica: "Um dos códigos que você guardou ao ativar a verificação. Cada um serve uma vez.",
    tipo: "text",
  },
};

export function TelaDeMfa({
  metodos,
  entrando,
  motivo,
}: {
  metodos: readonly MetodoDeMfa[];
  entrando: boolean;
  motivo: string | undefined;
}) {
  /*
    O primeiro método da lista do SERVIDOR, não um preferido nosso.

    A ordem em que o servidor os oferece é a ordem em que ele os considera, e
    escolher por conta própria faria a tela abrir num fator que aquela conta
    talvez nem use.
  */
  const [metodo, setMetodo] = useState<MetodoDeMfa>(metodos[0] ?? "senha");
  const [valor, setValor] = useState("");

  const fator = FATOR[metodo];
  const podeEnviar = valor.trim().length > 0 && !entrando;

  return (
    <div className={css.tela}>
      <form
        className={css.cartao}
        onSubmit={(e) => {
          e.preventDefault();
          if (podeEnviar) void responderMfa(metodo, valor.trim());
        }}
      >
        <h1 className={css.titulo}>Verificação em duas etapas</h1>

        {/*
          Só aparece quando há escolha. Um segmentado de uma opção é um rótulo
          disfarçado de controle — e um controle que não faz nada ensina a
          ignorar os que fazem.
        */}
        {metodos.length > 1 ? (
          <Segmentado
            rotulo="Como verificar"
            valor={metodo}
            desabilitado={entrando}
            opcoes={metodos.map((m) => ({ id: m, rotulo: FATOR[m].aba }))}
            aoEscolher={(id) => {
              setMetodo(id);
              // O valor NÃO sobrevive à troca: um código de app digitado no
              // campo de senha vira uma tentativa perdida e um erro confuso.
              setValor("");
            }}
          />
        ) : null}

        <Campo
          rotulo={fator.rotulo}
          dica={fator.dica}
          type={fator.tipo}
          /*
            `one-time-code` faz o gerenciador de senhas oferecer o código de
            recuperação guardado. Para a senha, é o campo normal da conta.
          */
          autoComplete={metodo === "senha" ? "current-password" : "one-time-code"}
          autoFocus
          required
          disabled={entrando}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />

        {/* O erro acima do botão, como na entrada: abaixo, ele fica fora do
            caminho do olho que já está indo para o alvo. */}
        {motivo ? (
          <p className={css.erro} role="alert">
            {motivo}
          </p>
        ) : null}

        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {entrando ? "Verificando…" : "Verificar"}
        </Botao>

        <Botao variante="sutil" onClick={cancelarMfa} disabled={entrando}>
          Usar outra conta
        </Botao>
      </form>
    </div>
  );
}
