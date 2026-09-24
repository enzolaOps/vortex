import { Hash, SpeakerHigh } from "../components/ui/icones";
import { useSyncExternalStore } from "react";

import { CartaoDeOpcao } from "../components/ui/CartaoDeOpcao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Interruptor } from "../components/ui/Interruptor";
import { corDoTextoDe, gradienteDe } from "../lib/gradiente";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import {
  useCanaisDeTexto,
  useCanaisDeVoz,
  useChannel,
  useServer,
} from "../store/hooks";
import {
  alternarSilencio,
  assinarSilencio,
  definirNivelDoCanal,
  definirNivelDoServidor,
  definirOpcoesDoServidor,
  definirSeguirTopicos,
  estaSilenciado,
  nivelDoCanal,
  nivelDoServidor,
  opcoesDoServidor,
  segueTopicosAutomaticamente,
  type NivelDeNotificacao,
} from "../store/silencio";
import css from "./ModalDeNotificacoes.module.css";

/**
 * Os rótulos do DESIGN, e não os de `NIVEIS_DE_NOTIFICACAO`.
 *
 * O store diz "Só menções" porque é o nome do estado; o modal diz "Só
 * @menções" porque é o texto que o design escreve, e o `@` é o que torna a
 * opção reconhecível de relance — é o caractere que a pessoa vê na mensagem.
 */
const ROTULO: Record<NivelDeNotificacao, string> = {
  todas: "Todas as mensagens",
  mencoes: "Só @menções",
  nada: "Nada",
};

const NIVEIS = ["todas", "mencoes", "nada"] as const;

/**
 * O padrão GLOBAL de canal de servidor — o que vale quando ninguém escolheu.
 *
 * É o mesmo que `decidirEntrega` aplica (mensagem comum só em canal "todas"),
 * escrito aqui para o modal mostrar de onde o valor herdado vem.
 */
const PADRAO_GLOBAL: NivelDeNotificacao = "mencoes";

/**
 * O sino — notificações do servidor e do canal, num modal para os dois.
 *
 * ⚠ **Um componente e não dois**, pela mesma razão de criar e editar canal
 * dividirem formulário: o canal HERDA do servidor, e as duas telas precisam
 * concordar sobre o nome de cada nível e sobre como a herança aparece. Duas
 * cópias divergiriam no primeiro rótulo trocado.
 */
