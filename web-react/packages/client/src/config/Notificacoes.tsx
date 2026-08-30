import { useSyncExternalStore } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Caixa } from "../components/ui/Marcador";
import { Interruptor } from "../components/ui/Interruptor";
import { aindaNao } from "../pendente/pendencias";
import {
  alternarDia,
  alternarNaMatriz,
  assinarNotificacoes,
  CANAIS_DE_ENTREGA,
  chaveDaMatriz,
  definirNotificacoes,
  EVENTOS_DE_NOTIFICACAO,
  lerNotificacoes,
  type CanalDeEntrega,
} from "../store/notificacoes";
import css from "./Notificacoes.module.css";
import secao from "./Secao.module.css";

const NOME_DO_CANAL: Record<CanalDeEntrega, string> = {
  toast: "Toast",
  som: "Som",
  push: "Push",
};

/** Domingo por último: o calendário começa nele, a semana de trabalho não. */
const DIAS = [
  { n: 1, letra: "S", nome: "segunda" },
  { n: 2, letra: "T", nome: "terça" },
  { n: 3, letra: "Q", nome: "quarta" },
  { n: 4, letra: "Q", nome: "quinta" },
  { n: 5, letra: "S", nome: "sexta" },
  { n: 6, letra: "S", nome: "sábado" },
  { n: 0, letra: "D", nome: "domingo" },
] as const;

function Linha({
  titulo,
  detalhe,
  ligado,
  aoAlternar,
}: {
  titulo: string;
  detalhe: string;
  ligado: boolean;
  aoAlternar: (v: boolean) => void;
}) {
  return (
    <div className={css.linha}>
      <span className={css.texto}>
        <span className={css.tituloDaLinha}>{titulo}</span>
        <span className={css.detalhe}>{detalhe}</span>
      </span>
      <Interruptor ligado={ligado} rotulo={titulo} aoAlternar={aoAlternar} />
    </div>
  );
}

/**
 * Notificações.
 *
 * ⚠ **As preferências são REAIS e ficam guardadas; o que falta é quem as
 * CONSOME.** Som precisa de áudio, push de service worker, badge de casca
 * Electron — nenhum dos três existe hoje.
 *
 * A escolha entre "não construir a tela até o motor chegar" e "construir com o
 * consumo pendente" foi tomada, e é a segunda: a regra deste projeto é
 * construir a interface 1:1 e registrar o que não funciona. A forma não muda
 * quando o notificador chegar, porque ele lê deste store.
 *
 * O único PENDENTE de verdade aqui é pedir permissão ao sistema: é chamada ao
 * navegador que só faz sentido com um notificador atrás, e não teria o que
 * guardar.
 */
