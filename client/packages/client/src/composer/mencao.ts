/**
 * Autocomplete de `@` no composer — textarea, sem ProseMirror.
 *
 * O protocolo só entende `<@id>`. O campo mostra `@nome`; na hora do envio
 * troca pelos IDs que a pessoa escolheu nesta lista.
 */

export type ConsultaDeMencao = {
  readonly inicio: number;
  readonly query: string;
};

export type MencaoEscolhida = {
  readonly id: string;
  readonly nome: string;
};

const porCanal = new Map<string, MencaoEscolhida[]>();

/** `@query` grudado no cursor, depois de início de linha ou espaço. */
export function consultaDeMencao(
  texto: string,
  cursor: number,
): ConsultaDeMencao | undefined {
  const antes = texto.slice(0, cursor);
  const m = /(?:^|[\s])@([^\s@]*)$/.exec(antes);
  if (!m) return undefined;
  const query = m[1] ?? "";
  return { inicio: cursor - query.length - 1, query };
}

export function inserirMencao(
  texto: string,
  inicio: number,
  cursor: number,
  nome: string,
): { texto: string; cursor: number } {
  const pedaco = `@${nome} `;
  const proximo = texto.slice(0, inicio) + pedaco + texto.slice(cursor);
  return { texto: proximo, cursor: inicio + pedaco.length };
}

export function lembrarMencao(
  channelId: string,
  id: string,
  nome: string,
): void {
  const lista = porCanal.get(channelId) ?? [];
  if (lista.some((x) => x.id === id && x.nome === nome)) return;
  porCanal.set(channelId, [...lista, { id, nome }]);
}

export function esquecerMencoes(channelId: string): void {
  porCanal.delete(channelId);
}

export function aplicarMencoes(
  texto: string,
  escolhidas: readonly MencaoEscolhida[],
): string {
  let out = texto;
  for (const { id, nome } of escolhidas) {
    out = trocarNome(out, nome, id);
  }
  return out;
}

export function aplicarMencoesDoCanal(channelId: string, texto: string): string {
  return aplicarMencoes(texto, porCanal.get(channelId) ?? []);
}

function trocarNome(texto: string, nome: string, id: string): string {
  const alvo = `@${nome}`;
  let out = "";
  let i = 0;
  while (i < texto.length) {
    const j = texto.indexOf(alvo, i);
    if (j < 0) {
      out += texto.slice(i);
      break;
    }
    const depois = texto[j + alvo.length];
    const ok = depois === undefined || /[\s.,!?;:)\]}]/.test(depois);
    if (ok) {
      out += texto.slice(i, j) + `<@${id}>`;
      i = j + alvo.length;
    } else {
      out += texto.slice(i, j + 1);
      i = j + 1;
    }
  }
  return out;
}
