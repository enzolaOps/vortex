import { useSyncExternalStore } from "react";

import { toast } from "../components/ui/toastStore";
import { ARNES_ATIVO } from "../dev/arnesAtivo";
import { createEntityStore } from "../store/entities";
import { client, conectado } from "./client";
import { ehCanalDeVoz } from "./map";

/**
 * Eventos agendados do servidor — a camada anticorrupção da superfície nova.
 *
 * ⚠ **Superfície do FORK.** O protocolo Stoat não tem evento agendado; o
 * serviço `api` deste repositório ganhou a coleção `server_events`, as rotas
 * `/servers/:id/events` (CRUD e interesse), `GET /users/@me/events` e os
 * eventos de socket `ServerEvent{Create,Update,Delete,Interest}`. Um servidor
 * Stoat sem o fork responde 404 às rotas, e a tela diz que não carregou — em
 * vez de afirmar "nenhum evento".
 *
 * Nada disto passa pelo `stoat.js`: o SDK não conhece as rotas nem os eventos.
 * `client.api` cru para escrever, o evento cru do socket para acompanhar —
 * o mesmo caminho da voz por canal e da enquete.
 */

/* ------------------------------------------------------------- domínio */

export type LocalDoEvento =
  | { readonly tipo: "canal"; readonly channelId: string }
  | { readonly tipo: "externo"; readonly url: string };

export const REPETICOES = ["semanal", "quinzenal", "mensal"] as const;
export type Repeticao = (typeof REPETICOES)[number];

export type EventoDoServidor = {
  readonly id: string;
  readonly serverId: string;
  readonly criadorId: string;
  readonly nome: string;
  readonly descricao: string | undefined;
  readonly inicioEm: number;
  readonly fimEm: number | undefined;
  readonly local: LocalDoEvento;
  readonly capaUrl: string | undefined;
  readonly repeticao: Repeticao | undefined;
  readonly lembrar: boolean;
  readonly interessados: readonly string[];
};

const REPETICAO_DO_FIO: Record<string, Repeticao> = {
  weekly: "semanal",
  biweekly: "quinzenal",
  monthly: "mensal",
};
const FIO_DA_REPETICAO: Record<Repeticao, string> = {
  semanal: "weekly",
  quinzenal: "biweekly",
  mensal: "monthly",
};

export const ROTULO_DA_REPETICAO: Record<Repeticao, string> = {
  semanal: "Semanal",
  quinzenal: "A cada 2 semanas",
  mensal: "Mensal",
};

function instante(v: unknown): number | undefined {
  if (typeof v !== "string") return undefined;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : undefined;
}

/** Traduz o evento cru. Forma inválida vira ausência. */
export function traduzirEvento(bruto: unknown): EventoDoServidor | undefined {
  if (typeof bruto !== "object" || bruto === null) return undefined;
  const e = bruto as Record<string, unknown>;
  const inicio = instante(e["starts_at"]);
  if (
    typeof e["_id"] !== "string" ||
    typeof e["server"] !== "string" ||
    typeof e["creator"] !== "string" ||
    typeof e["name"] !== "string" ||
    inicio === undefined
  ) {
    return undefined;
  }

  const l = e["location"] as { type?: unknown; channel?: unknown; url?: unknown } | undefined;
  let local: LocalDoEvento;
  if (l?.type === "Channel" && typeof l.channel === "string") {
    local = { tipo: "canal", channelId: l.channel };
  } else if (l?.type === "External" && typeof l.url === "string") {
    local = { tipo: "externo", url: l.url };
  } else {
    return undefined;
  }

  const imagem = e["image"] as { _id?: unknown; tag?: unknown } | undefined;
  const base = client.configuration?.features.autumn.url;
  const capaUrl =
    base && typeof imagem?._id === "string" && typeof imagem.tag === "string"
      ? `${base}/${imagem.tag}/${imagem._id}`
      : undefined;

  const interessados = Array.isArray(e["interested"])
    ? (e["interested"] as unknown[]).filter((u): u is string => typeof u === "string")
    : [];

  return {
    id: e["_id"],
    serverId: e["server"],
    criadorId: e["creator"],
    nome: e["name"],
    descricao:
      typeof e["description"] === "string" && e["description"] !== ""
        ? e["description"]
        : undefined,
    inicioEm: inicio,
    fimEm: instante(e["ends_at"]),
    local,
    capaUrl,
    repeticao:
      typeof e["recurrence"] === "string" ? REPETICAO_DO_FIO[e["recurrence"]] : undefined,
    lembrar: e["remind"] === true,
    interessados,
  };
}

