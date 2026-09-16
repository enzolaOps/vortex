import {
  BellSimple,
  BellSimpleSlash,
  ChatsCircle,
  Phone,
  PushPin,
  Tray,
  Users,
} from "../components/ui/icones";
import { useSyncExternalStore } from "react";

import { cn } from "../lib/cn";
import { NOME_DO_PAINEL, type PainelId } from "../preset/schema";
import { aindaNao, type PendenciaId } from "../pendente/pendencias";
import { Tooltip } from "../components/ui/Tooltip";
import { assinarLayout, painelVisivel } from "../store/layout";
import {
  alternarSuperficie,
  assinarDrawer,
  superficieAberta,
} from "../store/drawer";
import { administrar } from "../store/administracao";
import { useChannel } from "../store/hooks";
import { GatilhoDeBusca } from "../components/ui/CampoDeBusca";
import { ligar } from "../sdk/chamada";
import type { CanalTipo } from "../sdk/domain";
import { assinarChamada, lerChamada } from "../store/chamada";
import css from "./AcoesDoCanal.module.css";

/**
 * Um botão que liga e desliga um painel lateral.
 *
 * Assina o layout sozinho — o cabeçalho inteiro não precisa acordar porque
 * alguém mostrou os fixados. `painelVisivel` devolve `boolean`, comparado por
 * valor, então quem não mudou não re-renderiza.
 */
