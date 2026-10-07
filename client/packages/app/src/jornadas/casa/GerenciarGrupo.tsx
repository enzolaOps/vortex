import { usuarioLocalId } from "nucleo/sdk/adapter";
import {
  adicionarAoGrupo,
  lerGrupo,
  removerDoGrupo,
  renomearGrupo,
  sairDaConversa,
  transferirGrupo,
} from "nucleo/sdk/social";
import { irParaAmigos } from "nucleo/store/navegacao";
import { useChannel, usePessoa, useRelacao } from "nucleo/store/hooks";
import { useState, type FormEvent } from "react";

import { casa } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import css from "./Formulario.module.css";

function MembroDoGrupo({
  id,
  donoId,
  souDono,
  ocupado,
  aoRemover,
  aoTransferir,
}: {
  id: string;
  donoId: string;
  souDono: boolean;
  ocupado: boolean;
  aoRemover: () => void;
  aoTransferir: () => void;
}) {
  const pessoa = usePessoa(id);
  const euId = usuarioLocalId();
  const nome = pessoa?.displayName ?? casa.grupo.voce;
  return (
    <li className={css.pessoa}>
      <Avatar nome={nome} id={id} tamanho={28} />
      <span className={css.pessoaNome}>{id === euId ? `${nome} (${casa.grupo.voce})` : nome}</span>
      {id === donoId && <span className={css.etiqueta}>{casa.grupo.donoDoGrupo}</span>}
      {souDono && id !== euId && (
        <>
          <Botao variante="fantasma" tamanho="sm" disabled={ocupado} aria-label={casa.grupo.transferir(nome)} onClick={aoTransferir}>
            {casa.grupo.acaoTransferir}
          </Botao>
          <Botao variante="fantasma" tamanho="sm" disabled={ocupado} aria-label={casa.grupo.remover(nome)} onClick={aoRemover}>
            {casa.grupo.acaoRemover}
          </Botao>
        </>
      )}
    </li>
  );
}

function AmigoParaAdicionar({ id, aoAdicionar, ocupado }: { id: string; aoAdicionar: () => void; ocupado: boolean }) {
  const pessoa = usePessoa(id);
  if (!pessoa) return null;
  return (
    <li className={css.pessoa}>
      <Avatar nome={pessoa.displayName} id={id} tamanho={28} />
      <span className={css.pessoaNome}>{pessoa.displayName}</span>
      <Botao variante="secundario" tamanho="sm" disabled={ocupado} onClick={aoAdicionar}>
        {casa.grupo.adicionar}
      </Botao>
    </li>
  );
}

export interface GerenciarGrupoProps {
  canalId: string;
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
}

/**
 * Gerenciar o grupo: renomear, ver quem está, adicionar entre os amigos e, sendo
 * dono, remover ou passar o grupo; qualquer pessoa pode sair.
 *
 * A lista de quem está no grupo é leitura direta do núcleo (muda por ação humana
 * e o painel só existe aberto); `useChannel` acorda o diálogo quando a contagem
 * de pessoas muda, e é aí que a leitura se refaz.
 */
export function GerenciarGrupo({ canalId, aberto, aoMudar }: GerenciarGrupoProps) {
  const canal = useChannel(canalId);
  const amigos = useRelacao("amigo");
  const [nome, setNome] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const grupo = lerGrupo(canalId);

  if (!canal || !grupo) return null;
  const souDono = grupo.donoId === usuarioLocalId();
  const nomeAtual = nome ?? grupo.nome;
  const paraAdicionar = amigos.filter((id) => !grupo.membrosIds.includes(id));

  const executar = async (acao: () => Promise<boolean>): Promise<boolean> => {
    setOcupado(true);
    const ok = await acao();
    setOcupado(false);
    return ok;
  };

  const salvarNome = async (e: FormEvent) => {
    e.preventDefault();
    const limpo = nomeAtual.trim();
    if (limpo === "" || limpo === grupo.nome) return;
    await executar(() => renomearGrupo(canalId, limpo));
  };

  return (
    <Dialogo
      open={aberto}
      onOpenChange={(a) => {
        if (!a) setNome(undefined);
        aoMudar(a);
      }}
    >
      <ConteudoDoDialogo titulo={casa.grupo.gerenciar} descricao={casa.grupo.gerenciarDescricao}>
        <div className={css.formulario}>
          <form
            className={css.linhaDoNome}
            onSubmit={(e) => {
              void salvarNome(e);
            }}
          >
            <label className={css.rotulo}>
              {casa.grupo.rotuloDoNome}
              <input
                className={css.campo}
                value={nomeAtual}
                maxLength={32}
                onChange={(e) => {
                  setNome(e.target.value);
                }}
              />
            </label>
            <Botao type="submit" variante="secundario" carregando={ocupado} disabled={nomeAtual.trim() === "" || nomeAtual.trim() === grupo.nome}>
              {casa.grupo.salvarNome}
            </Botao>
          </form>

          <section className={css.secao} aria-label={casa.grupo.pessoasDoGrupo}>
            <h3 className={css.secaoTitulo}>{casa.grupo.pessoasDoGrupo}</h3>
            <ul className={css.pessoas}>
              {grupo.membrosIds.map((id) => (
                <MembroDoGrupo
                  key={id}
                  id={id}
                  donoId={grupo.donoId}
                  souDono={souDono}
                  ocupado={ocupado}
                  aoRemover={() => {
                    void executar(() => removerDoGrupo(canalId, id));
                  }}
                  aoTransferir={() => {
                    void executar(() => transferirGrupo(canalId, id));
                  }}
                />
              ))}
            </ul>
          </section>

          <section className={css.secao} aria-label={casa.grupo.adicionar}>
            <h3 className={css.secaoTitulo}>{casa.grupo.adicionar}</h3>
            {paraAdicionar.length === 0 ? (
              <p className={css.nota}>{casa.grupo.adicionarNenhum}</p>
            ) : (
              <ul className={css.pessoas}>
                {paraAdicionar.map((id) => (
                  <AmigoParaAdicionar
                    key={id}
                    id={id}
                    ocupado={ocupado}
                    aoAdicionar={() => {
                      void executar(() => adicionarAoGrupo(canalId, id));
                    }}
                  />
                ))}
              </ul>
            )}
          </section>

          <div className={css.rodape}>
            <Botao
              variante="perigo"
              carregando={ocupado}
              onClick={() => {
                void executar(() => sairDaConversa(canalId)).then((ok) => {
                  if (!ok) return;
                  aoMudar(false);
                  irParaAmigos("amigo");
                });
              }}
            >
              {casa.grupo.sair}
            </Botao>
          </div>
        </div>
      </ConteudoDoDialogo>
    </Dialogo>
  );
}
