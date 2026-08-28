import { PushPin, PushPinSlash } from "@phosphor-icons/react";
import { memo } from "react";

import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Tooltip } from "../components/ui/Tooltip";
import { alternarFixada } from "../sdk/adapter";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { pedirIrParaMensagem } from "../store/comandos";
import { useCanalAtivo, useFixadas, useMessage } from "../store/hooks";
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
}: {
  channelId: string;
  id: string;
}) {
  const message = useMessage(id);

  // Nunca `null`: este painel não é virtualizado, mas encolher e crescer faria
  // a lista pular durante a hidratação. Mesma disciplina do rail.
  if (!message) return <li className={css.item} aria-hidden />;

  return (
    <li className={css.item}>
      <button
        type="button"
        className={css.abrir}
        onClick={() => pedirIrParaMensagem(channelId, id)}
      >
        <span className={css.cabecalho}>
          {message.authorId ? (
            <NomeDoAutor userId={message.authorId} />
          ) : (
            <span className={css.desconhecido}>desconhecido</span>
          )}
          <time className={css.hora}>{message.createdAtText}</time>
        </span>

        {/* Duas linhas e corta. O painel é índice, não leitura — quem quer o
            texto inteiro clica e vai até ele, que é o que o botão faz. */}
        <span className={css.trecho}>
            <TextoDaMensagem blocos={message.blocos} compacto />
          </span>
      </button>

      <Tooltip texto="Desafixar" lado="inicio">
        <button
          type="button"
          className={css.desafixar}
          onClick={() => alternarFixada(id)}
          aria-label="Desafixar mensagem"
        >
          <PushPinSlash size={20} aria-hidden />
        </button>
      </Tooltip>
    </li>
  );
});

/**
 * O painel de mensagens fixadas.
 *
 * É o primeiro painel a entrar na união `PainelId` depois da fase 4, e serve
 * de prova de que a extensão saiu barata: o tipo fechado enumerou sozinho os
 * quatro lugares que precisavam saber dele — o registro de painéis, os limites
 * de largura, o nome no modo edição e a alça de redimensionamento. Nenhum foi
 * descoberto em runtime.
 *
 * E **não precisou de versão nova do preset**: um preset v1 escrito antes
 * continua válido, porque nenhum campo mudou de forma — a união só ganhou um
 * membro. O caminho contrário é que seria caro, e é o que o schema impede.
 *
 * Nasce movível como todo o resto: assina o canal ativo por conta própria e
 * não recebe nada por prop, então funciona em qualquer slot.
 */
export function PainelDeFixados() {
  const channelId = useCanalAtivo();
  const ids = useFixadas(channelId);

  if (!channelId) {
    return (
      <div className={css.painel}>
        <EstadoVazio compacto titulo="Nenhum canal aberto" />
      </div>
    );
  }

  return (
    <div className={css.painel}>
      <header className={css.titulo}>
        <PushPin size={20} aria-hidden />
        fixadas
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
            <Fixada key={id} channelId={channelId} id={id} />
          ))}
        </ul>
      )}
    </div>
  );
}