/* ------------------------------------------------------------- tempo */

const HORA = 3_600_000;
const DIA = 24 * HORA;

/**
 * Quanto dura um evento que não disse quando acaba.
 *
 * ⚠ **Uma hora, e é decisão.** Canal de voz e de texto não exigem fim no
 * design, mas "ao vivo" precisa de um: sem janela o evento das 15h estaria
 * ao vivo para sempre. Uma hora é o tamanho de uma reunião, e é o que o design
 * desenha nos exemplos com fim ("15:00 – 16:00").
 */
export const DURACAO_SEM_FIM = HORA;

/** Soma meses no calendário local, preservando o dia quando existe. */
function somarMeses(ms: number, n: number): number {
  const d = new Date(ms);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return d.getTime();
}

function avancar(ms: number, r: Repeticao, vezes: number): number {
  switch (r) {
    case "semanal":
      return ms + vezes * 7 * DIA;
    case "quinzenal":
      return ms + vezes * 14 * DIA;
    case "mensal":
      return somarMeses(ms, vezes);
  }
}

/**
 * A ocorrência que vale AGORA: a atual se estiver acontecendo, senão a próxima.
 *
 * ⚠ **O servidor guarda só a primeira data**, e é o cliente que anda com a
 * repetição. Guardar cada ocorrência seria uma coleção que cresce sozinha;
 * derivar custa um laço curto, porque o salto semanal é aritmético e o mensal
 * é no máximo um passo por mês desde a criação.
 *
 * Evento sem repetição devolve a própria data, passada ou não.
 */
export function ocorrenciaAtual(
  e: Pick<EventoDoServidor, "inicioEm" | "fimEm" | "repeticao">,
  agora: number,
): { inicio: number; fim: number } {
  const duracao = (e.fimEm ?? e.inicioEm + DURACAO_SEM_FIM) - e.inicioEm;
  if (!e.repeticao || e.inicioEm + duracao > agora) {
    return { inicio: e.inicioEm, fim: e.inicioEm + duracao };
  }
  let vezes = 1;
  if (e.repeticao !== "mensal") {
    const passo = (e.repeticao === "semanal" ? 7 : 14) * DIA;
    vezes = Math.max(1, Math.ceil((agora - duracao - e.inicioEm) / passo));
  }
  let inicio = avancar(e.inicioEm, e.repeticao, vezes);
  while (inicio + duracao <= agora) {
    vezes += 1;
    inicio = avancar(e.inicioEm, e.repeticao, vezes);
  }
  return { inicio, fim: inicio + duracao };
}

export type EstadoDoEvento = "aoVivo" | "proximo" | "passado";

export function estadoDoEvento(
  e: Pick<EventoDoServidor, "inicioEm" | "fimEm" | "repeticao">,
  agora: number,
): EstadoDoEvento {
  const { inicio, fim } = ocorrenciaAtual(e, agora);
  if (agora >= fim) return "passado";
  return agora >= inicio ? "aoVivo" : "proximo";
}

function inicioDoDia(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Dias de calendário entre dois instantes — atravessa horário de verão sem errar. */
function diasEntre(de: number, ate: number): number {
  return Math.round((inicioDoDia(ate) - inicioDoDia(de)) / DIA);
}

export type GrupoDeEventos =
  | "Hoje"
  | "Amanhã"
  | "Esta semana"
  | "Próxima semana"
  | "Mais tarde"
  | "Passados";

export function grupoDoEvento(e: EventoDoServidor, agora: number): GrupoDeEventos {
  const estado = estadoDoEvento(e, agora);
  if (estado === "passado") return "Passados";
  if (estado === "aoVivo") return "Hoje";
  const dias = diasEntre(agora, ocorrenciaAtual(e, agora).inicio);
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias < 7) return "Esta semana";
  if (dias < 14) return "Próxima semana";
  return "Mais tarde";
}

export type AbaDeEventos = "proximos" | "interesses" | "passados";

/** Quanto tempo um evento passado continua listado — o que a tela promete. */
export const PASSADOS_POR = 30 * DIA;

