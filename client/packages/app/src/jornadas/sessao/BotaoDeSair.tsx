import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { Sair } from "../../ui/icones";
import { encerrarSessao } from "./encerrar";

/** Sair da conta. Mora no rodapé da coluna de salas, onde fica o que é da pessoa. */
export function BotaoDeSair() {
  return (
    <Botao variante="fantasma" tamanho="sm" icone={<Sair />} onClick={() => void encerrarSessao()}>
      {sessao.sair}
    </Botao>
  );
}
