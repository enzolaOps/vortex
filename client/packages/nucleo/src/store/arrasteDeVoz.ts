import { useSyncExternalStore } from "react";

/**
 * Arrastar alguém de uma sala de voz para outra.
 *
 * ⚠ **É afordância de PONTEIRO, e por isso não substitui nada.** O submenu
 * "Mover para outro canal" continua sendo o caminho de teclado e de toque — a
 * mesma decisão já registrada para as pastas do rail ("pasta por MENU e não por
 * arraste") e para reordenar enquete. Recurso que só existe para quem tem mouse
 * é o defeito que a auditoria apontou na paleta de comandos.
 *
 * ⚠ **O VEREDITO é calculado no `dragenter`, e não a cada `dragover`.** O
 * navegador dispara `dragover` a cada ~50ms enquanto o ponteiro fica parado
 * sobre o alvo; recalcular lotação e permissão ali seria trabalho contínuo, e
 * escrevê-lo no store acordaria a coluna a 20Hz. Quem entra num alvo decide uma
 * vez; `dragover` só lê o que já foi decidido, sem tocar o store.
 *
 * ⚠ **`getSnapshot` devolve PRIMITIVO em todos os leitores.** É a armadilha nº 1
 * do briefing: um objeto montado no getter faria `Object.is` falhar sempre e a
 * coluna entraria em laço. Quem precisa do arraste inteiro lê
 * `lerArrasteDeVoz()`, que devolve a referência guardada.
 */

/**
 * O que acontece se soltar aqui.
 *
 * `cheio` e `semPermissao` são RECUSA COM MOTIVO, e não ausência de alvo: o
 * design desenha os dois (`"Auditório 25/25 · canal cheio · não aceita
 * soltura"`, `"🔒 Liderança · sem permissão"`). Um alvo que simplesmente não
 * reage não diz se a regra existe ou se o arraste quebrou.
 */
export type VeredictoDeSoltura = "valido" | "cheio" | "semPermissao";

export type ArrasteDeVoz = {
  readonly userId: string;
  readonly serverId: string;
  /** O nome que aparece em "soltar X aqui". */
  readonly nome: string;
  /** A sala de onde a pessoa saiu — nunca é alvo válido de si mesma. */
  readonly deCanal: string;
};

let arraste: ArrasteDeVoz | undefined;
let alvo = "";
let veredicto: VeredictoDeSoltura = "valido";

const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const o of ouvintes) o();
}

export function assinarArrasteDeVoz(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência guardada — nunca aloca. */
export function lerArrasteDeVoz(): ArrasteDeVoz | undefined {
  return arraste;
}

export function arrastandoAlguem(): boolean {
  return arraste !== undefined;
}

export function nomeArrastado(): string {
  return arraste?.nome ?? "";
}

export function alvoDoArraste(): string {
  return alvo;
}

export function vereditoDoAlvo(): VeredictoDeSoltura {
  return veredicto;
}

export function comecarArrasteDeVoz(a: ArrasteDeVoz): void {
  arraste = a;
  alvo = "";
  veredicto = "valido";
  avisar();
}

/** O ponteiro entrou num canal. Só escreve quando algo mudou de verdade. */
export function entrarNoAlvo(channelId: string, v: VeredictoDeSoltura): void {
  if (arraste === undefined) return;
  if (alvo === channelId && veredicto === v) return;
  alvo = channelId;
  veredicto = v;
  avisar();
}

/**
 * O ponteiro saiu de um canal.
 *
 * ⚠ **Só apaga se o alvo ainda for ELE.** `dragleave` do canal antigo costuma
 * chegar DEPOIS do `dragenter` do novo; sem esta condição, sair de A para B
 * apagaria B logo depois de ele ter sido marcado, e o anel piscaria ao andar
 * pela coluna.
 */
export function sairDoAlvo(channelId: string): void {
  if (alvo !== channelId) return;
  alvo = "";
  veredicto = "valido";
  avisar();
}

export function terminarArrasteDeVoz(): void {
  if (arraste === undefined && alvo === "") return;
  arraste = undefined;
  alvo = "";
  veredicto = "valido";
  avisar();
}

/**
 * O veredito de um canal-alvo, sem saber de store nenhum.
 *
 * ⚠ **`conectar` é a permissão de QUEM MOVE, e não de quem é movido** — parece
 * errado e é o que o servidor confere: `member_edit.rs` calcula as permissões
 * do canal de destino sobre o moderador e exige `Connect` ali antes de mover.
 * Espelhar a regra aqui é o que evita um arraste que parece funcionar e volta
 * 403.
 *
 * ⚠ **Sala cheia recusa mesmo com `gerenciarCanais`**, embora o servidor deixe
 * passar (`voice_join.rs` isenta `ManageChannel` do teto). O teto é escolha de
 * quem configurou o canal, e furá-lo por arraste seria a interface oferecendo
 * a exceção como se fosse o caminho normal — quem precisa dela tem o submenu.
 */
export function vereditoDeSoltura(entrada: {
  readonly ocupados: number;
  /** `undefined` = sem teto. */
  readonly limite: number | undefined;
  readonly podeConectar: boolean;
  readonly podeMover: boolean;
}): VeredictoDeSoltura {
  if (!entrada.podeMover || !entrada.podeConectar) return "semPermissao";
  if (entrada.limite !== undefined && entrada.limite > 0) {
    if (entrada.ocupados >= entrada.limite) return "cheio";
  }
  return "valido";
}

/** O texto que o alvo mostra. `Record` fechado: veredito novo pede frase. */
export const TEXTO_DO_VEREDITO: Record<
  VeredictoDeSoltura,
  (nome: string) => string
> = {
  valido: (nome) => `soltar ${nome} aqui`,
  cheio: () => "canal cheio · não aceita soltura",
  semPermissao: () => "sem permissão",
};

/** Está sendo arrastado alguém agora? Acorda a coluna duas vezes por arraste. */
export function useArrastandoAlguem(): boolean {
  return useSyncExternalStore(assinarArrasteDeVoz, arrastandoAlguem);
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparArrasteDeVoz(): void {
  arraste = undefined;
  alvo = "";
  veredicto = "valido";
  ouvintes.clear();
}
