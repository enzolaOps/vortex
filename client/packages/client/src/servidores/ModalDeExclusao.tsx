import { useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { apagarMensagem } from "../sdk/adapter";
import { apagarCanal, apagarCategoria } from "../sdk/servidores";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { useCategorias, useChannel } from "../store/hooks";
import css from "./AdicionarServidor.module.css";
import { sairDoServidor } from "../sdk/servidores";
import { fecharConfig } from "../store/config";
import { irParaCasa } from "../store/navegacao";
import { useServer } from "../store/hooks";
import { souDono } from "../sdk/servidores";

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
  /*
    ⚠ **Servidor entrou aqui, e o fluxo dele MOROU no rodapé da Visão geral
    até agora** — com uma confirmação de dois passos inline. A referência põe
    "Excluir servidor" na coluna de navegação, e de lá não há onde uma
    confirmação inline apareça: ela virou modal, que é o que este arquivo já
    é para canal, categoria e mensagem.

    ⚠ **`DELETE /servers/{id}` faz as DUAS coisas** — sai para quem é membro,
    apaga para quem é dono. Toda a cópia abaixo troca por `souDono`, porque um
    dono que leia "sair" e destrua o servidor de todo mundo é o pior desfecho
    possível desta tela.
  */
  const deServidor = alvo?.tipo === "apagarServidor";
  const servidor = useServer(deServidor ? alvo.serverId : "");
  /* A mesma fonte que a Visão geral usava — o SDK sabe quem é o dono; o
     snapshot de domínio de propósito não carrega isso. */
  const eDono = deServidor && souDono(alvo.serverId);
  const nome = deCanal
    ? `#${canal?.name ?? "canal"}`
    : (categoria?.titulo ?? "categoria");

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo={
          deServidor
            ? eDono
              ? "Apagar servidor"
              : "Sair do servidor"
            : deMensagem
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
                        : alvo.tipo === "apagarServidor"
                          ? sairDoServidor(alvo.serverId, false)
                          : Promise.resolve(false);
                void p
                  .then((ok) => {
                    if (!ok) return;
                    /* Ficar olhando para as configurações de um servidor que
                       não existe mais é o estado que esta linha evita. */
                    if (alvo.tipo === "apagarServidor") {
                      fecharConfig();
                      irParaCasa();
                    }
                    aoFechar();
                  })
                  .finally(() => setApagando(false));
              }}
            >
              {deServidor && !eDono ? "Sair" : "Apagar"}
            </Botao>
          </>
        }
      >
        <div className={css.corpo}>
          <p className={css.aviso}>
            {deServidor ? (
              eDono ? (
                <>
                  <strong>{servidor?.name ?? "O servidor"}</strong>, os canais e
                  todo o histórico somem, para todo mundo. Não tem como
                  desfazer.
                </>
              ) : (
                <>
                  {/* Dizer o que NÃO acontece, como na categoria: sem isto
                      alguém desiste de sair achando que apaga tudo. */}
                  Você sai de <strong>{servidor?.name ?? "servidor"}</strong> e
                  pode voltar por um convite novo. Nada é apagado.
                </>
              )
            ) : deMensagem ? (
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
