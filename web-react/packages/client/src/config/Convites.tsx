import { useEffect, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { cn } from "../lib/cn";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { copiarTexto } from "../lib/copiar";
import {
  listarConvites,
  revogarConvite,
  type ConviteDoServidor,
} from "../sdk/servidores";
import { chaveDeMembro } from "../sdk/domain";
import { useCanaisDeTexto, useMembro } from "../store/hooks";
import { administrar } from "../store/administracao";
import { fecharConfig } from "../store/config";
import css from "./Convites.module.css";
import tab from "./Tabela.module.css";

/** O que a consulta devolveu: a lista, ou a notícia de que não deu. */
type Resposta = readonly ConviteDoServidor[] | "falhou";

/**
 * Quem criou o convite. Assina a própria pessoa.
 *
 * ⚠ **`creator` é o ÚNICO dos três campos que o design pede e o protocolo
 * tem.** `uses`, `max_uses`, `expires_at`, `temporary` e `vanity` dão zero
 * ocorrências no schema do Stoat — o `Invite` carrega `_id`, `server`,
 * `creator` e `channel`, e nada mais. Ver `sdk/servidores.ts`.
 */
function Criador({ serverId, userId }: { serverId: string; userId: string }) {
  const membro = useMembro(chaveDeMembro(serverId, userId));

  return (
    <span className={tab.pessoa}>
      <Avatar id={userId} sigla={membro?.sigla} tamanho="xxs" />
      <span className={tab.meta}>{membro?.displayName ?? "alguém"}</span>
    </span>
  );
}

/**
 * Os convites do servidor.
 *
 * ⚠ **Convite é de CANAL, não de servidor** — não existe
 * `Server.createInvite`, e quem entra por um convite cai no canal dele. É por
 * isso que a lista mostra o canal de cada um: dois convites do mesmo servidor
 * levam a lugares diferentes, e revogar o errado é fácil sem essa coluna.
 *
 * Criar abre o modal de convite, que já existe e já mostra o link pronto para
 * copiar — a mesma superfície do menu de contexto do canal. Duas telas para
 * criar a mesma coisa divergiriam.
 *
 * ⚠ **Três colunas do design ficaram de fora, e a razão é medida:** usos,
 * validade e a vanity URL não existem no protocolo. O rodapé da página diz
 * isso em vez de a tabela mostrar traços onde deveria haver número.
 */
export function Convites({ serverId }: { serverId: string }) {
  /*
    ⚠ **Três estados, e não dois.** "Ainda não sei", "não há nenhum" e "não deu
    para saber" são respostas diferentes, e a versão anterior fundia as duas
    últimas em `[]` — a página dizia "Nenhum convite ativo" enquanto o toast
    dizia que a consulta falhou. Ver `listarConvites`.

    ⚠ **O "carregando" é DERIVADO do servidor pedido, não escrito por um
    efeito.** Zerar o estado num `useEffect` é `setState` em cascata, e o lint
    do projeto reprova; guardar PARA QUEM a resposta é resolve o mesmo problema
    sem render extra — trocar de servidor volta a "carregando" sozinho, porque
    a resposta guardada deixa de ser sobre este.
  */
  const [res, setRes] = useState<
    { readonly para: string; readonly dados: Resposta } | undefined
  >(undefined);
  const lista: Resposta | "carregando" =
    res?.para === serverId ? res.dados : "carregando";
  const canais = useCanaisDeTexto(serverId);
  const [ocupado, setOcupado] = useState(false);

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

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  return (
    <div className={css.pagina}>
      <div className={css.controles}>
        <p className={css.recado}>
          Cada convite leva a um canal. Quem abre o link entra no servidor e cai
          naquele canal.
        </p>
        <span className={css.espaco} />
        <Botao
          variante="primario"
          disabled={canais.length === 0}
          onClick={() => {
            const canal = canais[0];
            if (!canal) return;
            fecharConfig();
            administrar({ tipo: "convite", channelId: canal });
          }}
        >
          Criar convite
        </Botao>
      </div>

      {lista === "carregando" ? (
        <p className={css.recado}>Carregando…</p>
      ) : lista === "falhou" ? (
        <div className={cn(tab.tabela, css.tabela)}>
          <div className={tab.vazio}>
            <EstadoVazio
              compacto
              titulo="Não deu para ler os convites"
              detalhe="O servidor não respondeu. Pode haver convites ativos que não estão aqui."
            />
          </div>
        </div>
      ) : lista.length === 0 ? (
        <div className={cn(tab.tabela, css.tabela)}>
          <div className={tab.vazio}>
            <EstadoVazio
              compacto
              titulo="Nenhum convite ativo"
              detalhe="Crie um para deixar alguém entrar."
            />
          </div>
        </div>
      ) : (
        <div className={`${tab.tabela} ${css.tabela}`} role="table">
          <div className={tab.cabecalho} role="row">
            <span>Código</span>
            <span>Criador</span>
            <span>Canal</span>
            <span />
          </div>

          {lista.map((c) => (
            <div key={c.codigo} className={tab.linha} role="row">
              <span className={tab.mono}>{c.codigo}</span>

              <Criador serverId={serverId} userId={c.porId} />

              <span className={tab.meta}>#{c.canal}</span>

              <span className={css.acoes}>
                <Botao
                  variante="sutil"
                  tamanho="pequeno"
                  onClick={() =>
                    void copiarTexto(
                      `${window.location.origin}/convite/${c.codigo}`,
                      "O link",
                    )
                  }
                >
                  Copiar
                </Botao>

                <Botao
                  variante="perigoSutil"
                  tamanho="pequeno"
                  disabled={ocupado}
                  onClick={() => {
                    setOcupado(true);
                    void revogarConvite(serverId, c.codigo)
                      .then((ok) => {
                        if (!ok) return;
                        // Some da lista na hora. Recarregar do servidor custaria
                        // uma ida e volta para confirmar o que acabou de ser
                        // confirmado.
                        setRes((r) =>
                          r === undefined || typeof r.dados === "string"
                            ? r
                            : {
                                ...r,
                                dados: r.dados.filter(
                                  (x) => x.codigo !== c.codigo,
                                ),
                              },
                        );
                      })
                      .finally(() => setOcupado(false));
                  }}
                >
                  Revogar
                </Botao>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className={css.recado}>
        O design mostra ainda <strong>usos</strong>, <strong>validade</strong> e
        uma <strong>vanity URL</strong>. Nenhum dos três existe no protocolo: o
        convite do Stoat guarda só o código, o servidor, o canal e quem o criou.
        Contagem de uso e expiração são conceito de outro cliente — ficaram de
        fora em vez de virar coluna com traço.
      </p>
    </div>
  );
}
