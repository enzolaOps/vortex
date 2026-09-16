import { useState } from "react";

import {
  Calendar,
  CaretLeft,
  CaretRight,
  ClockCounterClockwise,
  Rows,
} from "../components/ui/icones";
import { usuarioLocalId } from "../sdk/adapter";
import { chaveDeMembro } from "../sdk/domain";
import {
  estadoDoEvento,
  eventosDaAba,
  gradeDoMes,
  grupoDoEvento,
  permissoesDeEventos,
  quandoLongo,
  ROTULO_DA_REPETICAO,
  useCargaDeEventos,
  useEventosDoServidor,
  useRelogio,
  type AbaDeEventos,
  type EventoDoServidor,
} from "../sdk/eventos";
import { administrar } from "../store/administracao";
import { useChannel, useMembro } from "../store/hooks";
import {
  AvatarDeInteressado,
  BotaoDeInteresse,
  CartaoDeEvento,
  entrarNoEvento,
  LugarDoEvento,
} from "./CartaoDeEvento";
import css from "./Eventos.module.css";

const HORA_DO_CHIP = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/**
 * Os eventos agendados de um servidor — `EventsScreen` da referência, com os
 * valores do `Vortex Eventos e Entrada.dc.html`.
 *
 * Lista e calendário compartilham o mesmo evento em duas escalas; clicar
 * abre o painel de detalhe, nunca uma página nova. O detalhe some primeiro
 * numa coluna estreita (container query), porque a lista é o lugar.
 */
export function TelaDeEventos({ serverId }: { serverId: string }) {
  const eventos = useEventosDoServidor(serverId);
  const carga = useCargaDeEventos(serverId);
  const agora = useRelogio();
  const eu = usuarioLocalId();
  const [aba, setAba] = useState<AbaDeEventos>("proximos");
  const [calendario, setCalendario] = useState(false);
  const [selecionado, setSelecionado] = useState<string | undefined>(undefined);
  const [mes, setMes] = useState<{ ano: number; mes: number } | undefined>(undefined);

  const permissoes = permissoesDeEventos(serverId);
  const visiveis = eventosDaAba(eventos, aba, eu, agora);
  const proximos = eventosDaAba(eventos, "proximos", eu, agora).length;
  const interesses = eventosDaAba(eventos, "interesses", eu, agora).length;
  /* Sem escolha explícita, o detalhe mostra o primeiro da lista — é o que o
     design desenha aberto. */
  const detalhe =
    eventos.find((e) => e.id === selecionado) ?? visiveis[0] ?? undefined;

  const hoje = new Date(agora);
  const mesVisto = mes ?? { ano: hoje.getFullYear(), mes: hoje.getMonth() };

  return (
    <div className={css.tela}>
      <div className={css.coluna}>
        <header className={css.cabecalho}>
          <h1 className={css.titulo}>
            <ClockCounterClockwise aria-hidden />
            Eventos
          </h1>
          <span className={css.divisa} aria-hidden />
          <div className={css.abas} role="tablist" aria-label="Filtro de eventos">
            <Aba atual={aba} valor="proximos" aoEscolher={setAba} contagem={proximos}>
              Próximos
            </Aba>
            <Aba atual={aba} valor="interesses" aoEscolher={setAba} contagem={interesses}>
              Meus interesses
            </Aba>
            <Aba atual={aba} valor="passados" aoEscolher={setAba}>
              Passados
            </Aba>
          </div>
          <span className={css.espaco} />
          <div className={css.vistas} role="radiogroup" aria-label="Visualização">
            <button
              type="button"
              role="radio"
              aria-checked={!calendario}
              aria-label="Lista"
              className={css.vista}
              onClick={() => setCalendario(false)}
            >
              <Rows aria-hidden />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={calendario}
              aria-label="Calendário"
              className={css.vista}
              onClick={() => setCalendario(true)}
            >
              <Calendar aria-hidden />
            </button>
          </div>
          {/* Sem direito de criar, o botão não existe — a regra do projeto:
              item cinza ensina que a ação existe e que você não a tem. */}
          {permissoes.criar ? (
            <button
              type="button"
              className={css.acaoPrimaria}
              onClick={() => administrar({ tipo: "evento", serverId })}
            >
              Criar evento
            </button>
          ) : null}
        </header>

        <div className={css.rolagem} tabIndex={0}>
          <div className={css.miolo}>
            {calendario ? (
              <Calendario
                ano={mesVisto.ano}
                mes={mesVisto.mes}
                eventos={eventos}
                agora={agora}
                aoMudarMes={(passo) =>
                  setMes({
                    ano: new Date(mesVisto.ano, mesVisto.mes + passo, 1).getFullYear(),
                    mes: new Date(mesVisto.ano, mesVisto.mes + passo, 1).getMonth(),
                  })
                }
                aoAbrir={setSelecionado}
              />
            ) : carga === "falhou" ? (
              <Vazio
                titulo="Não deu para carregar os eventos"
                detalhe="O servidor não respondeu — ele pode não ter a superfície de eventos do Vortex."
              />
            ) : carga === "carregando" && eventos.length === 0 ? (
              <Vazio titulo="Carregando eventos…" />
            ) : visiveis.length === 0 ? (
              <Vazio
                titulo="Nenhum evento aqui"
                detalhe="Eventos passados ficam disponíveis por 30 dias com a lista de quem compareceu."
              />
            ) : (
              <Lista
                eventos={visiveis}
                agora={agora}
                selecionado={detalhe?.id}
                podeGerenciar={permissoes.gerenciar}
                aoAbrir={setSelecionado}
              />
            )}
          </div>
        </div>
      </div>

      {detalhe ? <Detalhe evento={detalhe} agora={agora} eu={eu} /> : null}
    </div>
  );
}

