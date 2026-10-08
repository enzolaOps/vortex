import { assinarChamadaRecebida, lerChamadaRecebida } from "nucleo/store/chamadaRecebida";
import { assinarPermissao, conviteVisivel } from "nucleo/notificacao/permissao";
import { pessoas } from "nucleo/sdk/adapter";
import { useMemo, useSyncExternalStore } from "react";

/** A chamada que está tocando agora, ou nada. A referência já vem cacheada do store. */
export function useChamadaRecebida() {
  return useSyncExternalStore(assinarChamadaRecebida, lerChamadaRecebida);
}

/** O convite para ativar avisos do sistema está na tela? Booleano: estável por valor. */
export function useConviteDeAvisos(): boolean {
  return useSyncExternalStore(assinarPermissao, conviteVisivel);
}

const ONLINE_POR_LISTA = new WeakMap<readonly string[], { readonly chave: string; readonly lista: readonly string[] }>();

/**
 * Quem, dentre estes amigos, não está offline.
 *
 * Assina cada pessoa e devolve a MESMA lista enquanto o conjunto não muda — o
 * getter nunca monta array novo à toa (armadilha nº 1 do projeto). Presença
 * piscando de quem continua online não acorda a tela.
 */
export function useAmigosOnline(ids: readonly string[]): readonly string[] {
  const { assinar, ler } = useMemo(
    () => ({
      assinar: (aoMudar: () => void) => {
        const soltar = ids.map((id) => pessoas.subscriber(id)(aoMudar));
        return () => {
          for (const f of soltar) f();
        };
      },
      ler: (): readonly string[] => {
        const online = ids.filter((id) => (pessoas.getSnapshot(id)?.status ?? "offline") !== "offline");
        const chave = online.join(",");
        const guardado = ONLINE_POR_LISTA.get(ids);
        if (guardado?.chave === chave) return guardado.lista;
        ONLINE_POR_LISTA.set(ids, { chave, lista: online });
        return online;
      },
    }),
    [ids],
  );
  return useSyncExternalStore(assinar, ler);
}
