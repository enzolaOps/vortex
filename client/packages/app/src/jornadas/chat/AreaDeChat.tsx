import { Composer } from "./Composer";
import css from "./AreaDeChat.module.css";
import { DigitandoDoCanal } from "./DigitandoDoCanal";
import { ListaDeMensagens } from "./ListaDeMensagens";

/**
 * O chat de um canal: a lista virtualizada e, embaixo, quem está digitando e o
 * composer. Lista e composer partilham UMA medida de leitura
 * (`--medida-da-conversa`), declarada aqui — assim o campo de escrever fica
 * alinhado à coluna de mensagens em qualquer largura, e em ultrawide o excedente
 * vira respiro nos dois lados.
 *
 * Remontada por canal (`key`): a lista reinicia a âncora e o composer troca de
 * rascunho, que mora fora do React e volta onde estava.
 */
export function AreaDeChat({ canalId, servidorId }: { canalId: string; servidorId: string }) {
  return (
    <div className={css.chat}>
      <div className={css.lista}>
        <ListaDeMensagens canalId={canalId} servidorId={servidorId} />
      </div>
      <div className={css.rodape}>
        <div className={css.colunaDoRodape}>
          <DigitandoDoCanal canalId={canalId} servidorId={servidorId} />
          <Composer canalId={canalId} servidorId={servidorId} />
        </div>
      </div>
    </div>
  );
}
