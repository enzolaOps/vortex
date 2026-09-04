import { useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { sair } from "../sdk/autenticacao";
import {
  administraServidor,
  lerMeuPerfil,
  trocarEmail,
  trocarNomeDeUsuario,
  trocarSenha,
} from "../sdk/perfil";
import { abrirModal } from "../store/modais";
import css from "./Secao.module.css";

/**
 * Nome de usuário, e-mail, senha e sair.
 *
 * As três primeiras exigem a senha atual, e o protocolo é quem manda nisso —
 * com razão: são as três que, mudadas por uma sessão esquecida em outro
 * computador, tomam a conta sem nunca tocar na senha.
 *
 * Cada uma tem o próprio botão porque cada uma é uma chamada independente que
 * pode falhar sozinha. Aqui um botão só seria pior: uma senha errada faria
 * perder o e-mail digitado também.
 */
export function Conta() {
  const [perfil] = useState(() => lerMeuPerfil());

  if (!perfil) {
    return <p className={css.recado}>Entre na sua conta para editá-la.</p>;
  }

  return (
    <div className={css.forma}>
      <TrocarNome atual={perfil.username} />
      <hr className={css.divisor} />
      <TrocarEmail />
      <hr className={css.divisor} />
      <TrocarSenha />
      <hr className={css.divisor} />

      <section className={css.bloco}>
        <h2 className={css.subtitulo}>Sair</h2>
        <p className={css.recado}>
          Encerra a sessão deste dispositivo. Os outros continuam conectados —
          use "Dispositivos" para derrubá-los.
        </p>
        <div className={css.acoes}>
          <Botao variante="neutro" onClick={() => void sair()}>
            Sair desta conta
          </Botao>
        </div>
      </section>

      <hr className={css.divisor} />
      <ZonaDePerigo />
    </div>
  );
}

function ZonaDePerigo() {
  const dono = administraServidor();

  return (
    <section className={css.bloco}>
      <h2 className={css.subtitulo}>Zona de perigo</h2>
      <p className={css.recado}>
        {dono
          ? "Transfira ou exclua os servidores que você administra antes de excluir a conta."
          : "A exclusão é permanente. Um e-mail pede a confirmação; depois disso há 7 dias para cancelar."}
      </p>
      <div className={css.acoes}>
        <Botao
          variante="perigoSutil"
          disabled={dono}
          onClick={() => abrirModal("excluirConta")}
        >
          Excluir minha conta
        </Botao>
      </div>
    </section>
  );
}

function TrocarNome({ atual }: { atual: string }) {
  const [nome, setNome] = useState(atual);
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  const mudou = nome.trim() !== atual && nome.trim().length > 0;
  const podeEnviar = mudou && senha.length > 0 && !enviando;

  return (
    <form
      className={css.bloco}
      onSubmit={(e) => {
        e.preventDefault();
        if (!podeEnviar) return;
        setEnviando(true);
        void trocarNomeDeUsuario(nome.trim(), senha)
          .then((ok) => {
            // A senha some sempre, tenha dado certo ou não: deixá-la no campo
            // seria guardar a credencial na tela até a pessoa navegar.
            if (ok) setSenha("");
          })
          .finally(() => {
            setSenha("");
            setEnviando(false);
          });
      }}
    >
      <h2 className={css.subtitulo}>Nome de usuário</h2>
      <p className={css.recado}>
        É por ele que as pessoas te adicionam. Trocar exige a senha.
      </p>
      <Campo
        rotulo="Nome de usuário"
        autoComplete="username"
        disabled={enviando}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      {/* O campo de senha só aparece quando há o que confirmar: pedir senha
          antes de a pessoa ter mudado alguma coisa é ruído. */}
      {mudou ? (
        <Campo
          rotulo="Senha atual"
          type="password"
          autoComplete="current-password"
          disabled={enviando}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      ) : null}
      <div className={css.acoes}>
        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {enviando ? "Salvando…" : "Trocar nome"}
        </Botao>
      </div>
    </form>
  );
}

function TrocarEmail() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  const podeEnviar = email.trim().length > 0 && senha.length > 0 && !enviando;

  return (
    <form
      className={css.bloco}
      onSubmit={(e) => {
        e.preventDefault();
        if (!podeEnviar) return;
        setEnviando(true);
        void trocarEmail(email.trim(), senha)
          .then((ok) => {
            if (ok) setEmail("");
          })
          .finally(() => {
            setSenha("");
            setEnviando(false);
          });
      }}
    >
      <h2 className={css.subtitulo}>E-mail</h2>
      {/* O e-mail ATUAL não aparece: `fetchEmail` é uma chamada própria, e
          mostrar um campo vazio é mais honesto que mostrar um errado. */}
      <p className={css.recado}>
        O endereço novo recebe um link de confirmação antes de valer.
      </p>
      <Campo
        rotulo="Novo e-mail"
        type="email"
        autoComplete="email"
        disabled={enviando}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Campo
        rotulo="Senha atual"
        type="password"
        autoComplete="current-password"
        disabled={enviando}
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
      />
      <div className={css.acoes}>
        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {enviando ? "Salvando…" : "Trocar e-mail"}
        </Botao>
      </div>
    </form>
  );
}

function TrocarSenha() {
  const [nova, setNova] = useState("");
  const [atual, setAtual] = useState("");
  const [enviando, setEnviando] = useState(false);

  const curta = nova.length > 0 && nova.length < 8;
  const podeEnviar = nova.length >= 8 && atual.length > 0 && !enviando;

  return (
    <form
      className={css.bloco}
      onSubmit={(e) => {
        e.preventDefault();
        if (!podeEnviar) return;
        setEnviando(true);
        void trocarSenha(nova, atual)
          .then((ok) => {
            if (ok) setNova("");
          })
          .finally(() => {
            setAtual("");
            setEnviando(false);
          });
      }}
    >
      <h2 className={css.subtitulo}>Senha</h2>
      <Campo
        rotulo="Nova senha"
        type="password"
        autoComplete="new-password"
        dica="Pelo menos 8 caracteres."
        erro={curta ? "Curta demais — mínimo de 8 caracteres." : undefined}
        disabled={enviando}
        value={nova}
        onChange={(e) => setNova(e.target.value)}
      />
      <Campo
        rotulo="Senha atual"
        type="password"
        autoComplete="current-password"
        disabled={enviando}
        value={atual}
        onChange={(e) => setAtual(e.target.value)}
      />
      <div className={css.acoes}>
        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {enviando ? "Salvando…" : "Trocar senha"}
        </Botao>
      </div>
    </form>
  );
}
