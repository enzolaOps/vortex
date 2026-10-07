/**
 * "Quando" relativo, na grafia do design: `há 3 h`, `ontem 18:40`, `2 dias`.
 *
 * Duas formas, porque o design usa duas:
 *
 * - **`detalhado`** — o metadado de um post (`ontem 18:40`, `há 6 h`). Diz a
 *   hora quando ela ajuda a localizar a conversa.
 * - **`curto`** — a última atividade de um tópico no painel (`09:14`,
 *   `ontem`, `2 dias`). Cabe ao lado de um nome numa coluna de 340px.
 *
 * `agora` entra por parâmetro para a função ser pura: um relógio lido aqui
 * tornaria o teste dependente da hora em que roda.
 */

const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DIA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

const MINUTO = 60_000;
const HORA_MS = 60 * MINUTO;

function inicioDoDia(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function quando(ms: number, agora: number, forma: "detalhado" | "curto"): string {
  const hoje = inicioDoDia(agora);
  const dias = Math.round((hoje - inicioDoDia(ms)) / (24 * HORA_MS));
  const decorrido = Math.max(0, agora - ms);

  if (dias <= 0) {
    if (forma === "curto") return HORA.format(ms);
    if (decorrido < MINUTO) return "agora";
    if (decorrido < HORA_MS) return `há ${Math.floor(decorrido / MINUTO)} min`;
    return `há ${Math.floor(decorrido / HORA_MS)} h`;
  }
  if (dias === 1) return forma === "curto" ? "ontem" : `ontem ${HORA.format(ms)}`;
  if (dias < 7) return `${dias} dias`;
  return DIA.format(ms);
}