/**
 * Os eventos de uma aba, na ordem em que a lista os desenha.
 *
 * Próximos e interesses por quando COMEÇAM (o ao vivo primeiro, porque
 * começou antes); passados do mais recente para trás, e só os dos últimos 30
 * dias — é o que o estado vazio da tela diz.
 */
export function eventosDaAba(
  eventos: readonly EventoDoServidor[],
  aba: AbaDeEventos,
  eu: string | undefined,
  agora: number,
): readonly EventoDoServidor[] {
  const comEstado = eventos.map((e) => ({
    e,
    estado: estadoDoEvento(e, agora),
    quando: ocorrenciaAtual(e, agora),
  }));
  if (aba === "passados") {
    return comEstado
      .filter((x) => x.estado === "passado" && agora - x.quando.fim <= PASSADOS_POR)
      .sort((a, b) => b.quando.inicio - a.quando.inicio)
      .map((x) => x.e);
  }
  return comEstado
    .filter(
      (x) =>
        x.estado !== "passado" &&
        (aba === "proximos" || (eu !== undefined && x.e.interessados.includes(eu))),
    )
    .sort((a, b) => a.quando.inicio - b.quando.inicio)
    .map((x) => x.e);
}

const HORA_FMT = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DIA_FMT = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const DIA_CURTO_FMT = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

/** A sigla do fuso local — "BRT" — ou nada, se o navegador não tiver uma. */
export function siglaDoFuso(ms: number): string | undefined {
  const parte = new Intl.DateTimeFormat("pt-BR", { timeZoneName: "short" })
    .formatToParts(new Date(ms))
    .find((p) => p.type === "timeZoneName");
  return parte?.value;
}

/**
 * "15:00 – 16:00" para hoje e amanhã, "8 set · 19:00" para o resto.
 *
 * O grupo já diz o dia quando é hoje ou amanhã; repeti-lo no cartão seria a
 * mesma informação duas vezes numa linha de 12px.
 */
export function quandoCurto(e: EventoDoServidor, agora: number): string {
  const { inicio, fim } = ocorrenciaAtual(e, agora);
  const dias = diasEntre(agora, inicio);
  const faixa =
    e.fimEm === undefined
      ? HORA_FMT.format(inicio)
      : `${HORA_FMT.format(inicio)} – ${HORA_FMT.format(fim)}`;
  if (dias === 0 || dias === 1) return faixa;
  return `${DIA_CURTO_FMT.format(inicio).replace(".", "")} · ${HORA_FMT.format(inicio)}`;
}

/** "Hoje · 15:00 – 16:00 (BRT)" — o detalhe e a prévia. */
export function quandoLongo(e: Pick<EventoDoServidor, "inicioEm" | "fimEm" | "repeticao">, agora: number): string {
  const { inicio, fim } = ocorrenciaAtual(e, agora);
  const dias = diasEntre(agora, inicio);
  const dia = dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : DIA_FMT.format(inicio);
  const faixa =
    e.fimEm === undefined
      ? HORA_FMT.format(inicio)
      : `${HORA_FMT.format(inicio)} – ${HORA_FMT.format(fim)}`;
  const fuso = siglaDoFuso(inicio);
  return `${dia} · ${faixa}${fuso ? ` (${fuso})` : ""}`;
}

/* ------------------------------------------------------------ formulário */

/**
 * "03/09/2026" → dia, mês (0–11) e ano. Data que não existe (31/02) é ausência.
 *
 * Campo de texto e não `<input type="date">`: o nativo é desenhado pelo
 * sistema, com o cromo claro num app escuro — a mesma regra que trocou os
 * `<select>` —, e o design desenha texto.
 */
export function lerData(texto: string): { dia: number; mes: number; ano: number } | undefined {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(texto);
  if (!m) return undefined;
  const dia = Number(m[1]);
  const mes = Number(m[2]) - 1;
  const ano = Number(m[3]);
  const d = new Date(ano, mes, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes || d.getDate() !== dia) return undefined;
  return { dia, mes, ano };
}

/** "15:00" → minutos desde a meia-noite. */
export function lerHora(texto: string): number | undefined {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(texto);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return undefined;
  return h * 60 + min;
}

export type Fuso = "local" | "utc";