function Aba({
  atual,
  valor,
  contagem,
  aoEscolher,
  children,
}: {
  atual: AbaDeEventos;
  valor: AbaDeEventos;
  contagem?: number;
  aoEscolher: (v: AbaDeEventos) => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={atual === valor}
      className={css.aba}
      onClick={() => aoEscolher(valor)}
    >
      {children}
      {contagem !== undefined ? <span className={css.contagemDaAba}>{contagem}</span> : null}
    </button>
  );
}

function Lista({
  eventos,
  agora,
  selecionado,
  podeGerenciar,
  aoAbrir,
}: {
  eventos: readonly EventoDoServidor[];
  agora: number;
  selecionado: string | undefined;
  podeGerenciar: boolean;
  aoAbrir: (id: string) => void;
}) {
  /* O grupo de cada um calculado antes do JSX: o cabeçalho aparece quando o
     grupo muda em relação ao ANTERIOR, e mutar uma variável dentro do `.map`
     é o que o compiler recusa. */
  const grupos = eventos.map((e) => grupoDoEvento(e, agora));
  return (
    <>
      {eventos.map((e, i) => {
        const grupo = grupos[i]!;
        const mostraGrupo = i === 0 || grupo !== grupos[i - 1];
        return (
          <div key={e.id}>
            {mostraGrupo ? <h2 className={css.grupo}>{grupo}</h2> : null}
            <CartaoDeEvento
              evento={e}
              agora={agora}
              selecionado={e.id === selecionado}
              podeGerenciar={podeGerenciar}
              aoAbrir={() => aoAbrir(e.id)}
            />
          </div>
        );
      })}
    </>
  );
}

function Vazio({ titulo, detalhe }: { titulo: string; detalhe?: string }) {
  return (
    <div className={css.vazio}>
      <div className={css.vazioIcone}>
        <ClockCounterClockwise aria-hidden />
      </div>
      <p className={css.vazioTitulo}>{titulo}</p>
      {detalhe ? <p className={css.vazioDetalhe}>{detalhe}</p> : null}
    </div>
  );
}

