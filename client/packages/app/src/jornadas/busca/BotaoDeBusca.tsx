import { busca } from "../../textos";
import { Botao } from "../../ui/ds";
import { Buscar } from "../../ui/icones";
import { atalhoDaBusca } from "./foco";
import { abrirBuscaDoCanal, fecharBuscaDevolvendoFoco, useBusca } from "./hooks";

/**
 * O botão de busca do cabeçalho do canal (texto, conversa direta, grupo e notas).
 * Liga e desliga o painel; `aria-pressed` diz qual dos dois ele fará.
 */
export function BotaoDeBusca({ canalId, servidorId }: { canalId: string; servidorId: string }) {
  const estado = useBusca();
  const aberta = estado.aberta && estado.channelId === canalId;
  return (
    <Botao
      variante="fantasma"
      tamanho="sm"
      icone={<Buscar />}
      aria-label={busca.botao}
      aria-pressed={aberta}
      title={`${busca.botao} (${atalhoDaBusca()})`}
      data-busca-gatilho=""
      onClick={() => {
        if (aberta) fecharBuscaDevolvendoFoco();
        else abrirBuscaDoCanal(canalId, servidorId);
      }}
    />
  );
}
