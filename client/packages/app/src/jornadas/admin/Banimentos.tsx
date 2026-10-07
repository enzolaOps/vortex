import { listarBanidos, perdoar, type Banido } from "nucleo/sdk/servidores";
import { useEffect, useState } from "react";

import { admin } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import { toast } from "../../ui/primitivos/Avisos";
import css from "./admin.module.css";
import { Carregando, Falhou, Vazio } from "./Estados";

type Lista = { readonly para: string; readonly revisao: number; readonly lista: readonly Banido[] | undefined };

/** Banimentos (PRD 4.7): quem foi banido, o motivo e o perdão. */
export function Banimentos({ serverId }: { serverId: string }) {
  const [revisao, setRevisao] = useState(0);
  const [resposta, setResposta] = useState<Lista | undefined>();
  const [perdoando, setPerdoando] = useState<string | undefined>();

  useEffect(() => {
    let vivo = true;
    void listarBanidos(serverId).then((lista) => {
      if (vivo) setResposta({ para: serverId, revisao, lista });
    });
    return () => {
      vivo = false;
    };
  }, [serverId, revisao]);

  const atual = resposta?.para === serverId && resposta.revisao === revisao ? resposta : undefined;

  const perdoarPessoa = async (b: Banido) => {
    setPerdoando(b.userId);
    const ok = await perdoar(serverId, b.userId);
    setPerdoando(undefined);
    if (ok) {
      toast({ tipo: "info", titulo: admin.banimentosPagina.perdoada(b.nome) });
      setRevisao((r) => r + 1);
    }
  };

  return (
    <div className={css.pagina}>
      {atual === undefined ? (
        <Carregando texto={admin.banimentosPagina.carregando} />
      ) : atual.lista === undefined ? (
        <Falhou
          texto={admin.banimentosPagina.erro}
          aoTentar={() => {
            setRevisao((r) => r + 1);
          }}
        />
      ) : atual.lista.length === 0 ? (
        <Vazio titulo={admin.banimentosPagina.vazio} texto={admin.banimentosPagina.vazioDica} />
      ) : (
        <ul
          className={css.tabela}
          aria-label={admin.navegacao.banimentos}
          style={{ ["--colunas" as string]: "minmax(0,1fr) minmax(0,1.2fr) auto" }}
        >
          <li className={css.cabecalhoDaTabela} aria-hidden="true">
            <span>{admin.membrosPagina.pessoa}</span>
            <span>{admin.banimentosPagina.razao}</span>
            <span />
          </li>
          {atual.lista.map((b) => (
            <li key={b.userId} className={css.linha} data-testid="linha-de-banido" data-pessoa={b.userId}>
              <span className={css.pessoa}>
                <Avatar nome={b.nome} id={b.userId} tamanho={28} />
                <span className={css.pessoaNome}>{b.nome}</span>
              </span>
              <span className={`${css.celula} ${b.razao === undefined ? css.meta : ""}`}>
                {b.razao ?? admin.banimentosPagina.semRazao}
              </span>
              <span className={css.acoesDaLinha}>
                <Botao
                  variante="secundario"
                  tamanho="sm"
                  aria-label={admin.banimentosPagina.perdoarPessoa(b.nome)}
                  carregando={perdoando === b.userId}
                  onClick={() => {
                    void perdoarPessoa(b);
                  }}
                >
                  {admin.banimentosPagina.perdoar}
                </Botao>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
