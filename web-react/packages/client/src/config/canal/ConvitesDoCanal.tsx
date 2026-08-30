import { useEffect, useState } from "react";

import { Botao } from "../../components/ui/Botao";
import { EstadoVazio } from "../../components/ui/EstadoVazio";
import { copiarTexto } from "../../lib/copiar";
import {
  listarConvites,
  revogarConvite,
  type ConviteDoServidor,
} from "../../sdk/servidores";
import { administrar } from "../../store/administracao";
import { fecharConfig } from "../../store/config";
import { useChannel } from "../../store/hooks";
import css from "../Secao.module.css";

/**
 * Os convites DESTE canal.
 *
 * ⚠ **É a mesma fonte da tela de convites do servidor, filtrada — e não uma
 * lista própria.** O protocolo só sabe listar por servidor
 * (`Server.fetchInvites`), então uma segunda chamada não existiria; e duas
 * telas com dois jeitos de montar a mesma lista divergem na primeira mudança,
 * que foi o argumento que juntou os quatro seletores numa casca só.
 *
 * O filtro é pelo NOME do canal e não pelo id, porque é isso que
 * `ConviteDoServidor` carrega — o protocolo devolve o convite com o canal
 * embutido, e resolver o id de volta exigiria uma tabela que a tela do
 * servidor também não tem.
 */
export function ConvitesDoCanal({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  const serverId = canal?.serverId;
  const [lista, setLista] = useState<readonly ConviteDoServidor[] | undefined>(
    undefined,
  );

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

  if (!canal) {
    return <p className={css.recado}>Abra um canal para ver isto.</p>;
  }
  if (!serverId) {
    return (
      <p className={css.recado}>
        Conversas diretas não têm convite — quem entra é quem você adiciona.
      </p>
    );
  }

  const deste = lista?.filter((c) => c.canal === canal.name);

  return (
    <div className={css.forma}>
      <p className={css.recado}>
        Quem abre um destes links entra no servidor e cai direto em #
        {canal.name}.
      </p>

      <div className={css.acoes}>
        <Botao
          variante="primario"
          onClick={() => {
            /*
              Fecha as configurações antes de abrir o modal — ele vive na
              camada `sobreposto` do shell, que está ABAIXO desta tela. Sem
              fechar, o convite abriria escondido atrás dela.
            */
            fecharConfig();
            administrar({ tipo: "convite", channelId });
          }}
        >
          Criar convite
        </Botao>
      </div>

      {deste === undefined ? (
        <p className={css.recado}>Carregando…</p>
      ) : deste.length === 0 ? (
        <EstadoVazio
          compacto
          titulo="Nenhum convite para este canal"
          detalhe="Crie um para deixar alguém entrar direto aqui."
        />
      ) : (
        <ul className={css.lista}>
          {deste.map((c) => (
            <li key={c.codigo} className={css.linha}>
              <span className={css.texto}>
                <span className={css.nome}>{c.codigo}</span>
                <span className={css.detalhe}>criado por {c.porId}</span>
              </span>
              <Botao
                variante="sutil"
                onClick={() =>
                  void copiarTexto(
                    `${window.location.origin}/convite/${c.codigo}`,
                    "Link do convite",
                  )
                }
              >
                Copiar
              </Botao>
              <Botao
                variante="perigo"
                onClick={() => {
                  void revogarConvite(serverId, c.codigo).then((ok) => {
                    if (!ok) return;
                    setLista((atual) =>
                      atual?.filter((x) => x.codigo !== c.codigo),
                    );
                  });
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
