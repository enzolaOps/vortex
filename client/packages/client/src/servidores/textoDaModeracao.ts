/**
 * O que os modais de moderação ESCREVEM — puro, com `agora` por parâmetro.
 *
 * Mora fora do componente pela razão de sempre: "termina amanhã às 15:40"
 * depende da hora em que se lê, e um relógio lido no render tornaria o teste
 * dependente da hora em que roda.
 */

/**
 * As seis durações do design (D-SRVPG-39), em MINUTOS — é a unidade de
 * `castigarEmLote`, porque quem modera pensa em "meia hora".
 *
 * ⚠ 60 s é 1 minuto: o protocolo grava um instante (`timeout`), não uma
 * duração, então não há perda em escrever um no lugar do outro.
 */
export const DURACOES_DE_CASTIGO = [
  { minutos: 1, rotulo: "60 s" },
  { minutos: 5, rotulo: "5 min" },
  { minutos: 60, rotulo: "1 h" },
  { minutos: 1_440, rotulo: "1 dia" },
  { minutos: 10_080, rotulo: "1 semana" },
  { minutos: 40_320, rotulo: "28 dias" },
] as const;

/** O padrão do design (`dur: 2`). */
export const DURACAO_PADRAO = 60;

const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DIA_E_MES = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const DIA_MES_E_ANO = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function inicioDoDia(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Dias de calendário entre dois instantes — não blocos de 24h. */
function diasDeCalendario(de: number, ate: number): number {
  return Math.round((inicioDoDia(ate) - inicioDoDia(de)) / 86_400_000);
}

/**
 * "Termina <quando>" (D-SRVPG-39), na grafia do design: `em 1 minuto`,
 * `em 5 minutos`, `hoje às 16:40`, `amanhã às 15:40`, `em 4 de setembro`.
 *
 * ⚠ Hoje/amanhã são de CALENDÁRIO: uma hora de castigo aplicada às 23:30
 * termina "amanhã às 00:30", e dizer "hoje" seria errado por meia hora.
 */
export function terminoDoCastigo(agora: number, minutos: number): string {
  if (minutos < 60) {
    return minutos === 1 ? "em 1 minuto" : `em ${String(minutos)} minutos`;
  }
  const fim = agora + minutos * 60_000;
  const dias = diasDeCalendario(agora, fim);
  if (dias === 0) return `hoje às ${HORA.format(fim)}`;
  if (dias === 1) return `amanhã às ${HORA.format(fim)}`;
  /* O ano só quando muda — 28 dias em dezembro caem no ano seguinte, e "em 7
     de janeiro" sem ano leria como o janeiro que já passou. */
  const mesmoAno = new Date(fim).getFullYear() === new Date(agora).getFullYear();
  return `em ${(mesmoAno ? DIA_E_MES : DIA_MES_E_ANO).format(fim)}`;
}

/**
 * "entrou há 3 dias" — o card do alvo (D-SRVPG-41).
 *
 * `undefined` quando a data não existe: o SDK devolve `new Date(0)` para
 * membro sem `joined_at`, e `dataDeEntrada` já o traduz em ausência. Inventar
 * "entrou há 56 anos" seria pior que omitir.
 */
export function entrouHa(entrouEmMs: number | undefined, agora: number): string | undefined {
  if (entrouEmMs === undefined) return undefined;
  const dias = diasDeCalendario(entrouEmMs, agora);
  if (dias <= 0) return "entrou hoje";
  if (dias === 1) return "entrou ontem";
  if (dias < 30) return `entrou há ${String(dias)} dias`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return meses === 1 ? "entrou há 1 mês" : `entrou há ${String(meses)} meses`;
  const anos = Math.floor(dias / 365);
  return anos <= 1 ? "entrou há 1 ano" : `entrou há ${String(anos)} anos`;
}

/**
 * O ID encurtado do card de banimento — `912…4471`, como o design.
 *
 * Banir identifica pela CONTA, não pelo apelido: a conta pode nem estar mais
 * no servidor (banir quem já saiu é o caso do spam que entra e sai), e é o ID
 * que o registro de banimentos mostra depois.
 */
export function idCurto(id: string): string {
  return id.length <= 8 ? id : `${id.slice(0, 3)}…${id.slice(-4)}`;
}

/**
 * O texto do "Avisar por DM" (D-SRVPG-40).
 *
 * ⚠ **Mensagem comum, escrita pela pessoa que modera**, e não mensagem de
 * sistema: o protocolo não tem uma para isto, e criar uma nova persistida
 * quebraria `pushd`/`crond`/`voice-ingress`, que o fork não publica. Quem
 * recebe vê quem castigou — que é também o que a auditoria registra.
 */
export function avisoDeCastigo({
  servidor,
  termino,
  motivo,
}: {
  servidor: string;
  termino: string;
  motivo: string | undefined;
}): string {
  const base = `Você está de castigo em **${servidor}**. O castigo termina ${termino}.`;
  const limpo = motivo?.trim();
  return limpo ? `${base}\nMotivo: ${limpo}` : base;
}