export function ModalDeNotificacoes({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  if (alvo?.tipo === "notificacoesDoServidor") {
    return <DoServidor serverId={alvo.serverId} aoFechar={aoFechar} />;
  }
  if (alvo?.tipo === "notificacoesDoCanal") {
    return <DoCanal channelId={alvo.channelId} aoFechar={aoFechar} />;
  }
  return null;
}

/* ------------------------------------------------------------ servidor */

function DoServidor({ serverId, aoFechar }: { serverId: string; aoFechar: () => void }) {
  const servidor = useServer(serverId);
  const nivel = useSyncExternalStore(assinarSilencio, () => nivelDoServidor(serverId));
  const opcoes = useSyncExternalStore(assinarSilencio, () => opcoesDoServidor(serverId));
  const texto = useCanaisDeTexto(serverId);
  const voz = useCanaisDeVoz(serverId);
  const efetivo = nivel ?? PADRAO_GLOBAL;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        className={css.painelDoServidor}
        titulo={
          <span className={css.identidade}>
            <span
              aria-hidden
              className={css.ladrilho}
              style={{ backgroundImage: gradienteDe(serverId), color: corDoTextoDe(serverId) }}
            >
              {servidor?.sigla}
            </span>
            {servidor?.name ?? "Servidor"}
          </span>
        }
        descricao="Notificações do servidor"
      >
        <div className={css.sobrancelha}>Padrão do servidor</div>
        <div className={css.grupo} role="radiogroup" aria-label="Padrão do servidor">
          <CartaoDeOpcao
            marcado={efetivo === "todas"}
            titulo={ROTULO.todas}
            detalhe="Notifica qualquer mensagem em canais não silenciados."
            aoEscolher={() => definirNivelDoServidor(serverId, "todas")}
          />
          <CartaoDeOpcao
            marcado={efetivo === "mencoes"}
            titulo={ROTULO.mencoes}
            detalhe="Recomendado para servidores grandes."
            aoEscolher={() => definirNivelDoServidor(serverId, "mencoes")}
          />
          <CartaoDeOpcao
            marcado={efetivo === "nada"}
            titulo={ROTULO.nada}
            detalhe="Só badge de não lido, sem notificação."
            aoEscolher={() => definirNivelDoServidor(serverId, "nada")}
          />
        </div>

        <div className={css.cartaoDeLinhas}>
          <Linha titulo="Suprimir @everyone e @here" detalhe="Não notifica menções em massa">
            <Interruptor
              ligado={opcoes.suprimirTodos}
              rotulo="Suprimir @everyone e @here"
              aoAlternar={(v) => definirOpcoesDoServidor(serverId, { suprimirTodos: v })}
            />
          </Linha>
          <Linha titulo="Suprimir menções de cargo" detalhe="Ignora @Design, @Moderação e afins">
            <Interruptor
              ligado={opcoes.suprimirCargos}
              rotulo="Suprimir menções de cargo"
              aoAlternar={(v) => definirOpcoesDoServidor(serverId, { suprimirCargos: v })}
            />
          </Linha>
          {/*
            Real desde que o fork tem evento agendado (D-NOTIF-12): cala o
            lembrete "começa em 10 minutos" dos eventos DESTE servidor — ver
            `eventos/lembretes.ts`.
          */}
          <Linha titulo="Notificar eventos do servidor" detalhe="Início de evento agendado">
            <Interruptor
              ligado={opcoes.notificarEventos}
              rotulo="Notificar eventos do servidor"
              aoAlternar={(v) => definirOpcoesDoServidor(serverId, { notificarEventos: v })}
            />
          </Linha>
        </div>

        <div className={css.sobrancelha}>Exceções por canal</div>
        {/*
          Grade e não `<table>`, pela mesma razão da matriz da tela de
          notificações: `1fr 84px 84px 84px` mantém as três colunas de escolha
          no mesmo lugar em qualquer nome de canal.
        */}
        <div className={css.tabela} role="group" aria-label="Exceções por canal">
          <div className={css.cabecalhoDaTabela} aria-hidden>
            <span>Canal</span>
            <span className={css.aoCentro}>Todas</span>
            <span className={css.aoCentro}>Menções</span>
            <span className={css.aoCentro}>Nada</span>
          </div>
          {[...texto, ...voz].map((id) => (
            <LinhaDeExcecao key={id} channelId={id} herdado={efetivo} />
          ))}
        </div>
        <p className={css.nota}>
          Canal sem exceção herda o padrão do servidor e mostra a coluna herdada
          em cinza.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Linha({
  titulo,
  detalhe,
  children,
}: {
  titulo: string;
  detalhe: string;
  children: React.ReactNode;
}) {
  return (
    <div className={css.linha}>
      <div className={css.textos}>
        <div className={css.titulo}>{titulo}</div>
        <p className={css.detalhe}>{detalhe}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Uma linha da tabela de exceções — assina o PRÓPRIO canal e o próprio nível.
 *
 * Mudar a exceção de um canal acorda a linha dele, não a tabela: o `silencio`
 * publica para todos, mas `nivelDoCanal` devolve string comparada por valor.
 */
function LinhaDeExcecao({
  channelId,
  herdado,
}: {
  channelId: string;
  herdado: NivelDeNotificacao;
}) {
  const canal = useChannel(channelId);
  const excecao = useSyncExternalStore(assinarSilencio, () => nivelDoCanal(channelId));
  if (!canal) return null;
  const nome = canal.name;
  const Glifo = canal.tipo === "voz" ? SpeakerHigh : Hash;

  return (
    <div className={css.linhaDaTabela} role="radiogroup" aria-label={`Notificações de ${nome}`}>
      <span className={css.canal}>
        <Glifo aria-hidden className={css.glifo} />
        <span className={css.nomeDoCanal}>{nome}</span>
      </span>
      {NIVEIS.map((n) => {
        const escolhido = excecao === n;
        const herdadoAqui = excecao === undefined && herdado === n;
        return (
          <span key={n} className={css.aoCentro}>
            <button
              type="button"
              role="radio"
              aria-checked={escolhido || herdadoAqui}
              aria-label={`${ROTULO[n]} em ${nome}${herdadoAqui ? " (herdado do servidor)" : ""}`}
              data-herdado={herdadoAqui || undefined}
              className={css.ponto}
              /*
                ⚠ **Clicar na exceção que já vale a DESFAZ**, e é o único jeito
                de voltar a herdar pela tabela. O design não desenha coluna de
                "herdar"; sem isto, um canal que ganhou exceção nunca mais
                acompanharia o padrão do servidor a partir daqui.
              */
              onClick={() => definirNivelDoCanal(channelId, escolhido ? undefined : n)}
            />
          </span>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- canal */

type EscolhaDoCanal = NivelDeNotificacao | "herdar";

function DoCanal({ channelId, aoFechar }: { channelId: string; aoFechar: () => void }) {
  const canal = useChannel(channelId);
  const serverId = canal?.serverId;
  const excecao = useSyncExternalStore(assinarSilencio, () => nivelDoCanal(channelId));
  const doServidor = useSyncExternalStore(assinarSilencio, () =>
    serverId ? nivelDoServidor(serverId) : undefined,
  );
  const herdado = doServidor ?? PADRAO_GLOBAL;
  const escolha: EscolhaDoCanal = excecao ?? "herdar";
  const seguirTopicos = useSyncExternalStore(assinarSilencio, () =>
    segueTopicosAutomaticamente(channelId),
  );
  const Glifo = canal?.tipo === "voz" ? SpeakerHigh : Hash;

  const escolher = (e: EscolhaDoCanal) => {
    if (e !== "herdar") {
      definirNivelDoCanal(channelId, e);
      return;
    }
    /*
      ⚠ **Sair de "nada" para "usar padrão" reativa o canal.** `silencio.ts`
      não reativa ao voltar ao padrão, e com razão — um silêncio posto pelo
      menu não pediu para acabar. Aqui o silêncio foi posto por ESTE controle
      (é o que "nada" faz), e deixá-lo de pé mostraria "herdando só @menções"
      num canal que não avisa nada.
    */
    const eraNada = excecao === "nada";
    definirNivelDoCanal(channelId, undefined);
    if (eraNada && estaSilenciado(channelId)) alternarSilencio(channelId);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        className={css.painelDoCanal}
        titulo={
          <span className={css.identidadeDoCanal}>
            <Glifo aria-hidden className={css.glifoDoTitulo} />
            {canal?.name ?? "canal"}
          </span>
        }
        descricao={`Herdando "${ROTULO[herdado]}" do servidor`}
      >
        <div className={css.grupoDoCanal} role="radiogroup" aria-label="Notificações do canal">
          <CartaoDeOpcao
            marcado={escolha === "herdar"}
            titulo="Usar padrão do servidor"
            detalhe={ROTULO[herdado]}
            aoEscolher={() => escolher("herdar")}
          />
          {NIVEIS.map((n) => (
            <CartaoDeOpcao
              key={n}
              marcado={escolha === n}
              titulo={ROTULO[n]}
              aoEscolher={() => escolher(n)}
            />
          ))}
        </div>

        <hr aria-hidden className={css.regua} />

        <Linha
          titulo="Seguir tópicos automaticamente"
          detalhe="Threads que você responder entram na caixa de entrada"
        >
          {/*
            Real (D-NOTIF-16): o servidor segue o tópico sozinho quando você
            responde, e desligado o envio desfaz esse seguir — ver
            `segueTopicosAutomaticamente` em `silencio.ts` e `postar` no
            adapter.
          */}
          <Interruptor
            ligado={seguirTopicos}
            rotulo="Seguir tópicos automaticamente"
            aoAlternar={(v) => definirSeguirTopicos(channelId, v)}
          />
        </Linha>
      </DialogContent>
    </Dialog>
  );
}
