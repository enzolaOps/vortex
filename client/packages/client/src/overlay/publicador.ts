import { definirEspelhoDeMensagem } from "../notificacao/notificador";
import { channels, pessoas } from "../sdk/adapter";
import {
  acoesEmConflito,
  assinarAtalhosDeVoz,
  lerAtalhosDeVoz,
  teclasDaCombinacao,
} from "../store/atalhosDeVoz";
import { assinarChamada, falando, lerChamada } from "../store/chamada";
import { assinarOverlay, lerOverlay } from "../store/overlay";
import {
  ponteDeOverlay,
  type EstadoDoOverlay,
  type MensagemDoOverlay,
  type PonteDeOverlay,
} from "./modelo";

/**
 * O que a janela principal manda para a janela do overlay.
 *
 * ⚠ **Módulo, e não componente.** Ele assina stores — chamada, pessoas, fala,
 * atalhos, a configuração do overlay — e nenhum componente vive o mesmo tanto
 * que a sessão. Mesmo arranjo de `ligarSonsDeVoz` e `ligarAtalhosDeVoz`.
 *
 * ⚠ **Agrupa em 100 ms.** `falando` muda a cada 120 ms por pessoa; mandar um
 * IPC por mudança, com dez pessoas, seria o caminho mais quente do app
 * atravessando processos à toa.
 */

const AGRUPAR_MS = 100;

let ponte: PonteDeOverlay | undefined;
let agendado: ReturnType<typeof setTimeout> | undefined;
/** Assinaturas por participante: pessoa e fala. */
const porParticipante = new Map<string, () => void>();
let soltarCanal: (() => void) | undefined;
let canalAssinado = "";

function montar(): EstadoDoOverlay {
  const config = lerOverlay();
  const atalhos = lerAtalhosDeVoz();
  const conflito = acoesEmConflito(atalhos);
  const combinacao = conflito.has("overlay") ? undefined : atalhos.overlay;
  const silenciar = conflito.has("silenciarOverlay") ? undefined : atalhos.silenciarOverlay;
  const c = lerChamada();

  return {
    ativo: config.ativo,
    posicao: config.posicao,
    atalho: combinacao ? teclasDaCombinacao(combinacao) : undefined,
    atalhoSilenciar: silenciar ? teclasDaCombinacao(silenciar) : undefined,
    voz:
      c.estado === "fora"
        ? undefined
        : {
            canal: channels.getSnapshot(c.channelId)?.name ?? "voz",
            desde: c.desde || Date.now(),
            mudo: c.mudo,
            surdo: c.surdo,
            participantes: c.participantes.map((id) => {
              const p = pessoas.getSnapshot(id);
              return {
                id,
                /* O design mostra só o primeiro nome: a caixa tem 186px. */
                nome: (p?.displayName ?? "…").split(" ")[0] ?? "…",
                sigla: p?.sigla,
                avatarUrl: p?.avatarUrl,
                falando: falando.getSnapshot(id) ?? false,
                mudo: c.mudos.includes(id),
              };
            }),
          },
  };
}

function agendar(): void {
  if (agendado !== undefined) return;
  agendado = setTimeout(() => {
    agendado = undefined;
    sincronizarAssinaturas();
    ponte?.publicar(montar());
  }, AGRUPAR_MS);
}

/** Acompanha quem entra e sai da sala, sem vazar assinatura de quem saiu. */
function sincronizarAssinaturas(): void {
  const c = lerChamada();
  const ids = new Set(c.estado === "fora" ? [] : c.participantes);
  for (const [id, soltar] of porParticipante) {
    if (!ids.has(id)) {
      soltar();
      porParticipante.delete(id);
    }
  }
  for (const id of ids) {
    if (porParticipante.has(id)) continue;
    const a = pessoas.subscriber(id)(agendar);
    const b = falando.subscriber(id)(agendar);
    porParticipante.set(id, () => {
      a();
      b();
    });
  }
  if (c.channelId !== canalAssinado) {
    soltarCanal?.();
    canalAssinado = c.channelId;
    soltarCanal = c.channelId ? channels.subscriber(c.channelId)(agendar) : undefined;
  }
}

/** Liga o publicador. Sem a ponte (navegador) não faz nada. */
export function ligarPublicadorDoOverlay(): void {
  if (ponte) return;
  ponte = ponteDeOverlay();
  if (!ponte) return;
  assinarChamada(agendar);
  assinarAtalhosDeVoz(agendar);
  assinarOverlay(agendar);
  agendar();
  /* A mensagem que avisou com a janela atrás aparece também por cima do jogo. */
  definirEspelhoDeMensagem((m, _titulo, corpo) =>
    mensagemNoOverlay({
      id: m.mensagemId,
      canal:
        m.tipoDoCanal === "servidor"
          ? `#${m.canalNome ?? "canal"}`
          : (m.canalNome ?? "mensagem direta"),
      autor: m.autorNome,
      texto: corpo,
    }),
  );
}

/** Uma mensagem por cima do jogo — só com o overlay ligado. */
export function mensagemNoOverlay(m: MensagemDoOverlay): void {
  if (!ponte || !lerOverlay().ativo) return;
  ponte.mensagem(m);
}
