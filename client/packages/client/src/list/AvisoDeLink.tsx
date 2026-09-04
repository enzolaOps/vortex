import { useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import css from "./AvisoDeLink.module.css";

/**
 * Aviso antes de sair para um link de terceiro.
 *
 * ⚠ **Isto é superfície de SEGURANÇA, não de conveniência.** Toda mensagem
 * deste app é escrita por outra pessoa, e markdown permite que o texto do link
 * diga uma coisa e o destino seja outra — `[banco.com](https://phishing.example)`
 * renderiza como o primeiro e leva ao segundo.
 *
 * O `hrefSeguro` do analisador já barra `javascript:` e `data:`; ele não pode
 * barrar um `https:` que simplesmente não é para onde a pessoa acha que vai.
 * Quem decide isso é quem lê — e para decidir precisa VER o destino.
 *
 * Três níveis de escrutínio, e o do meio é o que importa: quando o texto do
 * link é ele mesmo uma URL DIFERENTE do destino, a confirmação endurece.
 */
export function AvisoDeLink({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const link = alvo?.tipo === "linkExterno" ? alvo : undefined;

  if (!link) return null;

  /*
    O texto do link parece uma URL, e é OUTRA?

    É a única forma de engano que o analisador não consegue barrar sozinho, e a
    única que merece um aviso mais duro. Texto que não é URL nenhuma — "clique
    aqui" — é o caso normal e não vira alarme.
  */
  const pareceUrl = /^https?:\/\//i.test(link.texto.trim());
  const disfarcado = pareceUrl && !link.href.startsWith(link.texto.trim());

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Sair para um link"
        descricao="Confira o endereço antes de abrir."
        className={css.painel}
      >
        <div className={css.corpo}>
          {disfarcado ? (
            <p className={css.alerta} role="alert">
              O texto do link diz <strong>{link.texto}</strong>, mas ele leva
              para outro endereço. Isso é comum em golpes.
            </p>
          ) : null}

          <p className={css.rotulo}>Este link leva a:</p>
          {/*
            O destino em mono e quebrando em qualquer ponto: um domínio longo
            cortado com reticências esconde justamente o fim, que é onde o
            engano costuma estar.
          */}
          <p className={css.destino}>{link.href}</p>

          <div className={css.acoes}>
            <Botao
              variante={disfarcado ? "perigo" : "primario"}
              onClick={() => {
                // `noopener` também aqui: sem ele a página aberta recebe
                // `window.opener` e pode navegar esta aba para onde quiser.
                window.open(link.href, "_blank", "noopener,noreferrer");
                aoFechar();
              }}
            >
              Abrir mesmo assim
            </Botao>
            <Botao variante="sutil" onClick={aoFechar}>
              Cancelar
            </Botao>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