/** O instante de uma data e hora num fuso. */
export function instanteDe(
  data: { dia: number; mes: number; ano: number },
  minutos: number,
  fuso: Fuso,
): number {
  const h = Math.floor(minutos / 60);
  const min = minutos % 60;
  return fuso === "utc"
    ? Date.UTC(data.ano, data.mes, data.dia, h, min)
    : new Date(data.ano, data.mes, data.dia, h, min).getTime();
}

/**
 * Início e fim de um formulário, ou o motivo de não haver.
 *
 * Fim ANTES do início quer dizer o dia seguinte — "22:00 às 01:00" é uma
 * madrugada, não um erro de digitação. Fim IGUAL ao início é erro: um evento
 * de duração zero nunca estaria ao vivo.
 */
export function intervaloDoFormulario(
  dataTexto: string,
  horaTexto: string,
  fimTexto: string,
  fuso: Fuso,
  fimObrigatorio: boolean,
):
  | { readonly ok: true; readonly inicioEm: number; readonly fimEm: number | undefined }
  | { readonly ok: false; readonly erro: string } {
  const data = lerData(dataTexto);
  if (!data) return { ok: false, erro: "Data no formato dd/mm/aaaa." };
  const hora = lerHora(horaTexto);
  if (hora === undefined) return { ok: false, erro: "Hora no formato hh:mm." };
  const inicioEm = instanteDe(data, hora, fuso);
  if (fimTexto.trim() === "") {
    return fimObrigatorio
      ? { ok: false, erro: "Link externo precisa de horário de fim." }
      : { ok: true, inicioEm, fimEm: undefined };
  }
  const fim = lerHora(fimTexto);
  if (fim === undefined) return { ok: false, erro: "Fim no formato hh:mm." };
  if (fim === hora) return { ok: false, erro: "O fim precisa ser depois do início." };
  let fimEm = instanteDe(data, fim, fuso);
  if (fim < hora) fimEm += DIA;
  return { ok: true, inicioEm, fimEm };
}

/** "03/09/2026" e "15:00" de um instante, no fuso — para editar. */
export function textosDe(ms: number, fuso: Fuso): { data: string; hora: string } {
  const d = new Date(ms);
  const dia = fuso === "utc" ? d.getUTCDate() : d.getDate();
  const mes = (fuso === "utc" ? d.getUTCMonth() : d.getMonth()) + 1;
  const ano = fuso === "utc" ? d.getUTCFullYear() : d.getFullYear();
  const h = fuso === "utc" ? d.getUTCHours() : d.getHours();
  const min = fuso === "utc" ? d.getUTCMinutes() : d.getMinutes();
  const dois = (n: number) => String(n).padStart(2, "0");
  return { data: `${dois(dia)}/${dois(mes)}/${String(ano)}`, hora: `${dois(h)}:${dois(min)}` };
}

/* ---------------------------------------------------------- calendário */

export type DiaDoCalendario = {
  readonly data: number;
  readonly numero: number;
  readonly doMes: boolean;
  readonly hoje: boolean;
  readonly eventos: readonly { readonly id: string; readonly inicio: number }[];
};

/**
 * A grade de um mês, começando no domingo, com as ocorrências de cada dia.
 *
 * Repetição expande DENTRO do mês: um evento semanal aparece em toda quinta,
 * que é o que o design desenha ("15:00 Design crit" em quatro semanas).
 */
export function gradeDoMes(
  ano: number,
  mes: number,
  eventos: readonly EventoDoServidor[],
  agora: number,
): readonly DiaDoCalendario[] {
  const primeiro = new Date(ano, mes, 1);
  const inicioGrade = new Date(ano, mes, 1 - primeiro.getDay());
  const ultimo = new Date(ano, mes + 1, 0);
  const celulas = Math.ceil((primeiro.getDay() + ultimo.getDate()) / 7) * 7;
  const fimDaGrade = new Date(
    inicioGrade.getFullYear(),
    inicioGrade.getMonth(),
    inicioGrade.getDate() + celulas,
  ).getTime();

  const porDia = new Map<number, { id: string; inicio: number }[]>();
  for (const e of eventos) {
    const duracao = (e.fimEm ?? e.inicioEm + DURACAO_SEM_FIM) - e.inicioEm;
    let vez = 0;
    let inicio = e.inicioEm;
    while (inicio < fimDaGrade) {
      if (inicio + duracao > inicioGrade.getTime()) {
        const chave = inicioDoDia(inicio);
        const lista = porDia.get(chave) ?? [];
        lista.push({ id: e.id, inicio });
        porDia.set(chave, lista);
      }
      if (!e.repeticao) break;
      vez += 1;
      inicio = avancar(e.inicioEm, e.repeticao, vez);
    }
  }

  const hoje = inicioDoDia(agora);
  const dias: DiaDoCalendario[] = [];
  for (let i = 0; i < celulas; i += 1) {
    const d = new Date(inicioGrade.getFullYear(), inicioGrade.getMonth(), inicioGrade.getDate() + i);
    const chave = d.getTime();
    dias.push({
      data: chave,
      numero: d.getDate(),
      doMes: d.getMonth() === mes,
      hoje: chave === hoje,
      eventos: (porDia.get(chave) ?? []).sort((a, b) => a.inicio - b.inicio),
    });
  }
  return dias;
}

