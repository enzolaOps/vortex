import { X } from "../components/ui/icones";
import { memo } from "react";

import { Avatar } from "../components/ui/Avatar";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { alternarFixada } from "../sdk/adapter";
import { pode } from "../sdk/permissoes";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { pedirIrParaMensagem } from "../store/comandos";
import { useCanalAtivo, useChannel, useFixadas, useMessage } from "../store/hooks";
import { TextoDaMensagem } from "../list/TextoDaMensagem";
import css from "./PainelDeFixados.module.css";

/**
 * Uma mensagem fixada. Assina a si mesma.
 *
 * O painel conhece IDs; a linha busca o próprio snapshot. É a mesma forma da
 * lista de mensagens, e vale aqui pelo mesmo motivo: editar uma fixada toca
 * uma linha do painel, não o painel.
 */
const Fixada = memo(function Fixada({
  channelId,
  id,
  podeDesafixar,
}: {
  channelId: string;
  id: string;
  podeDesafixar: boolean;
}) {
  const message = useMessage(id);

  // Nunca `null`: este painel não é virtualizado, mas encolher e crescer faria
  // a lista pular durante a hidratação. Mesma disciplina do rail.
  if (!message) return <li className={css.item} aria-hidden />;

  return (
    <li className={css.item}>
      {/*
        O cartão inteiro leva à mensagem, e as ações são IRMÃS do botão.

        Botão dentro de botão é HTML inválido — o navegador reestrutura a
        árvore sozinho e o clique interno aciona os dois. É o mesmo erro que a
        linha de canal já registrou uma vez, e a correção é a mesma: um wrapper
        que contém o alvo grande e os alvos pequenos lado a lado.
      */}
      <button
        type="button"
        className={css.abrir}
        onClick={() => pedirIrParaMensagem(channelId, id)}
      >
        <span className={css.cabecalho}>
          {message.authorId ? (
            <>
              <Avatar id={message.authorId} tamanho="xs" />
              <NomeDoAutor userId={message.authorId} denso />
            </>
          ) : (
            <span className={css.desconhecido}>desconhecido</span>
          )}
          <time className={css.hora}>{message.createdAtCurto}</time>
        </span>

        {/* Duas linhas e corta. O painel é índice, não leitura — quem quer o
            texto inteiro clica e vai até ele, que é o que o botão faz. */}
        <span className={css.trecho}>
          <TextoDaMensagem blocos={message.blocos} compacto />
        </span>
      </button>

      {/*
        As ações em TEXTO, como o design — e não um ícone no canto.

        A diferença importa aqui: um cartão de fixada tem duas ações de peso
        muito diferente ("pular para" é navegação, "desafixar" é destrutivo), e
        dois ícones lado a lado não dizem qual é qual sem hover. Escritas, a
        cor faz o resto.
      */}
      <span className={css.acoes}>
        <button
          type="button"
          className={css.acao}
          onClick={() => pedirIrParaMensagem(channelId, id)}
        >
          Pular para
        </button>
        {podeDesafixar ? (
          <button
            type="button"
            className={css.acaoPerigo}
            onClick={() => alternarFixada(id)}
          >
            Desafixar
          </button>
        ) : null}
      </span>
    </li>
  );
});

/**
 * O painel de mensagens fixadas.
 *
 * É o primeiro painel a entrar na união `PainelId` depois da fase 4, e serve
 * de prova de que a extensão saiu barata: o tipo fechado enumerou sozinho os
 * quatro lugares que precisavam saber dele — o registro de painéis, os limites
 * de largura, o nome no modo edição e a alça de redimensionamento.
 *
 * Nasce movível como todo o resto: assina o canal ativo por conta própria e
 * não recebe nada por prop, então funciona em qualquer slot.
 */
export function PainelDeFixados({ aoFechar }: { aoFechar?: () => void }) {
  const channelId = useCanalAtivo();
  const ids = useFixadas(channelId);
  const canal = useChannel(channelId);
  const podeDesafixar = pode(channelId, "fixar");

  if (!channelId) {
    return (
      <div className={css.painel}>
        <EstadoVazio compacto titulo="Nenhum canal aberto" />
      </div>
    );
  }

  return (
    <div className={css.painel}>
      {/*
        Cabeçalho com CONTAGEM e lugar — "4 em #produto", do design.

        Um painel lateral pode estar aberto sobre um canal que não é o que a
        pessoa estava olhando quando o abriu; dizer de qual canal são as
        fixadas custa uma linha e responde a pergunta antes dela.
      */}
      <header className={css.titulo}>
        <div className={css.tituloTexto}>
          <span className={css.tituloNome}>Fixadas</span>
          <span className={css.tituloContexto}>
            {ids.length} {canal ? `em #${canal.name}` : ""}
          </span>
        </div>
        {aoFechar ? (
          <button
            type="button"
            className={css.fechar}
            aria-label="Fechar fixadas"
            onClick={aoFechar}
          >
            <X aria-hidden />
          </button>
        ) : null}
      </header>

      {ids.length === 0 ? (
        <EstadoVazio
          compacto
          titulo="Nada fixado aqui"
          detalhe="Fixe uma mensagem pelo menu dela para guardar o que importa."
        />
      ) : (
        <ul className={css.lista}>
          {ids.map((id) => (
            <Fixada
              key={id}
              channelId={channelId}
              id={id}
              podeDesafixar={podeDesafixar}
            />
          ))}
        </ul>
      )}

      {/*
        O rodapé que explica a ausência.

        Sem ele, quem não tem a permissão vê cartões com uma ação a menos e não
        tem como saber por quê — e "ações administrativas não são renderizadas
        sem permissão" só funciona quando a ausência é óbvia. Aqui não é.
      */}
      {!podeDesafixar && ids.length > 0 ? (
        <p className={css.rodape}>
          Só quem tem "Fixar mensagens" vê as ações de desafixar.
        </p>
      ) : null}
    </div>
  );
}
