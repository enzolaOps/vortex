import { urlDeEmoji } from "nucleo/sdk/anexos";
import { chaveDeMembro, type BlocoDeMensagem, type TrechoDeMensagem } from "nucleo/sdk/domain";
import { useMembro } from "nucleo/store/hooks";

import { chat } from "../../textos";
import css from "./Corpo.module.css";

/**
 * O corpo da mensagem, desenhado a partir da ÁRVORE que o núcleo já analisou.
 *
 * Este componente não analisa markdown: `blocos` vem pronto no snapshot, com
 * cache por conteúdo no núcleo (erro nº 4 do briefing — reparsear no render só
 * aparece quando a presença começa a piscar). Aqui só se traduz árvore em DOM.
 *
 * A chave de cada nó é a posição no texto (`de`), que é estável e única entre
 * irmãos; índice de array não é.
 *
 * Segurança: o conteúdo é de terceiros. O analisador só deixa passar `http:`,
 * `https:` e `mailto:` em `href`, e imagem de markdown vira link, nunca `<img>`.
 * Aqui os links saem com `rel="noopener noreferrer"` e nada de HTML cru.
 */

function Mencao({ userId, servidorId }: { userId: string; servidorId: string }) {
  const membro = useMembro(chaveDeMembro(servidorId, userId));
  return <span className={css.mencao}>@{membro?.displayName ?? chat.autorDesconhecido}</span>;
}

function EmojiPersonalizado({ id }: { id: string }) {
  const url = urlDeEmoji(id);
  if (url === undefined) return <span>:{id}:</span>;
  // Tamanho fixo em `em`: a imagem chegar depois não muda a altura da linha.
  return <img className={css.emoji} src={url} alt="" loading="lazy" decoding="async" />;
}

function Trechos({ trechos, servidorId }: { trechos: readonly TrechoDeMensagem[]; servidorId: string }) {
  return (
    <>
      {trechos.map((t) => {
        switch (t.tipo) {
          case "texto":
            return t.valor;
          case "mencao":
            return <Mencao key={t.de} userId={t.valor} servidorId={servidorId} />;
          case "emoji":
            return <EmojiPersonalizado key={t.de} id={t.valor} />;
          case "codigo":
            return (
              <code key={t.de} className={css.codigo}>
                {t.valor}
              </code>
            );
          case "quebra":
            return <br key={t.de} />;
          case "enfase":
            return (
              <em key={t.de}>
                <Trechos trechos={t.filhos} servidorId={servidorId} />
              </em>
            );
          case "forte":
            return (
              <strong key={t.de}>
                <Trechos trechos={t.filhos} servidorId={servidorId} />
              </strong>
            );
          case "riscado":
            return (
              <s key={t.de}>
                <Trechos trechos={t.filhos} servidorId={servidorId} />
              </s>
            );
          case "link":
            return (
              <a key={t.de} href={t.href} target="_blank" rel="noopener noreferrer">
                <Trechos trechos={t.filhos} servidorId={servidorId} />
              </a>
            );
        }
      })}
    </>
  );
}

function Blocos({ blocos, servidorId }: { blocos: readonly BlocoDeMensagem[]; servidorId: string }) {
  return (
    <>
      {blocos.map((b) => {
        switch (b.tipo) {
          case "paragrafo":
            return (
              <p key={b.de} className={css.bloco}>
                <Trechos trechos={b.filhos} servidorId={servidorId} />
              </p>
            );
          case "titulo":
            // Nunca <h1>..<h3>: texto de terceiros não pode mexer no outline da página.
            return (
              <div
                key={b.de}
                role="heading"
                aria-level={b.nivel + 3}
                className={`${css.bloco} ${css.titulo}`}
                data-nivel={b.nivel}
              >
                <Trechos trechos={b.filhos} servidorId={servidorId} />
              </div>
            );
          case "blocoDeCodigo":
            return (
              <pre key={b.de} className={`${css.bloco} ${css.pre}`}>
                <code>{b.valor}</code>
              </pre>
            );
          case "citacao":
            return (
              <blockquote key={b.de} className={`${css.bloco} ${css.citacao}`}>
                <Blocos blocos={b.filhos} servidorId={servidorId} />
              </blockquote>
            );
          case "lista": {
            const Tag = b.ordenada ? "ol" : "ul";
            return (
              <Tag key={b.de} className={`${css.bloco} ${css.lista}`} start={b.ordenada ? b.inicio : undefined}>
                {b.itens.map((item) => (
                  <li key={item.de}>
                    <Blocos blocos={item.filhos} servidorId={servidorId} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "regra":
            return <hr key={b.de} className={css.regra} />;
        }
      })}
    </>
  );
}

export function CorpoDaMensagem({
  blocos,
  servidorId,
}: {
  blocos: readonly BlocoDeMensagem[];
  servidorId: string;
}) {
  return <Blocos blocos={blocos} servidorId={servidorId} />;
}
