import { chaveDeMembro } from "nucleo/sdk/domain";
import { useMembro, useMessage } from "nucleo/store/hooks";

import { chat, ds } from "../../textos";
import { Responder } from "../../ui/icones";
import css from "./Linha.module.css";
import { pedirSalto } from "./saltos";

/** Resumo de uma linha do que foi dito: sem quebra, sem markdown, com teto. */
export function trechoDe(conteudo: string): string {
  return conteudo.slice(0, 200).replace(/\s+/g, " ").trim();
}

/**
 * A prévia da mensagem respondida, IRMÃ da linha (ver o CSS). Assina a
 * mensagem de destino por ID: editar o original atualiza a citação, e apagar
 * dá "indisponível" em vez de uma cópia órfã.
 */
export function CitacaoDeResposta({
  alvoId,
  canalId,
  servidorId,
}: {
  alvoId: string;
  canalId: string;
  servidorId: string;
}) {
  const alvo = useMessage(alvoId);
  const autor = useMembro(chaveDeMembro(servidorId, alvo?.authorId ?? ""));
  const nome = autor?.displayName ?? chat.autorDesconhecido;
  const trecho = alvo === undefined ? chat.respostaIndisponivel : trechoDe(alvo.content) || ds.mensagem.imagem;

  return (
    <button
      type="button"
      className={css.citacao}
      aria-label={`${ds.mensagem.respostaA(nome)}: ${trecho}`}
      onClick={() => {
        pedirSalto(canalId, alvoId);
      }}
    >
      <Responder tamanho={14} />
      <span className={css.citacaoAutor}>{nome}</span>
      <span className={css.citacaoTrecho}>{trecho}</span>
    </button>
  );
}
