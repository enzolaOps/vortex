import { useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { escolherNome } from "../sdk/conta";
import { sair } from "../sdk/autenticacao";
import css from "./TelaDeLogin.module.css";

/**
 * Escolher o nome de usuário, logo depois de criar a conta.
 *
 * ⚠ **As duas rotas que isto usa não existem no SDK** — `GET /onboard/hello` e
 * `POST /onboard/complete` são chamadas cruas por `sdk/conta.ts`, como o
 * cliente Solid também faz.
 *
 * Sem esta tela, uma conta nova entra sem nome: as mensagens saem sem autor
 * legível e a member list mostra um ID de 26 caracteres. O passo é obrigatório
 * no protocolo, não uma cortesia de boas-vindas.
 */
export function TelaDeNome({ motivo }: { motivo: string | undefined }) {
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);

  const limpo = nome.trim();
  const podeEnviar = limpo.length > 0 && !enviando;

  return (
    <div className={css.tela}>
      <form
        className={css.cartao}
        onSubmit={(e) => {
          e.preventDefault();
          if (!podeEnviar) return;
          setEnviando(true);
          void escolherNome(limpo).finally(() => setEnviando(false));
        }}
      >
        <h1 className={css.titulo}>Escolha seu nome</h1>

        <p className={css.recado}>
          É assim que as outras pessoas vão te ver. Dá para mudar depois.
        </p>

        <Campo
          rotulo="Nome de usuário"
          /* O erro mais comum aqui é o nome já estar em uso, e a dica prepara
             para isso em vez de deixar a pessoa descobrir só ao enviar. */
          dica="Letras, números e underscore. Se já estiver em uso, o servidor avisa."
          autoComplete="username"
          autoFocus
          required
          disabled={enviando}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        {motivo ? (
          <Banner tom="perigo" role="alert">
            {motivo}
          </Banner>
        ) : null}

        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {enviando ? "Salvando…" : "Continuar"}
        </Botao>

        {/*
          Sair daqui é possível, e precisa ser: a sessão JÁ vale, então sem esta
          saída uma pessoa que abriu a conta errada ficaria presa numa tela sem
          nenhum caminho para trás.
        */}
        <Botao variante="sutil" onClick={() => void sair()} disabled={enviando}>
          Sair
        </Botao>
      </form>
    </div>
  );
}
