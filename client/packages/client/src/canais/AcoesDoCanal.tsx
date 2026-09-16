import {
  BellSimple,
  BellSimpleSlash,
  ChatsCircle,
  PushPin,
  Tray,
  Users,
} from "../components/ui/icones";
import { useSyncExternalStore } from "react";

import { cn } from "../lib/cn";
import { NOME_DO_PAINEL, type PainelId } from "../preset/schema";
import { Tooltip } from "../components/ui/Tooltip";
import { assinarLayout, painelVisivel } from "../store/layout";
import {
  alternarSuperficie,
  assinarDrawer,
  superficieAberta,
} from "../store/drawer";
import { alternarSilencio, assinarSilencio, estaSilenciado } from "../store/silencio";
import { GatilhoDeBusca } from "../components/ui/CampoDeBusca";
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
 * Silenciar o canal, do cabeçalho.
 *
 * ⚠ O menu de contexto da coluna já tinha esta ação, e o cabeçalho é onde ela é
 * PROCURADA — a coluna esconde o canal ativo atrás de um clique com o botão
 * direito, que é a afordância que menos gente descobre. As duas escrevem no
 * mesmo store, então não há estado para os dois concordarem.
 */
function BotaoDeSilencio({ channelId }: { channelId: string }) {
  const silenciado = useSyncExternalStore(assinarSilencio, () =>
    estaSilenciado(channelId),
  );

  return (
    <Tooltip texto={silenciado ? "Voltar a notificar" : "Silenciar canal"}>
      <button
        type="button"
        className={cn(css.acao, silenciado && css.acaoAtiva)}
        aria-pressed={silenciado}
        aria-label="Notificações do canal"
        onClick={() => alternarSilencio(channelId)}
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
  forum = false,
}: {
  channelId: string;
  nome: string;
  /**
   * O fórum tem TRÊS ações no design — notificações, fixadas, membros. Tópicos,
   * caixa de entrada e busca saem: os posts SÃO os tópicos do canal, e a busca
   * do fórum mora na barra dele, sobre os posts.
   */
  forum?: boolean;
}) {
  if (forum) {
    return (
      <div className={css.acoes}>
        <BotaoDeSilencio channelId={channelId} />
        <BotaoDePainel painel="fixados">
          <PushPin />
        </BotaoDePainel>
        <BotaoDePainel painel="membros">
          <Users />
        </BotaoDePainel>
      </div>
    );
  }

  return (
    <div className={css.acoes}>
      {/* Deixou de ser pendência: tópico é canal com `thread` no protocolo
          deste fork, e o painel lista os do servidor. Ver `sdk/topicos.ts`. */}
      <BotaoDePainel painel="topicos">
        <ChatsCircle />
      </BotaoDePainel>

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
