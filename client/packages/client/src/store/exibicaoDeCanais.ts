/**
 * O que a coluna de canais MOSTRA — preferência de leitura, por servidor.
 *
 * ⚠ **Store de cliente, e o protocolo não tem o conceito.** O Stoat guarda
 * ordem de canal e cursor de leitura; "esconder os silenciados desta coluna"
 * é decisão de quem olha, do mesmo tipo que `colapso.ts` (categoria dobrada) e
 * `pastas.ts` (agrupamento de servidor). Mesma resposta que aqueles dois:
 * store local, e a sincronia entre dispositivos fica listada.
 *
 * ⚠ **NÃO vai no preset.** A chave é um ID de servidor — exatamente a família
 * de dado que o schema foi desenhado para tornar irrepresentável. Preset já
 * compartilhado não volta atrás.
 *
 * ⚠ **Por SERVIDOR e não global**, e a diferença é o caso de uso: quem silencia
 * quarenta canais de um servidor grande quer a coluna limpa ALI, e não perder
 * de vista os três canais silenciados do servidor pequeno onde tudo importa.
 * Um booleano global aplicaria a decisão de um lugar em todos os outros.
 */

const CHAVE = "vortex:canaisOcultos";

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

/** IDs de servidor onde os silenciados ficam escondidos. Ausente = mostra. */
const ocultando = ler();

function ler(): Set<string> {
  const saida = new Set<string>();
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return saida;
    const obj: unknown = JSON.parse(bruto);
    /* Forma errada é DESCARTADA, não corrigida: `localStorage` é editável por
       quem usa, e adivinhar produz uma coluna filtrada que ninguém pediu. */
    if (!Array.isArray(obj)) return saida;
    for (const id of obj) if (typeof id === "string") saida.add(id);
  } catch {
    /* Armazenamento bloqueado ou JSON corrompido: começa mostrando tudo, que
       é o estado que não esconde informação de ninguém. */
  }
  return saida;
}

function gravar(): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify([...ocultando]));
  } catch {
    /* Modo privado ou cota cheia. Vale nesta sessão; perder a persistência é
       degradação, não falha. */
  }
}

export function assinarExibicao(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * Booleano comparado por valor — `getSnapshot` não aloca.
 *
 * Um Set global e um booleano derivado, em vez de um store por servidor: são
 * poucas dezenas de servidores, mudados por clique humano, e um emitter por
 * chave seria maquinário para nada. É a mesma conta de `silencio.ts`.
 */
export function ocultaSilenciados(serverId: string): boolean {
  return ocultando.has(serverId);
}

export function alternarOcultarSilenciados(serverId: string): void {
  if (ocultando.has(serverId)) ocultando.delete(serverId);
  else ocultando.add(serverId);
  gravar();
  for (const o of ouvintes) o();
}

/** Estado limpo entre testes. */
export function limparExibicao(): void {
  ocultando.clear();
}