/* -------------------------------------------------------------- lembrete */

/** Antecedência do lembrete — "10 min antes de começar". */
export const LEMBRETE_ANTES = 10 * 60_000;

/**
 * As ocorrências que merecem lembrete agora.
 *
 * Chave `id@início`, e não só o ID: um evento semanal lembra toda semana, e a
 * mesma chave o silenciaria depois da primeira. Só dispara DENTRO da janela
 * de dez minutos — quem abre o app no meio do evento não recebe "começa em 10
 * minutos" sobre algo que já começou.
 */
export function lembretesDevidos(
  eventos: readonly EventoDoServidor[],
  eu: string | undefined,
  agora: number,
  jaAvisados: ReadonlySet<string>,
  /**
   * "Notificar eventos do servidor" (D-NOTIF-12), por servidor. Evento de
   * servidor calado não é devido — e não vira "avisado": religar o
   * interruptor dentro da janela ainda lembra.
   */
  servidorNotifica: (serverId: string) => boolean = () => true,
): readonly { readonly chave: string; readonly evento: EventoDoServidor }[] {
  if (eu === undefined) return [];
  const devidos: { chave: string; evento: EventoDoServidor }[] = [];
  for (const e of eventos) {
    if (!e.lembrar || !e.interessados.includes(eu)) continue;
    if (!servidorNotifica(e.serverId)) continue;
    const { inicio } = ocorrenciaAtual(e, agora);
    if (agora < inicio - LEMBRETE_ANTES || agora >= inicio) continue;
    const chave = `${e.id}@${String(inicio)}`;
    if (!jaAvisados.has(chave)) devidos.push({ chave, evento: e });
  }
  return devidos;
}

/* ----------------------------------------------------------------- store */

const VAZIO: readonly EventoDoServidor[] = [];

/**
 * Eventos por SERVIDOR, como lista pronta.
 *
 * ⚠ **Lista de objetos e não de IDs**, ao contrário do resto do app. A tela
 * de eventos ordena e agrupa por data, e isso exige ler todos os eventos do
 * servidor a cada mudança — com IDs, o componente teria de assinar cada um.
 * A conta que justifica IDs (dez mil linhas, presença piscando) não existe
 * aqui: um servidor tem dezenas de eventos e eles mudam por ação humana.
 */
const porServidor = createEntityStore<readonly EventoDoServidor[]>((serverId) => {
  void carregarEventos(serverId);
});
/** Estado de carga por servidor, para a tela distinguir vazio de falha. */
export type CargaDeEventos = "carregando" | "pronto" | "falhou";
const cargas = createEntityStore<CargaDeEventos>();
const carregados = new Set<string>();
/** id → evento, para achar o servidor de um evento vindo do socket. */
const indice = new Map<string, EventoDoServidor>();

function publicar(serverId: string): void {
  const lista: EventoDoServidor[] = [];
  for (const e of indice.values()) if (e.serverId === serverId) lista.push(e);
  porServidor.set(serverId, lista);
}

export function gravarEvento(e: EventoDoServidor): void {
  indice.set(e.id, e);
  publicar(e.serverId);
}

function esquecerEvento(id: string): void {
  const e = indice.get(id);
  if (!e) return;
  indice.delete(id);
  publicar(e.serverId);
}

export function lerEvento(id: string): EventoDoServidor | undefined {
  return indice.get(id);
}

export function lerTodosOsEventos(): readonly EventoDoServidor[] {
  return [...indice.values()];
}

