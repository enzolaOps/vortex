/**
 * O estado da conexão, para a interface.
 *
 * Store module-level e não Context, pela lei nº 1: quem muda isto é um evento
 * de socket, que não está em árvore de componente nenhuma. E o valor é uma
 * string comparada por `Object.is`, então quem assina só acorda quando o
 * estado realmente muda.
 *
 * Os três estados do SDK viram três porque são exatamente as três respostas
 * que a interface precisa dar — "tudo bem", "espere" e "não deu" — e não
 * porque o protocolo tem três.
 */
export type EstadoDaConexao = "conectado" | "reconectando" | "sem-conexao";

/**
 * Quanto tempo fora do ar antes de AVISAR.
 *
 * Reconexão de socket é frequente e quase sempre invisível: um segundo de
 * túnel, um wi-fi trocando de ponto. Uma faixa que pisca a cada engasgo ensina
 * a ignorá-la, e aí ela não serve para o caso que importa — a queda que dura.
 *
 * Um segundo e meio é o ponto onde a pessoa já percebeu que algo travou. Antes
 * disso o silêncio é mais honesto que o aviso.
 */
const ESPERA_ANTES_DE_AVISAR = 1500;

let estado: EstadoDaConexao = "conectado";
/** O que o SDK disse, antes da espera. */
let bruto: EstadoDaConexao = "conectado";
let agendado: ReturnType<typeof setTimeout> | undefined;

const ouvintes = new Set<() => void>();

export function assinarConexao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável: uma string. */
export function lerConexao(): EstadoDaConexao {
  return estado;
}

function publicar(novo: EstadoDaConexao) {
  if (estado === novo) return;
  estado = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * O SDK mudou de estado.
 *
 * Voltar a "conectado" é IMEDIATO; sair dele espera. A assimetria é o ponto:
 * ninguém precisa ser avisado com atraso de que voltou a funcionar, e um aviso
 * que demora a sumir depois de resolvido é pior que não ter havido aviso.
 */
export function definirConexao(novo: EstadoDaConexao): void {
  bruto = novo;

  if (agendado !== undefined) {
    clearTimeout(agendado);
    agendado = undefined;
  }

  if (novo === "conectado") {
    publicar("conectado");
    return;
  }

  // Já estava avisando: troca o texto na hora, sem reiniciar a espera. Sair de
  // "reconectando" para "sem-conexão" é uma piora, e fazer a pessoa esperar
  // de novo para saber disso seria esconder a informação nova.
  if (estado !== "conectado") {
    publicar(novo);
    return;
  }

  agendado = setTimeout(() => {
    agendado = undefined;
    publicar(bruto);
  }, ESPERA_ANTES_DE_AVISAR);
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparConexao(): void {
  if (agendado !== undefined) clearTimeout(agendado);
  agendado = undefined;
  estado = "conectado";
  bruto = "conectado";
}
