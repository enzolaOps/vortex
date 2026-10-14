import { fixados } from "../../textos";
import { Botao } from "../../ui/ds";
import { Fixar } from "../../ui/icones";
import { abrirFixadosDoCanal, fecharFixadosDevolvendoFoco, useFixados } from "./hooks";

/**
 * O botão de fixados do cabeçalho do canal (texto, conversa direta, grupo e notas).
 * Liga e desliga o painel; `aria-pressed` diz qual dos dois ele fará. A contagem
 * aparece quando a lista do canal já foi carregada — antes disso o número seria
 * um palpite.
 */
export function BotaoDeFixados({ canalId }: { canalId: string }) {
  const estado = useFixados();
  const aberto = estado.aberto && estado.channelId === canalId;
  const carga = estado.cargas[canalId];
  const total = carga?.status === "pronta" ? carga.ids.length : 0;
  return (
    <Botao
      variante="fantasma"
      tamanho="sm"
      icone={<Fixar />}
      aria-label={fixados.botao}
      aria-pressed={aberto}
      title={fixados.botao}
      data-fixados-gatilho=""
      onClick={() => {
        if (aberto) fecharFixadosDevolvendoFoco();
        else abrirFixadosDoCanal(canalId);
      }}
    >
      {total > 0 && carga ? fixados.contagemDoBotao(total, carga.temMais) : undefined}
    </Botao>
  );
}
