import { useEffect, useState } from "react";
import { motivoDoErro } from "nucleo/sdk/erros";
import {
  autorizarQr,
  recusarQr,
  verPedidoDeQr,
  type PedidoParaAutorizar,
} from "nucleo/sdk/qr";

import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import { AvisoSimples } from "./AvisoDeEntrada";
import css from "./Entrada.module.css";
import { codigoLegivel } from "./TelaDeQr";

type Estado =
  | { tipo: "carregando" }
  | { tipo: "pedido"; pedido: PedidoParaAutorizar }
  | { tipo: "autorizando"; pedido: PedidoParaAutorizar }
  | { tipo: "autorizado" }
  | { tipo: "vencido" }
  | { tipo: "erro"; motivo: string };

export interface AutorizarQrProps {
  /** O id do pedido, do link `/qr/:id`. */
  id: string;
  /** Fecha e esquece o pedido, qualquer que tenha sido o desfecho. */
  aoFechar: () => void;
}

/**
 * A confirmação no aparelho que JÁ tem sessão.
 *
 * O número de confirmação é a defesa, e o texto o diz em primeiro lugar. O golpe de
 * QR clássico é alguém mandar o PRÓPRIO código para a vítima autorizar ("escaneia
 * aqui para ganhar acesso"); sem a comparação, autorizar entrega a conta a quem
 * mandou o link. Por isso o botão diz "Os números batem, autorizar" e não só
 * "Autorizar", e fechar com o X recusa o pedido em vez de deixá-lo vivo.
 */
export function AutorizarQr({ id, aoFechar }: AutorizarQrProps) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const t = sessao.autorizar;

  useEffect(() => {
    let vivo = true;
    verPedidoDeQr(id).then(
      (pedido) => {
        if (vivo) setEstado(pedido ? { tipo: "pedido", pedido } : { tipo: "vencido" });
      },
      (e: unknown) => {
        if (vivo) setEstado({ tipo: "erro", motivo: motivoDoErro(e) });
      },
    );
    return () => {
      vivo = false;
    };
  }, [id]);

  function autorizar(pedido: PedidoParaAutorizar) {
    setEstado({ tipo: "autorizando", pedido });
    autorizarQr(id).then(
      () => {
        setEstado({ tipo: "autorizado" });
      },
      (e: unknown) => {
        setEstado({ tipo: "erro", motivo: motivoDoErro(e) });
      },
    );
  }

  function recusar() {
    if (estado.tipo === "pedido") void recusarQr(id).catch(() => undefined);
    aoFechar();
  }

  const pedido = estado.tipo === "pedido" || estado.tipo === "autorizando" ? estado.pedido : undefined;

  return (
    <Dialogo
      open
      onOpenChange={(aberto) => {
        if (!aberto) recusar();
      }}
    >
      <ConteudoDoDialogo titulo={t.titulo} descricao={t.descricao} data-testid="autorizar-qr">
        <div className={css.formulario}>
          {estado.tipo === "carregando" && (
            <p className={css.recado} role="status" aria-busy="true">
              {t.carregando}
            </p>
          )}

          {pedido && (
            <>
              <p className={css.recado}>{t.instrucao}</p>
              <div className={css.codigoDeConfirmacao}>
                <span className={css.codigoRotulo}>{t.confirmacao}</span>
                <span className={css.codigo}>{codigoLegivel(pedido.codigo)}</span>
              </div>
              <p className={css.destaque}>{pedido.nome}</p>
              <p className={css.dica}>{t.ondeApareceNaLista}</p>
            </>
          )}

          {estado.tipo === "autorizado" && <AvisoSimples tom="sucesso">{t.pronto}</AvisoSimples>}
          {estado.tipo === "vencido" && <AvisoSimples tom="atencao">{t.vencido}</AvisoSimples>}
          {estado.tipo === "erro" && <AvisoSimples tom="erro">{estado.motivo}</AvisoSimples>}

          <div className={css.acoes}>
            {pedido ? (
              <>
                <Botao className={css.largo} carregando={estado.tipo === "autorizando"} onClick={() => { autorizar(pedido); }}>
                  {t.autorizar}
                </Botao>
                <Botao variante="fantasma" className={css.largo} disabled={estado.tipo === "autorizando"} onClick={recusar}>
                  {t.recusar}
                </Botao>
              </>
            ) : (
              <Botao variante="secundario" className={css.largo} onClick={aoFechar}>
                {t.fechar}
              </Botao>
            )}
          </div>
        </div>
      </ConteudoDoDialogo>
    </Dialogo>
  );
}
