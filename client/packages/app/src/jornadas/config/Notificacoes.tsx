import {
  alternarNaMatriz,
  assinarNotificacoes,
  chaveDaMatriz,
  EVENTOS_DE_NOTIFICACAO,
  lerNotificacoes,
  type EventoDeNotificacao,
} from "nucleo/store/notificacoes";
import {
  assinarPreferenciasDeVoz,
  definirPreferenciasDeVoz,
  lerPreferenciasDeVoz,
} from "nucleo/store/preferenciasDeVoz";
import { useSyncExternalStore } from "react";

import { config } from "../../textos";
import { Bloco, Divisor, estilosDeConfig as ec, Interruptor, LinhaDeAjuste, Pagina } from "./controles";
import css from "./Notificacoes.module.css";

const t = config.notificacoesTela;

/**
 * Os eventos que têm quem os consuma neste app hoje: o notificador de mensagens
 * (canal, menção de pessoa, menção de cargo, mensagem direta) e o de pedido de
 * amizade. Chamada recebida, tópico e evento de servidor têm linha no armazenamento
 * mas ainda não têm jornada que os dispare — mostrar um interruptor para eles
 * seria oferecer controle que não controla nada.
 */
const EVENTOS_ATIVOS: readonly EventoDeNotificacao[] = ["mensagem", "mencaoDireta", "mencaoDeCargo", "dm", "amizade"];

/** Notificações (PRD 4.6): o que merece aviso na tela e o que merece som. */
export function Notificacoes() {
  const prefs = useSyncExternalStore(assinarNotificacoes, lerNotificacoes);
  const voz = useSyncExternalStore(assinarPreferenciasDeVoz, lerPreferenciasDeVoz);

  return (
    <Pagina>
      <Bloco>
        <h3 className={ec.titulo}>{t.avisarQuando}</h3>
        <div className={css.tabela} role="group" aria-label={t.avisarQuando}>
          <span className={css.cabecalho}> </span>
          <span className={`${css.cabecalho} ${css.cabecalhoCentro}`}>{t.colunaNotificacao}</span>
          <span className={`${css.cabecalho} ${css.cabecalhoCentro}`}>{t.colunaSom}</span>
          {EVENTOS_DE_NOTIFICACAO.filter((e) => EVENTOS_ATIVOS.includes(e.id)).map((e) => (
            <EventoDaTabela key={e.id} evento={e} prefs={prefs.matriz} />
          ))}
        </div>
      </Bloco>

      <Divisor />

      <Bloco>
        <LinhaDeAjuste nome={t.sonsDeVoz} descricao={t.sonsDeVozDica}>
          <Interruptor
            rotulo={t.sonsDeVoz}
            ligado={voz.sons}
            aoMudar={(v) => {
              definirPreferenciasDeVoz({ sons: v });
            }}
          />
        </LinhaDeAjuste>
      </Bloco>
    </Pagina>
  );
}

function EventoDaTabela({
  evento,
  prefs,
}: {
  evento: (typeof EVENTOS_DE_NOTIFICACAO)[number];
  prefs: ReadonlySet<string>;
}) {
  return (
    <>
      <div className={css.evento}>
        <span className={ec.linhaDeAjusteNome}>{evento.rotulo}</span>
        <span className={ec.dica}>{evento.detalhe}</span>
      </div>
      <div className={css.celula}>
        <Interruptor
          rotulo={t.notificacaoDe(evento.rotulo)}
          ligado={prefs.has(chaveDaMatriz(evento.id, "toast"))}
          aoMudar={() => {
            alternarNaMatriz(evento.id, "toast");
          }}
        />
      </div>
      <div className={css.celula}>
        <Interruptor
          rotulo={t.somDe(evento.rotulo)}
          ligado={prefs.has(chaveDaMatriz(evento.id, "som"))}
          aoMudar={() => {
            alternarNaMatriz(evento.id, "som");
          }}
        />
      </div>
    </>
  );
}
