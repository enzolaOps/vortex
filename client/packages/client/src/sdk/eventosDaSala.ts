/**
 * Entrar, sair e ser movido de uma sala de voz, como LINHA no chat dela.
 *
 * ⚠ **Efêmero, e é decisão, não falta.** A alternativa era gravar uma
 * mensagem de sistema nova no servidor, e ela cai por três razões medidas:
 *
 * 1. **Quem sabe que alguém SAIU é o `voice-ingress`**, pelo webhook do
 *    LiveKit — não o `delta`. Não existe rota de saída no protocolo. Gravar a
 *    saída exigiria forkar e publicar um terceiro serviço, que o briefing
 *    manda não fazer sem necessidade.
 * 2. **Uma variante nova de `SystemMessage` no Mongo quebra os serviços
 *    upstream que desserializam mensagem** (`pushd`, `crond`, o próprio
 *    `voice-ingress`, todos pinados no Stoat): o enum deles não conhece a
 *    variante e o `serde` recusa o documento. No `stoat.js` ela nem quebra,
 *    mas vira a linha "`voice_joined` is not supported." para todo cliente
 *    Stoat.
 * 3. **Toda entrada e saída viraria não lida** para o servidor inteiro, num
 *    canal de voz movimentado. O design separa as duas coisas: *"entradas e
 *    saídas são eventos do sistema, não mensagens"* (D-VOZ-13).
 *
 * Os eventos já chegam pelo socket (`VoiceChannelJoin`, `…Leave`, `…Move` e
 * `UserVoiceStateUpdate` para a transmissão); o que faltava era desenhá-los. A frase "o histórico persiste
 * depois que todos saem" continua verdadeira para as MENSAGENS — é delas que
 * o design fala.
 *
 * ⚠ **Só a sala em que VOCÊ está.** Os eventos vêm para o servidor inteiro, e
 * guardar uma linha por entrada em todo canal de voz de todo servidor numa
 * sessão de 8h é o erro nº 5 do briefing. Quem está na sala é quem vê — é o
 * que o cabeçalho do chat já promete ("visível só para conectados"). Sair da
 * sala apaga as linhas dela.
 *
 * Módulo PURO: traduz o evento cru e guarda o registro das linhas. Quem as
 * põe na lista é o adapter.
 */
import type { SistemaSnapshot } from "./domain";

/** Uma linha a inserir no chat de uma sala. */
export type LinhaDeSala = {
  readonly canal: string;
  /** Quem é o sujeito da linha — vai de `author` da mensagem local. */
  readonly userId: string;
  readonly sistema: SistemaSnapshot;
};

/**
 * Quanto um "por Fulano" vale depois de chegar.
 *
 * O autor vem do `delta` (`ServerMemberUpdate.by`) ANTES do movimento ou da
 * saída, que vêm do `voice-ingress` depois do webhook do LiveKit. A folga é
 * larga porque são dois serviços e uma fila no meio; errar para mais só
 * arrisca atribuir a um moderador uma saída espontânea dentro de 10s depois de
 * ele ter mexido na mesma pessoa.
 */
export const VALIDADE_DO_AUTOR_MS = 10_000;

const autores = new Map<string, { readonly por: string; readonly em: number }>();

/**
 * O servidor disse quem mexeu na voz de alguém.
 *
 * Lido de `ServerMemberUpdate.by`, campo do fork: um `delta` Stoat não o
 * manda, e aí a linha sai sem autor ("Téo foi movido para Foco").
 */
export function anotarAutorDeVoz(evento: unknown, agora: number): void {
  const e = evento as {
    type?: string;
    id?: { user?: unknown };
    by?: unknown;
  };
  if (e.type !== "ServerMemberUpdate") return;
  if (typeof e.by !== "string" || e.by === "") return;
  if (typeof e.id?.user !== "string") return;
  autores.set(e.id.user, { por: e.by, em: agora });
}

