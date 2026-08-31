import { useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { apagarMensagem } from "../sdk/adapter";
import { apagarCanal, apagarCategoria } from "../sdk/servidores";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { useCategorias, useChannel } from "../store/hooks";
import css from "./AdicionarServidor.module.css";

/**
 * Confirmação destrutiva.
 *
 * Um modal para canal e categoria porque a PERGUNTA é a mesma — "apagar isto,
 * que não volta?" — e o que muda é o nome e a consequência. O checklist de
 * revisão pede confirmação para destrutivo, e pede que ela diga o que
 * acontece, não só que pergunte.
 *
 * ⚠ Sem digitar o nome para confirmar, e é decisão: apagar canal é
 * `ManageChannel`, quem tem essa permissão já é quem administra, e o atrito de
 * digitar protege contra engano — não contra má intenção. Numa instância
 * privada, o engano é o que existe.
 */
export function ModalDeExclusao({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const [apagando, setApagando] = useState(false);

  const canal = useChannel(
    alvo?.tipo === "apagarCanal" ? alvo.channelId : "",
  );
  const grupos = useCategorias(
    alvo?.tipo === "apagarCategoria" ? alvo.serverId : "",
  );
  const categoria = grupos.find(
    (g) => alvo?.tipo === "apagarCategoria" && g.id === alvo.categoriaId,
  );

  const deCanal = alvo?.tipo === "apagarCanal";
  const deMensagem = alvo?.tipo === "apagarMensagem";
  const nome = deCanal
    ? `#${canal?.name ?? "canal"}`
    : (categoria?.titulo ?? "categoria");

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo={
          deMensagem
            ? "Apagar mensagem"
            : deCanal
              ? "Apagar canal"
              : "Apagar categoria"
        }
        className={css.painel}
        /* Cancelar ANTES de apagar: a ação destrutiva fica na ponta, que é
           onde o ponteiro chega por último e onde o design a põe. */
        rodape={
          <>
            <Botao variante="sutil" onClick={aoFechar} disabled={apagando}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              disabled={!alvo}
              carregando={apagando}
              rotuloCarregando="Apagando…"
              onClick={() => {
                if (!alvo) return;
                setApagando(true);
                const p =
                  alvo.tipo === "apagarCanal"
                    ? apagarCanal(alvo.channelId)
                    : alvo.tipo === "apagarCategoria"
                      ? apagarCategoria(alvo.serverId, alvo.categoriaId)
                      : alvo.tipo === "apagarMensagem"
                        ? apagarMensagem(alvo.messageId)
                        : Promise.resolve(false);
                void p
                  .then((ok) => {
                    if (ok) aoFechar();
                  })
                  .finally(() => setApagando(false));
              }}
            >
              Apagar
            </Botao>
          </>
        }
      >
        <div className={css.corpo}>
          <p className={css.aviso}>
            {deMensagem ? (
              <>
                {/* Sem prévia do texto: a linha está atrás do modal, e repetir
                    o conteúdo aqui daria duas cópias da mesma mensagem na
                    tela — uma delas prestes a sumir. */}
                A mensagem some para todo mundo. Não tem como desfazer.
              </>
            ) : deCanal ? (
              <>
                <strong>{nome}</strong> e todo o histórico dele somem. Não tem
                como desfazer.
              </>
            ) : (
              <>
                {/* Dizer o que NÃO acontece é metade do valor: sem isto, quem
                    lê assume que os canais somem junto e desiste. */}
                <strong>{nome}</strong> some, e os canais dela voltam para fora
                de categoria. Nenhum canal é apagado.
              </>
            )}
          </p>

        </div>
      </DialogContent>
    </Dialog>
  );
}
