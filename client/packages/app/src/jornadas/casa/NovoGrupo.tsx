import { criarGrupo } from "nucleo/sdk/social";
import { abrirConversa } from "nucleo/store/navegacao";
import { usePessoa, useRelacao } from "nucleo/store/hooks";
import { useState, type FormEvent } from "react";

import { casa, comum } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import css from "./Formulario.module.css";

function PessoaParaEscolher({
  id,
  marcada,
  aoMudar,
}: {
  id: string;
  marcada: boolean;
  aoMudar: (marcada: boolean) => void;
}) {
  const pessoa = usePessoa(id);
  if (!pessoa) return null;
  return (
    <li>
      <label className={css.pessoa}>
        <input
          type="checkbox"
          checked={marcada}
          onChange={(e) => {
            aoMudar(e.target.checked);
          }}
        />
        <Avatar nome={pessoa.displayName} id={id} tamanho={28} />
        <span className={css.pessoaNome}>{pessoa.displayName}</span>
      </label>
    </li>
  );
}

export interface NovoGrupoProps {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
}

/** Criar um grupo: nome e as pessoas, escolhidas entre os amigos. */
export function NovoGrupo({ aberto, aoMudar }: NovoGrupoProps) {
  const amigos = useRelacao("amigo");
  const [nome, setNome] = useState("");
  const [escolhidos, setEscolhidos] = useState<readonly string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | undefined>();

  const fechar = (aberto: boolean) => {
    if (!aberto) {
      setNome("");
      setEscolhidos([]);
      setErro(undefined);
    }
    aoMudar(aberto);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const limpo = nome.trim();
    if (limpo === "") {
      setErro(casa.grupo.nomeObrigatorio);
      return;
    }
    if (escolhidos.length === 0) {
      setErro(casa.grupo.escolhaAlguem);
      return;
    }
    setEnviando(true);
    setErro(undefined);
    const id = await criarGrupo(limpo, escolhidos);
    setEnviando(false);
    if (id === undefined) {
      setErro(casa.grupo.falhou);
      return;
    }
    fechar(false);
    abrirConversa(id);
  };

  return (
    <Dialogo open={aberto} onOpenChange={fechar}>
      <ConteudoDoDialogo titulo={casa.grupo.titulo} descricao={casa.grupo.descricao}>
        <form
          className={css.formulario}
          onSubmit={(e) => {
            void enviar(e);
          }}
        >
          <label className={css.rotulo}>
            {casa.grupo.rotuloDoNome}
            <input
              className={css.campo}
              value={nome}
              maxLength={32}
              autoFocus
              aria-invalid={erro !== undefined && nome.trim() === ""}
              onChange={(e) => {
                setNome(e.target.value);
              }}
            />
          </label>
          <fieldset className={css.secao}>
            <legend className={css.secaoTitulo}>{casa.grupo.pessoas}</legend>
            {amigos.length === 0 ? (
              <p className={css.nota}>{casa.grupo.semAmigos}</p>
            ) : (
              <ul className={css.pessoas}>
                {amigos.map((id) => (
                  <PessoaParaEscolher
                    key={id}
                    id={id}
                    marcada={escolhidos.includes(id)}
                    aoMudar={(marcada) => {
                      setEscolhidos((atuais) => (marcada ? [...atuais, id] : atuais.filter((x) => x !== id)));
                    }}
                  />
                ))}
              </ul>
            )}
          </fieldset>
          {erro !== undefined && (
            <p className={css.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={css.rodape}>
            <Botao
              variante="fantasma"
              onClick={() => {
                fechar(false);
              }}
            >
              {comum.cancelar}
            </Botao>
            <Botao type="submit" carregando={enviando}>
              {casa.grupo.criar}
            </Botao>
          </div>
        </form>
      </ConteudoDoDialogo>
    </Dialogo>
  );
}