function Calendario({
  ano,
  mes,
  eventos,
  agora,
  aoMudarMes,
  aoAbrir,
}: {
  ano: number;
  mes: number;
  eventos: readonly EventoDoServidor[];
  agora: number;
  aoMudarMes: (passo: number) => void;
  aoAbrir: (id: string) => void;
}) {
  const dias = gradeDoMes(ano, mes, eventos, agora);
  const semanas: (typeof dias)[] = [];
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));
  const porId = new Map(eventos.map((e) => [e.id, e]));

  return (
    <>
      <div className={css.mesCabecalho}>
        <h2 className={css.mesTitulo}>{MES.format(new Date(ano, mes, 1))}</h2>
        <div className={css.navegacaoDoMes}>
          <button
            type="button"
            className={css.navegar}
            aria-label="Mês anterior"
            onClick={() => aoMudarMes(-1)}
          >
            <CaretLeft aria-hidden />
          </button>
          <button
            type="button"
            className={css.navegar}
            aria-label="Próximo mês"
            onClick={() => aoMudarMes(1)}
          >
            <CaretRight aria-hidden />
          </button>
        </div>
      </div>
      <div className={css.semana} aria-hidden>
        {DIAS_DA_SEMANA.map((d) => (
          <span key={d} className={css.diaDaSemana}>
            {d}
          </span>
        ))}
      </div>
      {semanas.map((semana) => (
        <div key={semana[0]?.data} className={css.semana}>
          {semana.map((dia) => (
            <div
              key={dia.data}
              className={css.celula}
              data-hoje={dia.hoje || undefined}
              data-fora={!dia.doMes || undefined}
            >
              <span className={css.numeroDoDia}>{dia.numero}</span>
              {dia.eventos.map((oc) => {
                const e = porId.get(oc.id);
                if (!e) return null;
                const aoVivo =
                  oc.inicio <= agora && estadoDoEvento(e, agora) === "aoVivo";
                return (
                  <button
                    key={`${oc.id}@${String(oc.inicio)}`}
                    type="button"
                    className={css.chip}
                    data-aovivo={aoVivo || undefined}
                    onClick={() => aoAbrir(e.id)}
                  >
                    {aoVivo ? "ao vivo" : HORA_DO_CHIP.format(oc.inicio)} {e.nome}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function Detalhe({
  evento,
  agora,
  eu,
}: {
  evento: EventoDoServidor;
  agora: number;
  eu: string | undefined;
}) {
  const [todos, setTodos] = useState(false);
  const organizador = useMembro(chaveDeMembro(evento.serverId, evento.criadorId));
  const canal = useChannel(evento.local.tipo === "canal" ? evento.local.channelId : "");
  const estado = estadoDoEvento(evento, agora);
  const interessado = eu !== undefined && evento.interessados.includes(eu);
  /* Quem organiza primeiro — é o "ORGANIZA" do design. */
  const pessoas = [
    evento.criadorId,
    ...evento.interessados.filter((u) => u !== evento.criadorId),
  ];
  const mostradas = todos ? pessoas : pessoas.slice(0, 3);

  return (
    <aside className={css.detalhe} aria-label="Detalhe do evento">
      <p className={css.sobrancelha}>Detalhe do evento</p>
      <div className={css.cartaoDeDetalhe}>
        <div className={css.capaLarga}>
          {evento.capaUrl ? <img src={evento.capaUrl} alt="" /> : "capa 16:9"}
          {estado === "aoVivo" ? (
            <span className={css.pilulaDaCapa}>
              <span className={css.ponto} />
              ao vivo
            </span>
          ) : null}
        </div>
        <div className={css.corpoDoDetalhe}>
          <p className={css.quandoDoDetalhe}>{quandoLongo(evento, agora)}</p>
          <h2 className={css.nomeDoDetalhe}>{evento.nome}</h2>
          {evento.descricao ? (
            <p className={css.descricaoDoDetalhe}>{evento.descricao}</p>
          ) : null}

          <div className={css.info}>
            <LugarDoEvento evento={evento} className={css.linhaDeInfo} />
            {evento.repeticao ? (
              <span className={css.linhaDeInfo}>
                <ClockCounterClockwise aria-hidden />
                {ROTULO_DA_REPETICAO[evento.repeticao]}
              </span>
            ) : null}
            <span className={css.linhaDeInfo}>
              Organizado por {organizador?.displayName ?? "…"}
            </span>
          </div>

          <div className={css.botoesDoDetalhe}>
            <BotaoDeInteresse evento={evento} interessado={interessado} />
            {estado !== "passado" ? (
              <button
                type="button"
                className={css.botaoDeCartao}
                data-tom="neutro"
                onClick={() => entrarNoEvento(evento, canal?.tipo === "voz")}
              >
                Entrar agora
              </button>
            ) : null}
          </div>

          <p className={css.sobrancelha}>Interessados · {evento.interessados.length}</p>
          <div className={css.pessoas}>
            {mostradas.map((userId) => (
              <Pessoa
                key={userId}
                serverId={evento.serverId}
                userId={userId}
                organiza={userId === evento.criadorId}
              />
            ))}
            {pessoas.length > 3 ? (
              <button
                type="button"
                className={css.verTodos}
                aria-expanded={todos}
                onClick={() => setTodos(!todos)}
              >
                {todos ? "Ver menos" : "Ver todos"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

function Pessoa({
  serverId,
  userId,
  organiza,
}: {
  serverId: string;
  userId: string;
  organiza: boolean;
}) {
  const membro = useMembro(chaveDeMembro(serverId, userId));
  return (
    <div className={css.pessoa} data-organiza={organiza || undefined}>
      <AvatarDeInteressado serverId={serverId} userId={userId} tamanho="xs" />
      <span className={css.nomeDaPessoa}>{membro?.displayName ?? "…"}</span>
      {organiza ? <span className={css.organiza}>ORGANIZA</span> : null}
    </div>
  );
}