export function useEventosDoServidor(serverId: string): readonly EventoDoServidor[] {
  return useSyncExternalStore(
    porServidor.subscriber(serverId),
    () => porServidor.getSnapshot(serverId) ?? VAZIO,
  );
}

export function useCargaDeEventos(serverId: string): CargaDeEventos {
  return useSyncExternalStore(
    cargas.subscriber(serverId),
    () => cargas.getSnapshot(serverId) ?? "carregando",
  );
}

/** Estado limpo entre testes. */
export function limparEventos(): void {
  indice.clear();
  carregados.clear();
}

/* --------------------------------------------------------------- socket */

type EventoBruto = {
  type?: string;
  v?: readonly unknown[];
  event?: unknown;
  id?: string;
  server?: string;
  user_id?: string;
  interested?: boolean;
};

/** Anota um evento cru do socket. Devolve se algo mudou. */
export function anotarEventoDeServidor(evento: unknown): boolean {
  const e = evento as EventoBruto;
  switch (e.type) {
    case "Bulk": {
      let mudou = false;
      for (const item of e.v ?? []) mudou = anotarEventoDeServidor(item) || mudou;
      return mudou;
    }
    case "ServerEventCreate":
    case "ServerEventUpdate": {
      const traduzido = traduzirEvento(e.event);
      if (!traduzido) return false;
      gravarEvento(traduzido);
      return true;
    }
    case "ServerEventDelete":
      if (!e.id || !indice.has(e.id)) return false;
      esquecerEvento(e.id);
      return true;
    case "ServerEventInterest": {
      if (!e.id || !e.user_id) return false;
      return aplicarInteresse(e.id, e.user_id, e.interested === true);
    }
    case "ServerDelete": {
      let mudou = false;
      for (const ev of [...indice.values()]) {
        if (ev.serverId !== e.id) continue;
        esquecerEvento(ev.id);
        mudou = true;
      }
      return mudou;
    }
    default:
      return false;
  }
}

/** Marca ou desmarca interesse no store. Devolve se mudou. */
export function aplicarInteresse(id: string, userId: string, interessado: boolean): boolean {
  const atual = indice.get(id);
  if (!atual) return false;
  const tem = atual.interessados.includes(userId);
  if (tem === interessado) return false;
  gravarEvento({
    ...atual,
    interessados: interessado
      ? [...atual.interessados, userId]
      : atual.interessados.filter((u) => u !== userId),
  });
  return true;
}

/* ---------------------------------------------------------------- rede */

function erroDeEvento(titulo: string): void {
  toast({
    tipo: "erro",
    titulo,
    descricao: "Este servidor pode não ter eventos — eles são do fork do Vortex.",
  });
}

/** Busca os eventos de um servidor. Uma vez por sessão; o socket mantém. */
export async function carregarEventos(serverId: string, forcar = false): Promise<void> {
  if (!serverId || (carregados.has(serverId) && !forcar)) return;
  if (ARNES_ATIVO || !conectado()) {
    cargas.set(serverId, "pronto");
    return;
  }
  carregados.add(serverId);
  cargas.set(serverId, "carregando");
  try {
    const lista = (await client.api.get(
      `/servers/${serverId}/events` as never,
    )) as unknown as unknown[];
    for (const bruto of lista) {
      const e = traduzirEvento(bruto);
      if (e) gravarEvento(e);
    }
    cargas.set(serverId, "pronto");
  } catch {
    carregados.delete(serverId);
    cargas.set(serverId, "falhou");
  }
}

/** Os eventos em que marquei interesse, de todos os servidores — para o lembrete. */
export async function carregarMeusInteresses(): Promise<void> {
  if (ARNES_ATIVO || !conectado()) return;
  try {
    const lista = (await client.api.get("/users/@me/events" as never)) as unknown as unknown[];
    for (const bruto of lista) {
      const e = traduzirEvento(bruto);
      if (e) gravarEvento(e);
    }
  } catch {
    /* Servidor sem o fork: sem lembrete, e sem aviso — ninguém pediu nada. */
  }
}

