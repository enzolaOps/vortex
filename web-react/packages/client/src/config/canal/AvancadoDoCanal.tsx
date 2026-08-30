import { useState } from "react";

import { Botao } from "../../components/ui/Botao";
import { copiarTexto } from "../../lib/copiar";
import { apagarCanal } from "../../sdk/servidores";
import { fecharConfig } from "../../store/config";
import { useChannel } from "../../store/hooks";
import secao from "../Secao.module.css";
import css from "./Canal.module.css";

/**
 * Avançado — o identificador e a exclusão.
 *
 * Ela é curta de propósito. O design põe "Excluir canal" no pé da navegação
 * lateral, em vermelho; aqui ele mora numa seção porque a casca de
 * configurações lista seções e não ações, e um item de menu que não abre uma
 * tela quebraria a promessa da coluna inteira.
 *
 * ⚠ **A confirmação é em dois toques e sem modal.** Um `Dialog` aqui seria o
 * terceiro véu empilhado — a casca já é `role="dialog"` sobre o shell —, e a
 * regra do projeto é um modal por vez. Dois toques dão a mesma pausa sem a
 * pilha.
 */
export function AvancadoDoCanal({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);

  if (!canal) {
    return <p className={secao.recado}>Abra um canal para ver isto.</p>;
  }

  return (
    <div className={secao.forma}>
      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Identificador</h2>
        <p className={css.identificador}>
          <span>{canal.id}</span>
          <Botao
            variante="sutil"
            /* `copiarTexto` já responde nos dois casos, e o de falha carrega
               o texto para seleção à mão — reimplementar aqui daria uma
               segunda mensagem para a mesma ação. */
            onClick={() => void copiarTexto(canal.id, "Identificador")}
          >
            Copiar
          </Botao>
        </p>
        <p className={secao.recado}>
          É o que identifica este canal no protocolo. Serve para relatar um
          problema e para link direto.
        </p>
      </section>

      <hr className={secao.divisor} />

      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Excluir canal</h2>
        <p className={secao.recado}>
          O canal e todo o histórico dele somem, para todo mundo. Não tem como
          desfazer.
        </p>
        <div className={secao.acoes}>
          {confirmando ? (
            <>
              <Botao
                variante="perigo"
                disabled={apagando}
                onClick={() => {
                  setApagando(true);
                  void apagarCanal(channelId).then((ok) => {
                    setApagando(false);
                    /*
                      Fechar só quando DEU CERTO. Fechar sempre esconderia a
                      falha atrás da navegação, e a pessoa concluiria que
                      apagou.
                    */
                    if (ok) fecharConfig();
                  });
                }}
              >
                {apagando ? "Excluindo…" : "Excluir de vez"}
              </Botao>
              <Botao variante="sutil" onClick={() => setConfirmando(false)}>
                Cancelar
              </Botao>
            </>
          ) : (
            <Botao variante="perigo" onClick={() => setConfirmando(true)}>
              Excluir canal
            </Botao>
          )}
        </div>
      </section>
    </div>
  );
}