export function Notificacoes() {
  const p = useSyncExternalStore(assinarNotificacoes, lerNotificacoes);

  return (
    <div className={secao.forma}>
      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Notificações</h2>

        <div className={css.linhas}>
          <Linha
            titulo="Notificações no desktop"
            detalhe="Toasts do sistema quando a janela está em segundo plano"
            ligado={p.desktop}
            aoAlternar={(v) => definirNotificacoes({ desktop: v })}
          />
          <Linha
            titulo="Notificações push no celular"
            detalhe="Enviadas quando você está inativo há mais de 2 minutos"
            ligado={p.push}
            aoAlternar={(v) => definirNotificacoes({ push: v })}
          />
          <Linha
            titulo="Prévia do conteúdo no toast"
            detalhe={
              "Desligue para mostrar só “nova mensagem” em telas compartilhadas"
            }
            ligado={p.previa}
            aoAlternar={(v) => definirNotificacoes({ previa: v })}
          />
          <Linha
            titulo="Badge de não lido no ícone do app"
            detalhe="Contador só de menções, nunca de mensagens comuns"
            ligado={p.badge}
            aoAlternar={(v) => definirNotificacoes({ badge: v })}
          />
        </div>
      </section>

      <hr className={secao.divisor} />

      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Eventos · som e notificação por tipo</h2>

        {/*
          Tabela e não pilha de cartões: são oito linhas contra três colunas, e
          a pergunta feita aqui é "o que acontece quando X?". Comparar ENTRE
          linhas é o gesto, e cartões empilhados obrigam a lembrar a coluna
          anterior enquanto se rola.
        */}
        <table className={css.matriz}>
          <thead>
            <tr>
              <th scope="col" className={css.cabecalhoDaColuna}>
                Evento
              </th>
              {CANAIS_DE_ENTREGA.map((c) => (
                <th key={c} scope="col" className={css.colunaDeCanal}>
                  {NOME_DO_CANAL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVENTOS_DE_NOTIFICACAO.map((e) => (
              <tr key={e.id}>
                <th scope="row" className={css.evento}>
                  <span className={css.eventoNome}>{e.rotulo}</span>
                  <span className={css.eventoDetalhe}>{e.detalhe}</span>
                </th>
                {CANAIS_DE_ENTREGA.map((c) => (
                  <td key={c} className={css.celula}>
                    <Caixa
                      marcado={p.matriz.has(chaveDaMatriz(e.id, c))}
                      /* O nome carrega as DUAS coordenadas: sozinho, "Toast"
                         se repetiria oito vezes na árvore de acessibilidade e
                         não diria de qual linha é. */
                      rotulo={`${NOME_DO_CANAL[c]} para ${e.rotulo}`}
                      aoAlternar={() => alternarNaMatriz(e.id, c)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <hr className={secao.divisor} />

      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Horário de silêncio</h2>

        <div className={css.linhas}>
          <Linha
            titulo="Silenciar automaticamente à noite"
            detalhe="Suprime tudo menos chamadas de amigos"
            ligado={p.silencioNoturno}
            aoAlternar={(v) => definirNotificacoes({ silencioNoturno: v })}
          />
        </div>

        {/*
          As horas só aparecem com o silêncio ligado. Campos desabilitados
          ocupariam a mesma altura dizendo "isto existe e não vale" — e a
          decisão de ligar está uma linha acima, não três telas atrás.
        */}
        {p.silencioNoturno ? (
          <div className={css.janela}>
            <label className={css.hora}>
              <span className={css.rotuloDaHora}>Das</span>
              <input
                type="time"
                className={css.campoDeHora}
                value={p.silencioDas}
                onChange={(ev) =>
                  definirNotificacoes({ silencioDas: ev.target.value })
                }
              />
            </label>

            <label className={css.hora}>
              <span className={css.rotuloDaHora}>Até</span>
              <input
                type="time"
                className={css.campoDeHora}
                value={p.silencioAte}
                onChange={(ev) =>
                  definirNotificacoes({ silencioAte: ev.target.value })
                }
              />
            </label>

            <div className={css.dias}>
              <span className={css.rotuloDaHora}>Dias</span>
              <div
                className={css.diasLinha}
                role="group"
                aria-label="Dias da semana"
              >
                {DIAS.map((d) => (
                  <button
                    key={d.n}
                    type="button"
                    className={css.dia}
                    aria-pressed={p.silencioDias.includes(d.n)}
                    /* A letra sozinha não diz o dia — três delas são "S" e
                       duas são "Q". O nome inteiro vai no rótulo. */
                    aria-label={d.nome}
                    onClick={() => alternarDia(d.n)}
                  >
                    {d.letra}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <hr className={secao.divisor} />

      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Permissão do sistema</h2>

        <Banner
          tom="aviso"
          titulo="O sistema está bloqueando notificações do Vortex"
        >
          Suas escolhas aqui não têm efeito até liberar nas preferências do
          sistema.
        </Banner>

        <div className={css.acao}>
          <Botao variante="neutro" onClick={aindaNao("permissaoDeNotificacao")}>
            Abrir ajustes
          </Botao>
        </div>

        <p className={secao.recado}>
          A resolução é uma cadeia, como a de permissões: não perturbe →
          horário de silêncio → servidor silenciado → canal silenciado → padrão
          do servidor → exceção do canal. Só o toast de chamada ignora tudo
          menos não perturbe.
        </p>
      </section>
    </div>
  );
}
