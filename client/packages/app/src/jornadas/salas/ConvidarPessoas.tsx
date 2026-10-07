import { criarConvite } from "nucleo/sdk/servidores";
import { useEffect, useState } from "react";

import { salas } from "../../textos";
import { Botao } from "../../ui/ds";
import { Copiar } from "../../ui/icones";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import css from "./Salas.module.css";

export interface ConvidarPessoasProps {
  /** Convite é sempre de um canal; o servidor entra por ele. */
  canalId: string;
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
}

type Link = { para: string; endereco: string | undefined; falhou: boolean };

/** O link que o convite vira: a rota `/convite/:codigo` deste app. */
const enderecoDo = (codigo: string) => `${location.origin}/convite/${codigo}`;

/** Gera o convite ao abrir e mostra o link com um botão de copiar. */
export function ConvidarPessoas({ canalId, aberto, aoMudar }: ConvidarPessoasProps) {
  const [link, setLink] = useState<Link | undefined>();
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    void criarConvite(canalId).then((codigo) => {
      if (vivo) setLink({ para: canalId, endereco: codigo === undefined ? undefined : enderecoDo(codigo), falhou: codigo === undefined });
    });
    return () => {
      vivo = false;
    };
  }, [aberto, canalId]);

  // "Gerando" é derivado: o link guardado é de outro canal ou ainda não chegou.
  const atual = link?.para === canalId ? link : undefined;

  const copiar = () => {
    if (atual?.endereco === undefined) return;
    void navigator.clipboard.writeText(atual.endereco).then(() => {
      setCopiado(true);
    });
  };

  return (
    <Dialogo
      open={aberto}
      onOpenChange={(valor) => {
        if (!valor) {
          setLink(undefined);
          setCopiado(false);
        }
        aoMudar(valor);
      }}
    >
      <ConteudoDoDialogo titulo={salas.convite.titulo} descricao={salas.convite.descricao}>
        <div className={css.formulario}>
          {atual === undefined && (
            <p className={css.nota} role="status">
              {salas.convite.gerando}
            </p>
          )}
          {atual?.falhou === true && (
            <p className={css.erro} role="alert">
              {salas.convite.falhou}
            </p>
          )}
          {atual?.endereco !== undefined && (
            <>
              <input
                className={css.campo}
                readOnly
                value={atual.endereco}
                aria-label={salas.convite.rotuloDoLink}
                onFocus={(e) => {
                  e.currentTarget.select();
                }}
              />
              <div className={css.rodapeDoDialogo}>
                <Botao icone={<Copiar />} onClick={copiar}>
                  {copiado ? salas.convite.copiado : salas.convite.copiar}
                </Botao>
              </div>
            </>
          )}
        </div>
      </ConteudoDoDialogo>
    </Dialogo>
  );
}
