/**
 * O que EU guardo sobre outra pessoa: a nota privada e o silêncio.
 *
 * ⚠ **Os dois num arquivo só porque são a mesma forma, e não por conveniência.**
 * Nenhum dos dois existe no protocolo: o Stoat não tem notas de usuário nem
 * "esconder as mensagens desta pessoa". São dado LOCAL sobre alguém, keyed por
 * ID de usuário, que só quem escreveu enxerga. É a mesma situação de
 * `pastas.ts` (agrupamento é conceito de cliente) e de `colapso.ts`
 * (preferência de leitura), com a mesma resposta: store no dispositivo, e a
 * sincronia fica como pendência.
 *
 * ⚠ **Nada disto vai no preset**, e a regra é a mais dura do projeto: a nota
 * carrega TEXTO escrito por você sobre outra pessoa, e o silêncio carrega IDs
 * de gente. As duas são exatamente a família de dado que o schema do preset
 * foi desenhado para tornar irrepresentável. Preset já compartilhado não volta
 * atrás.
 *
 * ⚠ **`localStorage` e não memória, e isso é uma decisão com custo.** Uma nota
 * privada some no F5 se ficar só na memória, e uma nota que some é pior que
 * não ter nota — a pessoa a escreve de novo e perde a confiança na caixa. Em
 * troca, o texto fica legível para quem abrir o armazenamento deste navegador.
 * O token de sessão já mora lá pela mesma razão, e a linha do briefing sobre
 * ele vale igual aqui: a defesa real é não dar o XSS.
 */

const CHAVE_NOTAS = "vortex:notas";
const CHAVE_SILENCIO = "vortex:silenciados";

type Ouvinte = () => void;

/* ------------------------------------------------------------- leitura */

/**
 * Lê um mapa de `id → string` do armazenamento.
 *
 * Campo com forma errada é DESCARTADO, não corrigido: `localStorage` é
 * editável por quem usa, e adivinhar o que alguém quis dizer com `{a: 42}`
 * produz uma nota que ninguém escreveu. É a mesma disciplina de `pastas.ts`.
 */
function lerMapa(chave: string): Map<string, string> {
  const saida = new Map<string, string>();
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return saida;
    const obj: unknown = JSON.parse(bruto);
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return saida;
    }
    for (const [id, valor] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof valor === "string" && valor !== "") saida.set(id, valor);
    }
  } catch {
    /* Armazenamento bloqueado ou JSON corrompido: começa vazio. Derrubar o
       app por causa de uma nota seria trocar um defeito pequeno por um
       grande. */
  }
  return saida;
}

function gravarMapa(chave: string, mapa: Map<string, string>): void {
  try {
    localStorage.setItem(chave, JSON.stringify(Object.fromEntries(mapa)));
  } catch {
    /* Modo privado, cota cheia, armazenamento bloqueado. O valor em memória
       continua valendo nesta sessão; perder a persistência é degradação, não
       falha. */
  }
}

/* --------------------------------------------------------------- notas */

const notas = lerMapa(CHAVE_NOTAS);
const ouvintesDeNota = new Map<string, Set<Ouvinte>>();

/**
 * Referência estável: `getSnapshot` não pode alocar, nem uma string nova.
 *
 * É o erro nº 1 do briefing na sua forma mais barata de cair — devolver `""`
 * literal a cada chamada é uma string nova toda vez em alguns motores.
 */
export const NOTA_VAZIA = "";

export function lerNota(userId: string): string {
  return notas.get(userId) ?? NOTA_VAZIA;
}

export function escreverNota(userId: string, texto: string): void {
  const limpo = texto.trimEnd();
  if (lerNota(userId) === limpo) return;
  if (limpo === "") notas.delete(userId);
  else notas.set(userId, limpo);
  gravarMapa(CHAVE_NOTAS, notas);
  avisar(ouvintesDeNota, userId);
}

export function assinarNota(userId: string, ouvinte: Ouvinte): () => void {
  return assinar(ouvintesDeNota, userId, ouvinte);
}

/** Quantas pessoas têm nota — o contador que o design mostra no perfil. */
export function quantasNotas(): number {
  return notas.size;
}

/* ------------------------------------------------------------ silêncio */

/*
  ⚠ **Guardado como mapa de `id → "1"` e não como `Set`**, pela mesma razão de
  a nota ser mapa: um formato só para ler, gravar e validar. O valor não
  carrega nada hoje; o dia em que carregar (um motivo, uma data), o formato já
  aguenta sem migração.
*/
const silenciados = lerMapa(CHAVE_SILENCIO);
const ouvintesDeSilencio = new Map<string, Set<Ouvinte>>();

export function estaSilenciado(userId: string): boolean {
  return silenciados.has(userId);
}

export function alternarSilencioDe(userId: string): void {
  if (silenciados.has(userId)) silenciados.delete(userId);
  else silenciados.set(userId, "1");
  gravarMapa(CHAVE_SILENCIO, silenciados);
  avisar(ouvintesDeSilencio, userId);
}

export function assinarSilencioDe(
  userId: string,
  ouvinte: Ouvinte,
): () => void {
  return assinar(ouvintesDeSilencio, userId, ouvinte);
}

/* ------------------------------------------------------------ comum */

function avisar(mapa: Map<string, Set<Ouvinte>>, id: string): void {
  const set = mapa.get(id);
  if (!set) return;
  for (const o of set) o();
}

function assinar(
  mapa: Map<string, Set<Ouvinte>>,
  id: string,
  ouvinte: Ouvinte,
): () => void {
  let set = mapa.get(id);
  if (!set) {
    set = new Set();
    mapa.set(id, set);
  }
  set.add(ouvinte);

  return () => {
    const atual = mapa.get(id);
    if (!atual) return;
    atual.delete(ouvinte);
    /* Pessoa vista uma vez não deixa um Set vazio para sempre — erro nº 5 do
       briefing na sua forma mais barata de evitar. */
    if (atual.size === 0) mapa.delete(id);
  };
}
