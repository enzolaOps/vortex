import type { ReactNode } from "react";

import { Composer } from "./Composer";
import { SeletorDeReacao } from "./emoji/SeletoresDeEmoji";
import css from "./AreaDeChat.module.css";
import { DigitandoDoCanal } from "./DigitandoDoCanal";
import { ListaDeMensagens } from "./ListaDeMensagens";
import { VisualizadorDeImagem } from "./VisualizadorDeImagem";

/**
 * O chat de um canal: a lista virtualizada e, embaixo, quem está digitando e o
 * composer. Lista e composer ocupam a largura toda, alinhados ao início e com o
 * mesmo recuo lateral: o campo de escrever fica sob a coluna de mensagens em
 * qualquer largura, sem centralização.
 *
 * Remontada por canal (`key`): a lista reinicia a âncora e o composer troca de
 * rascunho, que mora fora do React e volta onde estava.
 *
 * `rodape` substitui o composer quando a conversa tem um motivo próprio para não
 * aceitar escrita (a DM com alguém bloqueado): a frase do motivo ocupa o lugar do
 * campo, na mesma coluna de leitura.
 */
export function AreaDeChat({
  canalId,
  servidorId,
  rodape,
}: {
  canalId: string;
  servidorId: string;
  rodape?: ReactNode;
}) {
  return (
    <div className={css.chat}>
      <div className={css.lista}>
        <ListaDeMensagens canalId={canalId} servidorId={servidorId} />
      </div>
      {/* Um de cada para o chat inteiro: nada disto é montado por linha. */}
      <SeletorDeReacao />
      <VisualizadorDeImagem servidorId={servidorId} />
      <div className={css.rodape}>
        <div className={css.colunaDoRodape}>
          {rodape ?? (
            <>
              <DigitandoDoCanal canalId={canalId} servidorId={servidorId} />
              <Composer canalId={canalId} servidorId={servidorId} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
