import { useEffect, useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { copiarTexto } from "../lib/copiar";
import { criarConvite } from "../sdk/servidores";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import css from "./AdicionarServidor.module.css";

/**
 * O convite recém-criado.
 *
 * Cria ao ABRIR, e não atrás de um botão: quem escolheu "Criar convite" no
 * menu já pediu o convite. Um segundo clique para fazer o que o primeiro
 * pediu é cerimônia.
 *
 * O link é montado com a origem ATUAL e não com um domínio fixo: numa
 * instância privada o endereço é o da instância, e chumbar `stt.gg` — como o
 * upstream faz — daria a todo mundo um link que aponta para o servidor errado.
 */
export function ModalDeConvite({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const channelId = alvo?.tipo === "convite" ? alvo.channelId : undefined;

  const [codigo, setCodigo] = useState<string | undefined>(undefined);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!channelId) return;
    let vivo = true;
    void criarConvite(channelId).then((c) => {
      if (!vivo) return;
      if (c) setCodigo(c);
      else setFalhou(true);
    });
    return () => {
      vivo = false;
    };
  }, [channelId]);

  const link = codigo ? `${window.location.origin}/convite/${codigo}` : "";

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent titulo="Convite" className={css.painel}>
        <div className={css.corpo}>
          {falhou ? (
            <p className={css.aviso} role="alert">
              Não deu para criar o convite.
            </p>
          ) : codigo ? (
            <>
              <Campo
                rotulo="Link do convite"
                dica="Qualquer pessoa com este link entra no canal."
                readOnly
                value={link}
                /* Seleciona tudo ao focar: o gesto natural depois de ver um
                   link é copiá-lo, e a seleção manual num campo estreito é
                   chata o bastante para a pessoa desistir. */
                onFocus={(e) => e.currentTarget.select()}
              />
              <Botao variante="primario" onClick={() => void copiarTexto(link, "O link")}>
                Copiar link
              </Botao>
            </>
          ) : (
            <p className={css.aviso}>Criando…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