export type DadosDoEvento = {
  readonly nome: string;
  readonly descricao: string;
  readonly inicioEm: number;
  readonly fimEm: number | undefined;
  readonly local: LocalDoEvento;
  readonly repeticao: Repeticao | undefined;
  readonly lembrar: boolean;
  /**
   * A capa já subida ao `autumn` (tag `banners`), ou nada.
   *
   * ID e não arquivo: o upload é do servidor de MÍDIA, fora da API, e quem o
   * faz é `sdk/anexos.ts`. Ausente ao editar quer dizer "não mexa" — trocar a
   * capa manda um ID novo, e remover não tem controle no assistente.
   */
  readonly capaId?: string;
};

/**
 * O corpo de criar e editar.
 *
 * Editar manda `remove` para o que ficou vazio: o servidor substitui campo a
 * campo e ausência significa "não mexa", então apagar a descrição precisa ser
 * dito — sem isto, limpar o campo e salvar deixaria a antiga gravada.
 */
export function corpoDoEvento(d: DadosDoEvento, editando: boolean): Record<string, unknown> {
  const descricao = d.descricao.trim();
  const corpo: Record<string, unknown> = {
    name: d.nome.trim(),
    starts_at: new Date(d.inicioEm).toISOString(),
    location:
      d.local.tipo === "canal"
        ? { type: "Channel", channel: d.local.channelId }
        : { type: "External", url: d.local.url.trim() },
    remind: d.lembrar,
  };
  const remover: string[] = [];
  if (descricao !== "") corpo["description"] = descricao;
  else if (editando) remover.push("Description");
  if (d.fimEm !== undefined) corpo["ends_at"] = new Date(d.fimEm).toISOString();
  else if (editando) remover.push("EndsAt");
  if (d.capaId) corpo["image"] = d.capaId;
  if (d.repeticao) corpo["recurrence"] = FIO_DA_REPETICAO[d.repeticao];
  else if (editando) remover.push("Recurrence");
  if (editando) corpo["remove"] = remover;
  return corpo;
}

export async function criarEvento(
  serverId: string,
  d: DadosDoEvento,
  eu: string | undefined,
): Promise<boolean> {
  if (ARNES_ATIVO) {
    /* O arnês não tem servidor: o evento nasce só no store, pelo mesmo
       arranjo da simulação de envio, para a tela ser verificável. */
    gravarEvento({
      id: `arnes-${String(Date.now())}`,
      serverId,
      criadorId: eu ?? "",
      nome: d.nome.trim(),
      descricao: d.descricao.trim() || undefined,
      inicioEm: d.inicioEm,
      fimEm: d.fimEm,
      local: d.local,
      capaUrl: undefined,
      repeticao: d.repeticao,
      lembrar: d.lembrar,
      interessados: eu ? [eu] : [],
    });
    return true;
  }
  try {
    const bruto = await client.api.post(
      `/servers/${serverId}/events` as never,
      corpoDoEvento(d, false) as never,
    );
    const e = traduzirEvento(bruto);
    if (e) gravarEvento(e);
    return true;
  } catch {
    erroDeEvento("Não deu para criar o evento.");
    return false;
  }
}

export async function editarEvento(id: string, d: DadosDoEvento): Promise<boolean> {
  const atual = lerEvento(id);
  if (!atual) return false;
  if (ARNES_ATIVO) {
    gravarEvento({
      ...atual,
      nome: d.nome.trim(),
      descricao: d.descricao.trim() || undefined,
      inicioEm: d.inicioEm,
      fimEm: d.fimEm,
      local: d.local,
      repeticao: d.repeticao,
      lembrar: d.lembrar,
    });
    return true;
  }
  try {
    const bruto = await client.api.patch(
      `/servers/${atual.serverId}/events/${id}` as never,
      corpoDoEvento(d, true) as never,
    );
    const e = traduzirEvento(bruto);
    if (e) gravarEvento(e);
    return true;
  } catch {
    erroDeEvento("Não deu para salvar o evento.");
    return false;
  }
}

export async function apagarEvento(id: string): Promise<boolean> {
  const atual = lerEvento(id);
  if (!atual) return false;
  if (!ARNES_ATIVO) {
    try {
      await client.api.delete(`/servers/${atual.serverId}/events/${id}` as never);
    } catch {
      erroDeEvento("Não deu para excluir o evento.");
      return false;
    }
  }
  esquecerEvento(id);
  return true;
}

/**
 * "Tenho interesse" — otimista, com reversão.
 *
 * O eco do socket (`ServerEventInterest`) é o mesmo estado e não muda nada.
 */
