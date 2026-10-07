/**
 * O último lugar de cada servidor: a sala que estava aberta no widget e o canal
 * de texto que estava na área principal.
 *
 * Preferência do dispositivo, nunca do preset e nunca do servidor: guarda IDs de
 * servidor e de canal, a família de dado que o schema de preset torna
 * irrepresentável de propósito. É o que faz "abrir o servidor" cair onde a
 * pessoa parou, e não no primeiro canal da lista (PRD §8 nº 2).
 *
 * Referência cacheada por servidor: `getSnapshot` compara por `Object.is`, e
 * montar `{ sala, texto }` na leitura seria o loop de render do briefing.
 */
import { canaisDeTexto, canaisDeVoz } from "../sdk/adapter";
import { irPara } from "./navegacao";

const CHAVE = "vortex:ultimo-lugar";

export type UltimoLugar = {
  /** A sala de voz exibida no widget. Não é "estar conectado": é só a última vista. */
  readonly sala: string | undefined;
  /** O canal de texto aberto na área principal. */
  readonly texto: string | undefined;
};

type Guardado = { servidor: string | undefined; lugares: Record<string, UltimoLugar> };

const SEM_LUGAR: UltimoLugar = { sala: undefined, texto: undefined };
const ouvintes = new Set<() => void>();

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

function ler(): Guardado {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return { servidor: undefined, lugares: {} };
    const v = JSON.parse(bruto) as { servidor?: unknown; lugares?: unknown };
    const lugares: Record<string, UltimoLugar> = {};
    if (typeof v.lugares === "object" && v.lugares !== null) {
      for (const [id, l] of Object.entries(v.lugares)) {
        const c = l as { sala?: unknown; texto?: unknown };
        lugares[id] = { sala: texto(c.sala), texto: texto(c.texto) };
      }
    }
    return { servidor: texto(v.servidor), lugares };
  } catch {
    // Valor corrompido ou armazenamento bloqueado: sem memória, sem drama.
    return { servidor: undefined, lugares: {} };
  }
}

let guardado: Guardado = ler();

function gravar(novo: Guardado): void {
  guardado = novo;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(novo));
  } catch {
    // A preferência vale para esta sessão e acabou.
  }
  for (const o of ouvintes) o();
}

export function assinarUltimoLugar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerUltimoLugar(serverId: string): UltimoLugar {
  return guardado.lugares[serverId] ?? SEM_LUGAR;
}

/** O último servidor aberto, ou nada. */
export function lerUltimoServidor(): string | undefined {
  return guardado.servidor;
}

function mudar(serverId: string, parcial: Partial<UltimoLugar>, servidor = serverId): void {
  const atual = lerUltimoLugar(serverId);
  const novo = { ...atual, ...parcial };
  if (novo.sala === atual.sala && novo.texto === atual.texto && guardado.servidor === servidor) return;
  gravar({ servidor, lugares: { ...guardado.lugares, [serverId]: novo } });
}

/** Mostrar uma sala no widget. Não conecta a nada. */
export function lembrarSala(serverId: string, canalId: string): void {
  mudar(serverId, { sala: canalId });
}

export function lembrarTexto(serverId: string, canalId: string): void {
  mudar(serverId, { texto: canalId });
}

/**
 * Abre um servidor onde a pessoa parou: o último canal de texto que ainda existe
 * (ou o primeiro) na área principal. A sala do widget é resolvida por quem a
 * desenha, porque ela também depende de a sala ainda existir.
 */
export function abrirServidor(serverId: string): void {
  const texto = escolherTexto(serverId);
  mudar(serverId, texto === undefined ? {} : { texto });
  irPara(serverId, texto);
}

/** Abre um canal de texto de um servidor e o lembra. */
export function abrirTexto(serverId: string, canalId: string): void {
  lembrarTexto(serverId, canalId);
  irPara(serverId, canalId);
}

function escolherTexto(serverId: string): string | undefined {
  const existentes = canaisDeTexto.peek(serverId) ?? [];
  const lembrado = lerUltimoLugar(serverId).texto;
  if (lembrado !== undefined && existentes.includes(lembrado)) return lembrado;
  return existentes[0];
}

/** A sala a mostrar no widget: a lembrada, se ainda existe, senão a primeira. */
export function escolherSala(serverId: string): string | undefined {
  const existentes = canaisDeVoz.peek(serverId) ?? [];
  const lembrada = lerUltimoLugar(serverId).sala;
  if (lembrada !== undefined && existentes.includes(lembrada)) return lembrada;
  return existentes[0];
}

/** Estado limpo entre testes. */
export function limparUltimoLugar(): void {
  guardado = { servidor: undefined, lugares: {} };
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // Nada a fazer.
  }
  for (const o of ouvintes) o();
}
