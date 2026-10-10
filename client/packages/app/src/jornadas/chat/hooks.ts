import { estadoDoHistoricoDoCanal, type EstadoDoHistorico } from "nucleo/sdk/adapter";
import { assinarEdicaoDeMensagem, lerEdicaoDeMensagem } from "nucleo/store/edicaoDeMensagem";
import { assinarFila, lerFalhadasDoCanal, lerPendentesDoCanal } from "nucleo/store/fila";
import { assinarResposta, alvoDeResposta, type AlvoDeResposta } from "nucleo/store/resposta";
import { progressoDeUpload, type ProgressoDeUpload } from "nucleo/store/uploads";
import { useSyncExternalStore } from "react";

/**
 * Ganchos da jornada de chat sobre os stores do núcleo.
 *
 * Todos devolvem valor primitivo ou a referência GUARDADA no store: montar
 * objeto dentro do getter é o erro nº 1 do briefing (loop de render).
 */

const HISTORICO_INICIAL: EstadoDoHistorico = { inicial: "carregando", pagina: false };

/** Onde está o histórico do canal: carregando, pronto ou falhou, mais o prepend em voo. */
export function useEstadoDoHistorico(canalId: string): EstadoDoHistorico {
  return useSyncExternalStore(
    estadoDoHistoricoDoCanal.subscriber(canalId),
    () => estadoDoHistoricoDoCanal.getSnapshot(canalId) ?? HISTORICO_INICIAL,
  );
}

/** A quem o composer deste canal está respondendo. */
export function useAlvoDeResposta(canalId: string): AlvoDeResposta | undefined {
  return useSyncExternalStore(
    (ouvinte) => assinarResposta(canalId, ouvinte),
    () => alvoDeResposta(canalId),
  );
}

/** Esta linha é a que está em edição? Booleano: só a linha que muda re-renderiza. */
export function useEditandoEsta(id: string): boolean {
  return useSyncExternalStore(assinarEdicaoDeMensagem, () => lerEdicaoDeMensagem() === id);
}

/** Quantas mensagens do canal esperam a rede. Zero é o caso normal. */
export function usePendentesDoCanal(canalId: string): number {
  return useSyncExternalStore(assinarFila, () => lerPendentesDoCanal(canalId));
}

/** Quantas mensagens do canal falharam. Zero é o caso normal. */
export function useFalhadasDoCanal(canalId: string): number {
  return useSyncExternalStore(assinarFila, () => lerFalhadasDoCanal(canalId));
}

/** O progresso do upload desta mensagem (store efêmero: muda dezenas de vezes por segundo). */
export function useProgressoDeUpload(idLocal: string): ProgressoDeUpload | undefined {
  return useSyncExternalStore(
    progressoDeUpload.subscriber(idLocal),
    () => progressoDeUpload.getSnapshot(idLocal),
  );
}
