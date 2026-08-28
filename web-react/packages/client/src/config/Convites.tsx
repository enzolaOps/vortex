import { useEffect, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { copiarTexto } from "../lib/copiar";
import {
  listarConvites,
  revogarConvite,
  type ConviteDoServidor,
} from "../sdk/servidores";
import { useCanaisDeTexto } from "../store/hooks";
import { administrar } from "../store/administracao";
import { fecharConfig } from "../store/config";
import css from "./Secao.module.css";

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
 */
export function Convites({ serverId }: { serverId: string }) {
  const [lista, setLista] = useState<readonly ConviteDoServidor[] | undefined>(
    undefined,
  );
  const canais = useCanaisDeTexto(serverId);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    let vivo = true;
    void listarConvites(serverId).then((l) => {
      if (vivo) setLista(l);
    });
    return () => {
      vivo = false;
    };
  }, [serverId]);

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  return (
    <div className={css.forma}>
      <p className={css.recado}>
        Cada convite leva a um canal. Quem abre o link entra no servidor e cai
        naquele canal.
      </p>

      <div className={css.acoes}>
        <Botao
          variante="primario"
          disabled={canais.length === 0}
          onClick={() => {
            /*
              Fecha as configurações antes de abrir o modal.

              O modal vive na camada `sobreposto` do shell, e esta tela está
              acima dela — abrir sem fechar deixaria o convite escondido atrás
              das próprias configurações.
            */
            const canal = canais[0];
            if (!canal) return;
            fecharConfig();
            administrar({ tipo: "convite", channelId: canal });
          }}
        >
          Criar convite
        </Botao>
      </div>

      {lista === undefined ? (
        <p className={css.recado}>Carregando…</p>
      ) : lista.length === 0 ? (
        <EstadoVazio
          compacto
          titulo="Nenhum convite ativo"
          detalhe="Crie um para deixar alguém entrar."
        />
      ) : (
        <ul className={css.lista}>
          {lista.map((c) => (
            <li key={c.codigo} className={css.linha}>
              <span className={css.texto}>
                <span className={css.nome}>{c.codigo}</span>
                <span className={css.detalhe}>leva a #{c.canal}</span>
              </span>

              <Botao
                variante="sutil"
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
                variante="sutil"
                disabled={ocupado}
                onClick={() => {
                  setOcupado(true);
                  void revogarConvite(serverId, c.codigo)
                    .then((ok) => {
                      if (!ok) return;
                      // Some da lista na hora. Recarregar do servidor custaria
                      // uma ida e volta para confirmar o que acabou de ser
                      // confirmado.
                      setLista((l) => l?.filter((x) => x.codigo !== c.codigo));
                    })
                    .finally(() => setOcupado(false));
                }}
              >
                Revogar
              </Botao>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
