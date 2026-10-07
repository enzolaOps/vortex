import { abrirConfig } from "nucleo/store/config";

import { config } from "../../textos";
import { Botao } from "../../ui/ds";
import { Configuracoes } from "../../ui/icones";

/** Abre as configurações. Mora no rodapé da coluna de salas, ao lado de sair da conta. */
export function BotaoDeConfiguracoes() {
  return (
    <Botao
      variante="fantasma"
      tamanho="sm"
      icone={<Configuracoes />}
      onClick={() => {
        abrirConfig("perfil");
      }}
    >
      {config.abrir}
    </Botao>
  );
}
