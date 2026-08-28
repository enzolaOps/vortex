import { useEffect, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { apagarEmoji, listarEmojis, type Emoji } from "../sdk/cargos";
import css from "./Secao.module.css";
import emojiCss from "./Emojis.module.css";

/**
 * Os emojis do servidor.
 *
 * ⚠ **Listar e apagar, mas NÃO enviar — e a ausência é dita.** Subir emoji não
 * passa pela API do protocolo: é um `POST` cru para o servidor de MÍDIA, cuja
 * URL vem de `client.configuration.features.autumn`, e o `id` devolvido é que
 * vira o emoji. Sem instância alcançável não há como escrever isso e ver
 * funcionar — e a única coisa pior que não ter o botão é ter um que falha em
 * silêncio contra um endpoint que ninguém testou.
 *
 * ⚠ **E o protocolo não tem editar emoji** — só criar e apagar. Renomear é
 * apagar e subir de novo, o que quebra toda mensagem que usava o antigo.
 */
export function Emojis({ serverId }: { serverId: string }) {
  const [lista, setLista] = useState<readonly Emoji[] | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    let vivo = true;
    void listarEmojis(serverId).then((l) => {
      if (vivo) setLista(l);
    });
    return () => {
      vivo = false;
    };
  }, [serverId]);

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  if (lista === undefined) {
    return <p className={css.recado}>Carregando…</p>;
  }

  if (lista.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum emoji"
        detalhe="Enviar emoji ainda não é possível por aqui — a lista mostra e remove os que já existem."
      />
    );
  }

  return (
    <div className={css.forma}>
      <p className={css.recado}>
        Apagar um emoji não apaga as mensagens que o usaram — elas passam a
        mostrar o código dele.
      </p>

      <ul className={emojiCss.grade}>
        {lista.map((e) => (
          <li key={e.id} className={emojiCss.item}>
            {/*
              `alt` com o nome e não vazio: quem não vê a imagem precisa saber
              QUAL emoji está prestes a apagar, e essa é a única informação que
              distingue uma linha da outra.
            */}
            <img className={emojiCss.imagem} src={e.url} alt={e.nome} />
            <span className={emojiCss.nome}>:{e.nome}:</span>
            <Botao
              variante="sutil"
              disabled={ocupado}
              onClick={() => {
                setOcupado(true);
                void apagarEmoji(e.id)
                  .then((ok) => {
                    if (ok) setLista((l) => l?.filter((x) => x.id !== e.id));
                  })
                  .finally(() => setOcupado(false));
              }}
            >
              Apagar
            </Botao>
          </li>
        ))}
      </ul>
    </div>
  );
}
