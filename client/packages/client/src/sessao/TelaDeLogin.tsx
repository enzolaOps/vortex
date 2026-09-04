import { useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Caixa } from "../components/ui/Marcador";
import { aindaNao } from "../pendente/pendencias";
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
  const [lembrar, setLembrar] = useState(true);

  const podeEnviar = email.trim().length > 0 && senha.length > 0 && !entrando;

  return (
    <main className={css.tela}>
      <div className={css.moldura}>
        {/*
          O painel de marca — DECORATIVO, e some abaixo de 900px por container
          query. É instrução literal do design: "o formulário nunca encolhe".
          `aria-hidden` porque nada aqui é acionável e o nome do produto já
          está no `h1` do formulário.
        */}
        <aside className={css.marca} aria-hidden>
          <div>
            <div className={css.marcaTopo}>
              <span className={css.ladrilho}>V</span>
              <span className={css.marcaNome}>Vortex</span>
            </div>
            <p className={css.chamada}>
              Conversa em tempo real para times que vivem no chat.
            </p>
            <p className={css.subchamada}>
              Servidores, cargos, permissões finas e voz &mdash; sem sair da
              mesma janela.
            </p>
          </div>

          <div className={css.pontos}>
            <span className={css.ponto}>
              <span className={css.tique}>&#10003;</span>
              Sincroniza web e desktop
            </span>
            <span className={css.ponto}>
              <span className={css.tique}>&#10003;</span>
              Permissões por canal e por membro
            </span>
          </div>
        </aside>

        <form
          className={css.forma}
          onSubmit={(evento) => {
            evento.preventDefault();
            if (!podeEnviar) return;
            void entrar(email.trim(), senha);
          }}
        >
          {/*
            ⚠ **"Bom te ver de novo" e não "Bem-vinda de volta", que é o texto
            do design.** Esta tela cumprimenta alguém de quem o app não sabe
            nada — nem o nome, quanto mais o gênero. O mesmo vale para "Manter
            conectada" mais abaixo. É a única divergência de COPY desta tela, e
            a razão é que acertar por sorte metade das vezes não é acertar.
          */}
          <h1 className={css.saudacao}>Bom te ver de novo</h1>
          <p className={css.instrucao}>Entre com seu e-mail.</p>

          {/*
            O erro fica ACIMA do formulário, não abaixo do botão.

            É o que o design manda, e a razão dele é boa: não sabemos qual dos
            dois campos está errado, então marcar um deles de vermelho seria
            uma acusação sem base. O banner diz o que houve sem apontar.

            `role="alert"` porque isto responde a uma ação que a pessoa ACABOU
            de fazer — interromper o leitor de tela é o certo aqui.
          */}
          {motivo ? (
            <Banner tom="perigo" role="alert" className={css.aviso}>
              {motivo}
            </Banner>
          ) : null}

          <Campo
            rotulo="E-mail"
            type="email"
            /* `username` e não `email`: é o que os gerenciadores de senha
               procuram, e errar aqui faz o preenchimento não oferecer nada. */
            autoComplete="username"
            autoFocus
            required
            disabled={entrando}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Campo
            rotulo="Senha"
            type="password"
            revelavel
            autoComplete="current-password"
            required
            disabled={entrando}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            acaoDoRotulo={
              <button
                type="button"
                className={css.esqueci}
                disabled={entrando}
                onClick={() => definirEntrada({ tipo: "recuperar" })}
              >
                Esqueci a senha
              </button>
            }
          />

          {/*
            ⚠ **A caixa está MARCADA por padrão, e isso reflete o que o app já
            faz.** A sessão é guardada em `localStorage` desde a fase 6 — sem
            escolha nenhuma. Nascer desmarcada faria o controle prometer um
            comportamento que o app não tem.
          */}
          <div className={css.lembrar}>
            <Caixa
              marcado={lembrar}
              disabled={entrando}
              aoAlternar={setLembrar}
            >
              Manter a sessão neste dispositivo
            </Caixa>
          </div>

          <Botao variante="primario" type="submit" disabled={!podeEnviar}>
            {entrando ? "Entrando…" : "Entrar"}
          </Botao>

          <div className={css.ou}>
            <span className={css.reguaDoOu} aria-hidden />
            <span className={css.rotuloDoOu}>ou</span>
            <span className={css.reguaDoOu} aria-hidden />
          </div>

          <Botao
            variante="sutil"
            disabled={entrando}
            onClick={aindaNao("entrarComQr")}
          >
            Continuar com código QR
          </Botao>

          <div className={css.folga} />

          <p className={css.rodape}>
            Não tem conta?{" "}
            <button
              type="button"
              className={css.trocarTela}
              disabled={entrando}
              onClick={() => definirEntrada({ tipo: "criar" })}
            >
              Cadastre-se
            </button>
          </p>

          {/*
            A entrada de desenvolvimento, VISÍVEL.

            Um portão que ninguém atravessa travaria o desenvolvimento inteiro
            quando não há servidor no ar. A alternativa — desligar o portão em
            dev — é pior: ele deixaria de ser exercitado justamente onde se
            trabalha, e atalho invisível sobrevive até produção sem ninguém
            notar. Este some do bundle: `import.meta.env.DEV` vira `false` e o
            bloco cai no tree-shaking.
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
      </div>
    </main>
  );
}