export async function alternarInteresse(id: string, eu: string | undefined): Promise<void> {
  const atual = lerEvento(id);
  if (!atual || eu === undefined) return;
  const quero = !atual.interessados.includes(eu);
  aplicarInteresse(id, eu, quero);
  if (ARNES_ATIVO) return;
  try {
    const rota = `/servers/${atual.serverId}/events/${id}/interested` as never;
    if (quero) await client.api.put(rota);
    else await client.api.delete(rota);
  } catch {
    aplicarInteresse(id, eu, !quero);
    erroDeEvento("Não deu para marcar interesse.");
  }
}

/* ------------------------------------------------------------- permissão */

/** Os bits do fork — fora da tabela do `stoat.js`, que não os conhece. */
export const BIT_GERENCIAR_EVENTOS = 1n << 41n;
export const BIT_CRIAR_EVENTOS = 1n << 42n;

/**
 * O que eu posso fazer com eventos neste servidor.
 *
 * ⚠ **Bit cru e não `havePermission`**: o nome não existe na tabela do SDK, e
 * `havePermission("ManageEvents")` estouraria ao misturar `undefined` com
 * `BigInt`. Sem sessão (o arnês) tudo é permitido, pela mesma regra estreita
 * de `sdk/permissoes.ts`.
 */
export function permissoesDeEventos(serverId: string): {
  readonly criar: boolean;
  readonly gerenciar: boolean;
} {
  if (client.user === undefined) return { criar: true, gerenciar: true };
  try {
    const p = client.servers.get(serverId)?.permission ?? 0n;
    const gerenciar = (p & BIT_GERENCIAR_EVENTOS) === BIT_GERENCIAR_EVENTOS;
    return { gerenciar, criar: gerenciar || (p & BIT_CRIAR_EVENTOS) === BIT_CRIAR_EVENTOS };
  } catch {
    return { criar: false, gerenciar: false };
  }
}

/**
 * Os canais onde um evento pode acontecer, já separados por tipo.
 *
 * Leitura síncrona e pontual: o assistente pergunta uma vez ao abrir, e uma
 * lista de canais que muda enquanto alguém preenche um formulário não é caso
 * que valha uma subscrição por canal.
 */
export function canaisParaEventos(
  serverId: string,
): { readonly voz: readonly CanalDoEvento[]; readonly texto: readonly CanalDoEvento[] } {
  const voz: CanalDoEvento[] = [];
  const texto: CanalDoEvento[] = [];
  for (const c of client.servers.get(serverId)?.channels ?? []) {
    (ehCanalDeVoz(c) ? voz : texto).push({ id: c.id, nome: c.name });
  }
  return { voz, texto };
}

export type CanalDoEvento = { readonly id: string; readonly nome: string };

/* --------------------------------------------------------------- relógio */

/**
 * O minuto atual, assinável.
 *
 * ⚠ **A tela de eventos depende do relógio e não pode lê-lo no render** —
 * `Date.now()` ali é impuro, e "ao vivo", o grupo "Hoje" e o lembrete mudam
 * sozinhos com o tempo. Um relógio de minuto cheio, com UM intervalo para
 * todos os assinantes, é o que faz o cartão virar "ao vivo" às 15:00 sem
 * ninguém clicar.
 */
const MINUTO = 60_000;
let agoraArredondado = Math.floor(Date.now() / MINUTO) * MINUTO;
const ouvintesDoRelogio = new Set<() => void>();
let intervaloDoRelogio: ReturnType<typeof setInterval> | undefined;

function tique(): void {
  const agora = Math.floor(Date.now() / MINUTO) * MINUTO;
  if (agora === agoraArredondado) return;
  agoraArredondado = agora;
  for (const o of ouvintesDoRelogio) o();
}

export function assinarRelogio(ouvinte: () => void): () => void {
  ouvintesDoRelogio.add(ouvinte);
  tique();
  intervaloDoRelogio ??= setInterval(tique, 10_000);
  return () => {
    ouvintesDoRelogio.delete(ouvinte);
    if (ouvintesDoRelogio.size === 0 && intervaloDoRelogio !== undefined) {
      clearInterval(intervaloDoRelogio);
      intervaloDoRelogio = undefined;
    }
  };
}

export function lerRelogio(): number {
  return agoraArredondado;
}

export function useRelogio(): number {
  return useSyncExternalStore(assinarRelogio, lerRelogio);
}
