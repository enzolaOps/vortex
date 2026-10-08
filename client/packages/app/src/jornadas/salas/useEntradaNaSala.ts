import { useCanalDaChamada, useConexao, usePode } from "nucleo/store/hooks";
import { lembrarSala } from "nucleo/store/ultimoLugar";

import { salas } from "../../textos";
import { abrirSala } from "../voz/acoes";

/**
 * Clicar numa sala de voz ENTRA nela (decisão do dono): a coluna e a faixa do
 * palco usam esta mesma regra.
 *
 * - Já na sala: só abre o palco.
 * - Em outra sala: troca direto (a fachada sai da atual antes de entrar).
 * - Sem permissão de conectar, ou sem conexão: não entra, e o `motivo` diz por quê
 *   (o item fica `aria-disabled` com o motivo — nunca um controle inerte e mudo).
 */
export function useEntradaNaSala(serverId: string, canalId: string) {
  const aqui = useCanalDaChamada() === canalId;
  const podeConectar = usePode(canalId, "conectar");
  const conectado = useConexao() === "conectado";
  const motivo = aqui
    ? undefined
    : !podeConectar
      ? salas.vocePodeEntrar
      : !conectado
        ? salas.semConexaoParaEntrar
        : undefined;

  return {
    aqui,
    motivo,
    clicar: () => {
      if (motivo !== undefined) return;
      lembrarSala(serverId, canalId);
      void abrirSala(canalId);
    },
  };
}
