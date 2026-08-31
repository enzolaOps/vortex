import { useEffect, useState } from "react";

import { Botao } from "../../components/ui/Botao";
import { EstadoVazio } from "../../components/ui/EstadoVazio";
import { copiarTexto } from "../../lib/copiar";
import { aindaNao } from "../../pendente/pendencias";
import {
  listarConvites,
  revogarConvite,
  type ConviteDoServidor,
} from "../../sdk/servidores";
import { administrar } from "../../store/administracao";
import { fecharConfig } from "../../store/config";
import { useChannel, usePessoa } from "../../store/hooks";
import secao from "../Secao.module.css";
import css from "./Canal.module.css";

/**
 * Os convites deste canal — TABELA, e não lista.
 *
 * ⚠ **Refeita contra o design renderizado.** Eu tinha entregue uma lista de
 * linhas com dois botões. Medido com `pnpm espelho`: é uma tabela de cinco
 * colunas (Código · Criador · Usos · Expira · ação), cabeçalho em `surface-1`
 * e linhas em `surface-3` separadas por véu a 5%, dentro de um cartão de raio
 * 10 com véu a 6%.
 *
 * A diferença importa porque a tabela responde uma pergunta que a lista não
 * respondia: *qual destes links vale a pena revogar*. Sem "usos" e "expira"
 * lado a lado, revogar é adivinhação.
 *
 * ⚠ **E é aí que está a divergência honesta: o protocolo não tem esses dois
 * campos.** `fetchInvites` devolve `ChannelInvite`, que carrega `id`,
 * `channelId` e `creatorId` — e nada de contagem de usos nem de validade. As
 * colunas ficam, porque a estrutura é o design; o conteúdo é um travessão, e
 * não um número inventado. É a mesma linha de "Conectado · 42 ms": numa
 * superfície onde a pessoa decide revogar, dado falso é pior que dado ausente.
 *
 * "Pausar todos" é pendente pelo mesmo motivo — pausar convite não existe no
 * protocolo.
 */
export function ConvitesDoCanal({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  const serverId = canal?.serverId;
  /* Três estados, e o "carregando" DERIVADO de para quem a resposta é — a
     mesma forma da tela de convites do servidor, e pela mesma razão: "não deu
     para saber" não pode virar "não há nenhum", e zerar num efeito é
     `setState` em cascata. Ver `listarConvites`. */
  const [res, setRes] = useState<
    | { readonly para: string; readonly dados: readonly ConviteDoServidor[] | "falhou" }
    | undefined
  >(undefined);
  const lista =
    serverId !== undefined && res?.para === serverId ? res.dados : "carregando";

  useEffect(() => {
    if (!serverId) return;
    let vivo = true;
    void listarConvites(serverId).then((l) => {
      if (vivo) setRes({ para: serverId, dados: l ?? "falhou" });
    });
    return () => {
      vivo = false;
    };
  }, [serverId]);

  if (!canal) {
    return <p className={secao.recado}>Abra um canal para ver isto.</p>;
  }
  if (!serverId) {
    return (
      <p className={secao.recado}>
        Conversas diretas não têm convite — quem entra é quem você adiciona.
      </p>
    );
  }

  const deste =
    typeof lista === "string"
      ? undefined
      : lista.filter((c) => c.canal === canal.name);

  return (
    /* 720 é a largura desta tela no design. */
    <div
      className={`${secao.forma} ${secao.larga}`}
      style={{ "--vx-editor-w": "720px" } as React.CSSProperties}
    >
      <header className={css.convitesTopo}>
        <span className={css.cartaoTexto}>
          <span className={css.cartaoTitulo}>Convites</span>
          <span className={css.cartaoDetalhe}>
            {lista === "carregando"
              ? "Carregando…"
              : deste === undefined
                ? "O servidor não respondeu"
                : `${deste.length} ativo${deste.length === 1 ? "" : "s"} para este canal`}
          </span>
        </span>
        <div className={css.convitesAcoes}>
          <Botao variante="sutil" onClick={aindaNao("pausarConvites")}>
            Pausar todos
          </Botao>
          <Botao
            variante="primario"
            onClick={() => {
              /* Fecha antes: o modal vive na camada `sobreposto`, abaixo
                 desta tela. Mesma razão da tela de convites do servidor. */
              fecharConfig();
              administrar({ tipo: "convite", channelId });
            }}
          >
            Criar convite
          </Botao>
        </div>
      </header>

      {lista === "falhou" ? (
        <EstadoVazio
          compacto
          titulo="Não deu para ler os convites"
          detalhe="O servidor não respondeu. Pode haver convites ativos que não estão aqui."
        />
      ) : deste !== undefined && deste.length === 0 ? (
        <EstadoVazio
          compacto
          titulo="Nenhum convite para este canal"
          detalhe="Crie um para deixar alguém entrar direto aqui."
        />
      ) : (
        <div className={css.tabela} role="table" aria-label="Convites do canal">
          <div className={css.tabelaCabecalho} role="row">
            <span role="columnheader">Código</span>
            <span role="columnheader">Criador</span>
            <span role="columnheader">Usos</span>
            <span role="columnheader">Expira</span>
            <span role="columnheader" className={css.colunaOculta}>
              Ação
            </span>
          </div>
          {deste?.map((c) => (
            <LinhaDeConvite
              key={c.codigo}
              convite={c}
              aoRevogar={() => {
                void revogarConvite(serverId, c.codigo).then((ok) => {
                  if (!ok) return;
                  setRes((r) =>
                    r === undefined || typeof r.dados === "string"
                      ? r
                      : {
                          ...r,
                          dados: r.dados.filter((x) => x.codigo !== c.codigo),
                        },
                  );
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaDeConvite({
  convite,
  aoRevogar,
}: {
  convite: ConviteDoServidor;
  aoRevogar: () => void;
}) {
  const criador = usePessoa(convite.porId);

  return (
    <div className={css.tabelaLinha} role="row">
      {/*
        O código é MONO e clicável: ele existe para ser copiado, e num link de
        convite a diferença entre `oldX1` e `o1dXl` decide se a pessoa entra.
        Mono é o que torna essa diferença visível.
      */}
      <button
        type="button"
        className={css.codigoDoConvite}
        role="cell"
        onClick={() =>
          void copiarTexto(
            `${window.location.origin}/convite/${convite.codigo}`,
            "Link do convite",
          )
        }
      >
        {convite.codigo}
      </button>
      <span role="cell" className={css.celula}>
        {criador?.displayName ?? "—"}
      </span>
      {/*
        Travessão, e não um número. `ChannelInvite` não carrega usos nem
        validade — ver o comentário do componente.
      */}
      <span role="cell" className={css.celulaAusente} title="O protocolo não informa">
        —
      </span>
      <span role="cell" className={css.celulaAusente} title="O protocolo não informa">
        —
      </span>
      <span role="cell">
        <button type="button" className={css.revogar} onClick={aoRevogar}>
          Revogar
        </button>
      </span>
    </div>
  );
}
