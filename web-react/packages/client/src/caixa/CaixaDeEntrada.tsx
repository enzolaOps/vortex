import { useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { marcarCanalLido } from "../sdk/adapter";
import { aindaNao } from "../pendente/pendencias";
import { contagem } from "../lib/plural";
import { irPara } from "../store/navegacao";
import {
  useCanaisDeTexto,
  useChannel,
  useServer,
  useServerIds,
} from "../store/hooks";
import css from "./CaixaDeEntrada.module.css";

type Aba = "mencoes" | "naoLidos" | "topicos";

/**
 * A caixa de entrada — menções, não lidos e tópicos num painel só.
 *
 * ⚠ **Ela era pendência de cabeçalho e virou PAINEL de verdade**, porque o
 * dado já existia: `ChannelSnapshot` carrega `naoLidas` e `mencoes` desde que
 * a semeadura no `Ready` foi construída, e a varredura é sobre canais — dezenas
 * — e não sobre mensagens.
 *
 * O que ela responde é a pergunta que a coluna de canais NÃO responde: "o que
 * me espera fora daqui". A coluna mostra um servidor de cada vez; esta olha
 * todos.
 *
 * ⚠ **A aba de tópicos fica vazia com o motivo escrito**, e não escondida. O
 * design desenha as três, e tópico não existe no protocolo (pendência
 * `topicos`) — esconder a aba faria parecer que não há tópicos, que é uma
 * afirmação diferente de "isto ainda não existe".
 */
export function CaixaDeEntrada() {
  const [aba, setAba] = useState<Aba>("mencoes");
  const servidores = useServerIds();

  return (
    <div className={css.painel}>
      <header className={css.cabecalho}>
        <div className={css.linhaDoTitulo}>
          <span className={css.titulo}>Caixa de entrada</span>
          <button
            type="button"
            className={css.marcarTudo}
            onClick={aindaNao("marcarTudoLido")}
          >
            Marcar tudo como lido
          </button>
        </div>

        {/*
          As abas com CONTAGEM no rótulo.

          `role="tablist"` de verdade e não três botões soltos: as setas
          navegam entre abas, e é o que o teclado espera de um seletor
          exclusivo. Cada painel é montado sob demanda — trocar de aba não
          guarda a rolagem da anterior, e isso é certo aqui: a lista muda de
          conteúdo, não de posição.
        */}
        <div className={css.abas} role="tablist" aria-label="Filtro da caixa">
          <BotaoDeAba id="mencoes" atual={aba} aoEscolher={setAba} rotulo="Menções" />
          <BotaoDeAba id="naoLidos" atual={aba} aoEscolher={setAba} rotulo="Não lidos" />
          <BotaoDeAba id="topicos" atual={aba} aoEscolher={setAba} rotulo="Tópicos" />
        </div>
      </header>

      <div className={css.lista} tabIndex={0} role="tabpanel">
        {aba === "topicos" ? (
          <EstadoVazio
            compacto
            titulo="Tópicos ainda não existem"
            detalhe="Depende de threads no protocolo — ver o registro de pendências."
          />
        ) : (
          <Conteudo servidores={servidores} aba={aba} />
        )}
      </div>
    </div>
  );
}

function BotaoDeAba({
  id,
  atual,
  rotulo,
  aoEscolher,
}: {
  id: Aba;
  atual: Aba;
  rotulo: string;
  aoEscolher: (a: Aba) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={id === atual}
      className={css.aba}
      onClick={() => aoEscolher(id)}
    >
      {rotulo}
    </button>
  );
}

/**
 * A lista, montada varrendo os servidores.
 *
 * ⚠ **A varredura acontece no RENDER e não por evento, e isso é decisão.**
 * Contar canais com menção sob o firehose seria pagá-la 500 vezes por segundo
 * para um painel que pode estar fechado. É a mesma regra de "ordenar quando é
 * observável" que a coluna de conversas e as abas de amigos já seguem.
 *
 * O custo real é pequeno: dezenas de canais por servidor, e cada linha assina
 * o próprio snapshot — o que muda com uma mensagem nova é UMA linha, não a
 * varredura.
 */
function Conteudo({
  servidores,
  aba,
}: {
  servidores: readonly string[];
  aba: Aba;
}) {
  const grupos = servidores.map((id) => (
    <GrupoDeServidor key={id} serverId={id} aba={aba} />
  ));

  return <>{grupos}</>;
}

function GrupoDeServidor({ serverId, aba }: { serverId: string; aba: Aba }) {
  const servidor = useServer(serverId);
  const canais = useCanaisDeTexto(serverId);

  if (!servidor) return null;

  return (
    <>
      {canais.map((id) => (
        <LinhaDaCaixa
          key={id}
          serverId={serverId}
          channelId={id}
          servidor={servidor.name}
          sigla={servidor.sigla}
          aba={aba}
        />
      ))}
    </>
  );
}

/**
 * Uma linha da caixa. Assina o PRÓPRIO canal.
 *
 * É o mesmo padrão de `NomeDoAutor` e da linha de destino do encaminhar: sem
 * ele, uma mensagem nova em qualquer canal re-renderizaria o painel inteiro.
 *
 * O filtro mora aqui pela mesma razão: a contagem vive no snapshot do canal, e
 * filtrar lá fora obrigaria o pai a ler todos.
 */
function LinhaDaCaixa({
  serverId,
  channelId,
  servidor,
  sigla,
  aba,
}: {
  serverId: string;
  channelId: string;
  servidor: string;
  sigla: string;
  aba: Aba;
}) {
  const canal = useChannel(channelId);
  if (!canal) return null;

  const relevante = aba === "mencoes" ? canal.mencoes > 0 : canal.naoLidas > 0;
  if (!relevante) return null;

  return (
    <div className={css.item} data-destaque={aba === "mencoes" || undefined}>
      <button
        type="button"
        className={css.abrir}
        onClick={() => irPara(serverId, channelId)}
      >
        <span className={css.contexto}>
          <Avatar id={serverId} sigla={sigla} tamanho="xxs" />
          <span className={css.servidor}>{servidor}</span>
          <span className={css.canal}>#{canal.name}</span>
        </span>

        <span className={css.resumo}>
          {canal.mencoes > 0 ? (
            <span className={css.badge}>{contagem(canal.mencoes)}</span>
          ) : null}
          <span className={css.contagem}>
            {canal.naoLidas > 0
              ? `${contagem(canal.naoLidas)} sem ler`
              : "sem novidade"}
          </span>
        </span>
      </button>

      {/*
        "Marcar como lida" é a ação da linha, e ela é REAL.

        O design desenha uma resposta rápida no lugar; ela depende de um
        composer fora do canal — o que significa decidir para onde vai o
        rascunho, o alvo de resposta e a digitação. Marcar como lida usa o
        `ack` que já existe e resolve o gesto mais comum de uma caixa de
        entrada: reconhecer sem entrar.
      */}
      <button
        type="button"
        className={css.marcar}
        aria-label={`Marcar #${canal.name} como lido`}
        onClick={() => marcarCanalLido(channelId)}
      >
        ✓
      </button>
    </div>
  );
}