function autorRecente(userId: string, agora: number): string | undefined {
  const a = autores.get(userId);
  if (a === undefined) return undefined;
  // Consumido: o mesmo "por" não pode assinar duas linhas.
  autores.delete(userId);
  return agora - a.em <= VALIDADE_DO_AUTOR_MS ? a.por : undefined;
}

/**
 * Evento cru → linhas, para a sala em que se está.
 *
 * `canalDaChamada` vazio é "fora de chamada", e aí nada entra.
 */
export function linhasDoEvento(
  evento: unknown,
  canalDaChamada: string,
  agora: number,
): readonly LinhaDeSala[] {
  if (canalDaChamada === "") return [];
  const e = evento as {
    type?: string;
    id?: unknown;
    user?: unknown;
    from?: unknown;
    to?: unknown;
    state?: { id?: unknown };
  };

  if (e.type === "VoiceChannelJoin") {
    const user = e.state?.id;
    if (e.id !== canalDaChamada || typeof user !== "string") return [];
    return [{ canal: canalDaChamada, userId: user, sistema: { tipo: "entrou", userId: user } }];
  }

  if (e.type === "VoiceChannelLeave") {
    if (e.id !== canalDaChamada || typeof e.user !== "string") return [];
    const por = autorRecente(e.user, agora);
    return [
      {
        canal: canalDaChamada,
        userId: e.user,
        sistema:
          por !== undefined
            ? { tipo: "desconectou", userId: e.user, porId: por }
            : { tipo: "saiu", userId: e.user },
      },
    ];
  }

  if (e.type === "UserVoiceStateUpdate") {
    /* Só o COMEÇO da transmissão: parar não tem linha no design, e um
       `screensharing: false` a cada reconexão viraria ruído. */
    const u = evento as { id?: unknown; channel_id?: unknown; data?: { screensharing?: unknown } };
    if (u.channel_id !== canalDaChamada || typeof u.id !== "string") return [];
    if (u.data?.screensharing !== true) return [];
    return [{ canal: canalDaChamada, userId: u.id, sistema: { tipo: "transmitiu", userId: u.id } }];
  }

  if (e.type === "VoiceChannelMove") {
    if (typeof e.user !== "string" || typeof e.to !== "string") return [];
    if (e.from !== canalDaChamada && e.to !== canalDaChamada) return [];
    const por = autorRecente(e.user, agora);
    return [
      {
        canal: canalDaChamada,
        userId: e.user,
        sistema: { tipo: "moveu", userId: e.user, porId: por, paraId: e.to },
      },
    ];
  }

  return [];
}

/* ------------------------------------------------------------- registro */

/**
 * As linhas vivas, por ID local.
 *
 * É o que `toSistema` consulta antes do SDK: a mensagem local carrega um
 * `system` de texto vazio só para o SDK a hidratar como linha de sistema, e o
 * FATO mora aqui — senão a frase seria congelada no idioma do instante.
 */
const linhas = new Map<string, { readonly canal: string; readonly sistema: SistemaSnapshot }>();

export function registrarLinhaDeSala(id: string, canal: string, sistema: SistemaSnapshot): void {
  linhas.set(id, { canal, sistema });
}

export function linhaDeSala(id: string): SistemaSnapshot | undefined {
  return linhas.get(id)?.sistema;
}

/**
 * É uma linha efêmera, e portanto um ID que o SERVIDOR não conhece.
 *
 * ⚠ É a guarda de todo caminho que manda um ID da lista para a rede — `ack`
 * sobretudo: marcar como lido até uma linha local mandaria um ULID inventado
 * como cursor de leitura.
 */
export function ehLinhaDeSala(id: string): boolean {
  return linhas.has(id);
}

/** Tira do registro as linhas de um canal e devolve os IDs, para a lista soltá-los. */
export function soltarLinhasDe(canal: string): readonly string[] {
  const ids: string[] = [];
  for (const [id, l] of linhas) {
    if (l.canal !== canal) continue;
    ids.push(id);
    linhas.delete(id);
  }
  return ids;
}

/** Estado limpo entre testes. */
export function limparEventosDaSala(): void {
  linhas.clear();
  autores.clear();
}
