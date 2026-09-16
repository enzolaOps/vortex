import { decodeTime } from "ulid";

import { Avatar } from "../components/ui/Avatar";
import { plural } from "../lib/plural";
import { quando } from "../lib/quando";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { TextoDaMensagem } from "../list/TextoDaMensagem";
import { useForum, useMessage, useTopico } from "../store/hooks";
import { useAgoraPorMinuto } from "../store/relogio";
import type { TagDeForum } from "../sdk/domain";
import css from "./RaizDoTopico.module.css";

/**
 * A mensagem-raiz do tópico aberto — o card no TOPO do scroller.
 *
 * ⚠ **Rola junto, não gruda.** O design: "rolar para cima deve mostrar o
 * contexto, não travá-lo". Por isso ele entra como `topo` da `MessageList`, e
 * não acima dela no layout.
 *
 * ⚠ **O corpo só aparece no tópico de MENSAGEM.** Num post a abertura é a
 * primeira mensagem de DENTRO — ela já está na timeline logo abaixo, e
 * repeti-la no card mostraria o mesmo texto duas vezes seguidas. O card do
 * post fica com o que só ele tem: tags, título e quem abriu.
 */
export function RaizDoTopico({ channelId }: { channelId: string }) {
  const t = useTopico(channelId);
  const forum = useForum(t?.paiId ?? "");
  // A mensagem de origem mora no canal PAI — assinada se já estiver carregada.
  // Pai sem `forum` = tópico de mensagem; com `forum` = post.
  const deMensagem = forum === null;
  const origem = useMessage(deMensagem ? (t?.aberturaId ?? "") : "");
  const agora = useAgoraPorMinuto();

  if (!t) return null;

  const tags = t.tags
    .map((id) => forum?.tags.find((x) => x.id === id))
    .filter((x): x is TagDeForum => x !== undefined);
  const autorId = origem?.authorId ?? t.abertura?.autorId ?? t.donoId;
  const midia = deMensagem ? t.abertura?.midia : undefined;
  const textoDaOrigem = deMensagem ? (origem ?? t.abertura?.texto) : undefined;

  return (
    <div className={css.raiz}>
      <article className={css.card}>
        {tags.length > 0 || t.arquivado ? (
          <div className={css.tags}>
            {tags.map((tag) => (
              <span
                key={tag.id}
                className={css.tag}
                /* Cor validada como `#rrggbb` na tradução — ver `corDeTag`. */
                style={tag.cor ? ({ "--cor-da-tag": tag.cor } as React.CSSProperties) : undefined}
              >
                {tag.nome}
              </span>
            ))}
            {t.arquivado ? <span className={css.estado}>arquivado</span> : null}
          </div>
        ) : null}

        <h2 className={css.titulo}>{t.nome}</h2>

        <div className={css.corpo}>
          <Avatar id={autorId} tamanho="sm" className={css.avatar} />
          <div className={css.texto}>
            <div className={css.autoria}>
              <NomeDoAutor userId={autorId} />
              <span className={css.quando}>
                {deMensagem ? "iniciou o tópico" : "iniciou o post"} ·{" "}
                {quando(decodeTime(t.id), agora, "detalhado")}
              </span>
            </div>
            {textoDaOrigem !== undefined ? (
              <div className={css.mensagem}>
                {typeof textoDaOrigem === "string" ? (
                  textoDaOrigem
                ) : (
                  <TextoDaMensagem blocos={textoDaOrigem.blocos} />
                )}
              </div>
            ) : null}
            {midia?.url ? (
              <div className={css.midia}>
                {midia.tipo === "video" ? (
                  <video src={midia.url} className={css.midiaConteudo} controls preload="metadata" />
                ) : (
                  <img src={midia.url} alt="" className={css.midiaConteudo} loading="lazy" />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </article>

      {t.respostas !== undefined ? (
        <div className={css.divisor}>
          <span className={css.linha} aria-hidden />
          <span className={css.respostas}>{plural(t.respostas, "resposta", "respostas")}</span>
          <span className={css.linha} aria-hidden />
        </div>
      ) : null}
    </div>
  );
}