function BotaoDePainel({ painel, children }: { painel: PainelId; children: React.ReactNode }) {
  /*
    DUAS subscrições, porque o painel pode estar em dois lugares.

    Ancorado num slot ele responde ao layout; sem slot ele flutua e responde ao
    drawer. `superficieAberta` junta as duas numa resposta só — sem isso o
    `aria-pressed` mentiria em metade dos casos, que é justamente o defeito que
    o lint de rótulo-que-alterna existe para evitar.
  */
  const noSlot = useSyncExternalStore(assinarLayout, () => painelVisivel(painel));
  const flutuando = useSyncExternalStore(assinarDrawer, () =>
    superficieAberta(painel, noSlot),
  );
  const visivel = flutuando;
  const nome = NOME_DO_PAINEL[painel];

  return (
    <Tooltip texto={visivel ? `Esconder ${nome}` : `Mostrar ${nome}`}>
      <button
        type="button"
        className={cn(css.acao, visivel && css.acaoAtiva)}
        /* Nome ESTÁVEL, estado no `aria-pressed` — a regra que o lint deste
           projeto guarda. Rótulo que alterna junto do estado faz o leitor
           anunciar o inverso; a ação vai no tooltip. */
        aria-pressed={visivel}
        aria-label={nome.charAt(0).toUpperCase() + nome.slice(1)}
        onClick={() => alternarSuperficie(painel)}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * O sino do cabeçalho — abre as notificações do canal.
 *
 * ⚠ **Era um interruptor de silêncio e virou a porta do modal**, porque o
 * sino é o alvo do design para "Notificações do canal": escolher entre herdar
 * o servidor, todas, só @menções ou nada. Silenciar por prazo continua no
 * menu do canal; "nada" no modal é o mesmo silêncio.
 *
 * O ícone segue o snapshot, que junta canal e servidor: com o servidor mudo o
 * sino aparece riscado aqui também, e é verdade — este canal não avisa.
 */
function BotaoDeSilencio({ channelId }: { channelId: string }) {
  const silenciado = useChannel(channelId)?.silenciado ?? false;

  return (
    <Tooltip texto="Notificações do canal">
      <button
        type="button"
        className={cn(css.acao, silenciado && css.acaoAtiva)}
        aria-haspopup="dialog"
        aria-label="Notificações do canal"
        onClick={() => administrar({ tipo: "notificacoesDoCanal", channelId })}
      >
        {silenciado ? (
          <BellSimpleSlash weight="fill" />
        ) : (
          <BellSimple />
        )}
      </button>
    </Tooltip>
  );
}

/**
 * Ligar — só em DM e grupo.
 *
 * ⚠ **Assina um BOOLEANO derivado da chamada, e não a chamada.** "Estou na
 * chamada desta conversa" muda duas vezes por ligação; a chamada inteira
 * publica a cada mudo, câmera e participante, e o cabeçalho não tem nada a ver
 * com nenhum deles.
 *
 * Dentro da chamada desta conversa o botão fica em acento e traz a chamada de
 * volta para a tela — ver `ligar`. Nome estável, estado no `aria-pressed`.
 */
function BotaoDeLigar({ channelId }: { channelId: string }) {
  const aqui = useSyncExternalStore(assinarChamada, () => {
    const c = lerChamada();
    return c.estado !== "fora" && c.channelId === channelId;
  });

  return (
    <Tooltip texto={aqui ? "Voltar para a chamada" : "Iniciar chamada de voz"}>
      <button
        type="button"
        className={cn(css.acao, aqui && css.acaoAtiva)}
        aria-pressed={aqui}
        aria-label="Chamada de voz"
        onClick={() => void ligar(channelId)}
      >
        <Phone />
      </button>
    </Tooltip>
  );
}

/**
 * Um alvo desenhado que ainda não faz nada.
 *
 * Registrado em `pendente/pendencias.ts`: clicar diz o que ele vai fazer e do
 * que depende, em vez de não fazer nada. Silêncio aqui seria indistinguível de
 * um bug.
 */
function BotaoPendente({
  id,
  rotulo,
  children,
}: {
  id: PendenciaId;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip texto={rotulo}>
      <button
        type="button"
        className={css.acao}
        aria-label={rotulo}
        onClick={aindaNao(id)}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * As ações do cabeçalho de canal — os seis alvos do design.
 *
 * ⚠ **Três funcionam e três são desenho, por decisão de quem toca o produto.**
 * A régua anterior do projeto era não desenhar o que não funciona, e o lint de
 * `onSelect` existe por causa dela. A nova é construir 1:1 agora e implementar
 * numa rodada própria — os pendentes estão em `pendente/pendencias.ts`, com o
 * que fazem e do que dependem, e respondem ao clique em vez de ficarem inertes.
 *
 * A ordem é a do design, e não é arbitrária: o que muda o PAINEL fica junto
 * (tópicos, fixados, membros, caixa de entrada), e o que muda o CANAL
 * (notificações) ou abre outra superfície (busca) fica nas pontas.
 */
export function AcoesDoCanal({
  channelId,
  nome,
  tipo,
}: {
  channelId: string;
  nome: string;
  tipo: CanalTipo;
}) {
  return (
    <div className={css.acoes}>
      {/*
        Ligar vem PRIMEIRO numa conversa. Numa DM a chamada é a ação que
        distingue o lugar — numa sala de servidor quem faz esse papel é o canal
        de voz na coluna, e por isso ele não existe lá.
      */}
      {tipo === "dm" || tipo === "grupo" ? <BotaoDeLigar channelId={channelId} /> : null}

      <BotaoPendente id="topicos" rotulo="Tópicos">
        <ChatsCircle />
      </BotaoPendente>

      <BotaoDeSilencio channelId={channelId} />

      <BotaoDePainel painel="fixados">
        <PushPin />
      </BotaoDePainel>

      <BotaoDePainel painel="membros">
        <Users />
      </BotaoDePainel>

      {/* Deixou de ser pendência: o painel existe e o dado já estava no
          snapshot do canal. Ver `caixa/CaixaDeEntrada.tsx`. */}
      <BotaoDePainel painel="caixaDeEntrada">
        <Tray />
      </BotaoDePainel>

      {/*
        ⚠ **CAMPO, e era um ícone — o design desenha uma caixa de 180px com
        "Buscar em #produto" dentro.**

        Continua sendo `button` e não `input`, e agora por uma razão
        diferente da anterior: a busca EXISTE (`Channel.search`, painel
        `busca`), e o campo de verdade é o do painel. Dois campos para o mesmo
        texto seriam dois donos que precisam concordar — o mesmo argumento que
        manteve o campo da coluna de canais como botão da paleta.

        Ele abre o painel e o painel foca o campo. Fica na ponta e mostra o
        nome do canal, como o design: "buscar" sem dizer onde é ambíguo num app
        com trinta canais abertos ao longo do dia.
      */}
      <Tooltip texto="Buscar no canal">
        <GatilhoDeBusca
          className={css.busca}
          rotulo={`Buscar em #${nome}`}
          aria-label={`Buscar em ${nome}`}
          onClick={() => alternarSuperficie("busca")}
        />
      </Tooltip>
    </div>
  );
}
