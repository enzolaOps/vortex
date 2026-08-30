import { useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { definirEntrada } from "../store/entrada";
import { definirUsuarioLocal } from "../sdk/adapter";
import { entrar } from "../sdk/autenticacao";

/**
 * O "eu" do arnês — o mesmo que o firehose usa.
 *
 * Duplicado aqui e não importado de `dev/firehose`: aquele módulo puxa o
 * gerador de dados inteiro, e a tela de login não deve carregar dez mil
 * mensagens de mentira para desenhar dois campos.
 */
const USUARIO_DO_ARNES = "01JQ0000000000000001000000";
import css from "./TelaDeLogin.module.css";

/**
 * A tela de entrada.
 *
 * **É a primeira coisa que alguém vê do Vortex**, e a única superfície do app
 * onde a pessoa ainda não investiu nada — quem não consegue entrar não volta.
 * Por isso ela é curta: dois campos, um botão, e o erro dito em português.
 *
 * `<form>` de verdade, e não um `<div>` com botão: Enter no campo envia,
 * gerenciador de senha reconhece os campos, e o navegador oferece preencher.
 * Reimplementar isso à mão é a definição de escrever o genérico que a
 * plataforma já resolve.
 */
export function TelaDeLogin({
  entrando,
  motivo,
}: {
  /** Login em voo: o botão vira `loading` e os campos travam. */
  entrando: boolean;
  /** O que deu errado da última vez, já traduzido. */
  motivo: string | undefined;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const podeEnviar = email.trim().length > 0 && senha.length > 0 && !entrando;

  return (
    <main className={css.tela}>
      <form
        className={css.cartao}
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!podeEnviar) return;
          void entrar(email.trim(), senha);
        }}
      >
        <h1 className={css.titulo}>Vortex</h1>

        <Campo
          rotulo="E-mail"
          type="email"
          /* `username` e não `email`: é o que os gerenciadores de senha
             procuram, e errar aqui faz o preenchimento automático não
             oferecer nada. */
          autoComplete="username"
          /* O foco começa aqui: abrir a tela já pronta para digitar poupa um
             clique em cada abertura, e é o primeiro gesto de qualquer um. */
          autoFocus
          required
          disabled={entrando}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Campo
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          required
          disabled={entrando}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {/*
          O erro fica ACIMA do botão, não abaixo.

          Abaixo, ele aparece fora do caminho do olho que já está indo para o
          botão — e num formulário curto a pessoa reenvia sem ter lido. Acima,
          ela atravessa a mensagem para chegar ao alvo.

          `role="alert"` aqui, ao contrário da faixa de conexão: isto é
          resposta a uma ação que a pessoa ACABOU de fazer, e interromper o
          leitor de tela é o comportamento certo.
        */}
        {motivo ? (
          <Banner tom="perigo" role="alert">
            {motivo}
          </Banner>
        ) : null}

        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {entrando ? "Entrando…" : "Entrar"}
        </Botao>

        {/*
          As duas saídas da tela, e elas não são enfeite.

          Sem "Criar conta", o app só serve a quem já tem conta feita por outro
          cliente — o que o mapa de superfícies registrou como a consequência
          mais grave da autenticação incompleta. Sem "Esqueci a senha", quem
          perdeu o acesso não tem nada a fazer aqui.

          `sutil` e não `primario`: a ação principal desta tela é entrar, e três
          botões com o mesmo peso não têm ação principal nenhuma.
        */}
        <div className={css.saidas}>
          <Botao
            variante="sutil"
            disabled={entrando}
            onClick={() => definirEntrada({ tipo: "criar" })}
          >
            Criar conta
          </Botao>
          <Botao
            variante="sutil"
            disabled={entrando}
            onClick={() => definirEntrada({ tipo: "recuperar" })}
          >
            Esqueci a senha
          </Botao>
        </div>

        {/*
          A entrada de desenvolvimento, VISÍVEL.

          Não há backend alcançável deste repositório, então o formulário acima
          não tem a quem perguntar — e um portão que ninguém consegue
          atravessar travaria o desenvolvimento inteiro.

          A alternativa era o portão se desligar em dev, e ela é pior por dois
          motivos: o portão deixaria de ser exercitado justamente onde se
          trabalha, e um atalho invisível é o tipo de coisa que sobrevive até
          produção sem ninguém notar. Este some do bundle — `import.meta.env.DEV`
          é substituído por `false` e o bloco inteiro cai no tree-shaking.
        */}
        {import.meta.env.DEV ? (
          <button
            type="button"
            className={css.semServidor}
            onClick={() => definirUsuarioLocal(USUARIO_DO_ARNES)}
          >
            entrar sem servidor (desenvolvimento)
          </button>
        ) : null}
      </form>
    </main>
  );
}
