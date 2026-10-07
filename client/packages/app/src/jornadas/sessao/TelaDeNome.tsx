import { useState } from "react";

import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { CampoDeTexto } from "./CampoDeTexto";
import css from "./Entrada.module.css";
import { MoldeDaEntrada } from "./MoldeDaEntrada";

export interface TelaDeNomeProps {
  /** Frase do último erro (o nome já existe, por exemplo), ainda na tela de nome. */
  motivo: string | undefined;
  salvando: boolean;
  aoEscolher: (nome: string) => void;
  aoCancelar: () => void;
}

/**
 * O primeiro acesso de uma conta sem nome de usuário.
 *
 * A sessão já vale (a pessoa está autenticada), mas entrar no app agora mostraria as
 * mensagens dela sem autor legível. É o único passo entre senha e shell que o
 * cadastro por outro cliente deixa para trás.
 */
export function TelaDeNome({ motivo, salvando, aoEscolher, aoCancelar }: TelaDeNomeProps) {
  const [nome, setNome] = useState("");
  const podeEnviar = nome.trim() !== "" && !salvando;

  return (
    <MoldeDaEntrada titulo={sessao.nome.titulo} subtitulo={sessao.nome.subtitulo}>
      <form
        className={css.formulario}
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          if (podeEnviar) aoEscolher(nome.trim());
        }}
      >
        <CampoDeTexto
          rotulo={sessao.nome.rotulo}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder={sessao.nome.exemplo}
          value={nome}
          readOnly={salvando}
          erro={motivo}
          onChange={(e) => setNome(e.target.value)}
        />
        <Botao type="submit" className={css.largo} carregando={salvando} disabled={!podeEnviar && !salvando}>
          {salvando ? sessao.nome.salvando : sessao.nome.continuar}
        </Botao>
        <Botao variante="fantasma" className={css.largo} disabled={salvando} onClick={aoCancelar}>
          {sessao.nome.outraConta}
        </Botao>
      </form>
    </MoldeDaEntrada>
  );
}
