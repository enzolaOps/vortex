import { useEffect, useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Girador } from "../components/ui/Girador";
import { Monitor } from "../components/ui/icones";
import { motivoDoErro } from "../sdk/erros";
import {
  autorizarQr,
  recusarQr,
  verPedidoDeQr,
  type PedidoParaAutorizar,
} from "../sdk/qr";
import { lerEntrada, voltarParaEntrar } from "../store/entrada";
import css from "./TelaDeQr.module.css";

type Estado =
  | { readonly tipo: "carregando" }
  | { readonly tipo: "pedido"; readonly pedido: PedidoParaAutorizar }
  | { readonly tipo: "autorizando"; readonly pedido: PedidoParaAutorizar }
  | { readonly tipo: "autorizado" }
  | { readonly tipo: "vencido" }
  | { readonly tipo: "erro"; readonly motivo: string };

/**
 * A confirmação no aparelho que JÁ tem sessão.
 *
 * ⚠ **O número de confirmação é a defesa, e a tela o diz em primeiro lugar.**
 * O golpe de QR clássico é alguém mandar o PRÓPRIO código para a vítima
 * autorizar — "escaneia aqui para ganhar acesso". Sem a comparação, autorizar
 * entrega a conta a quem mandou o link. Por isso o botão principal diz
 * "Os números batem — autorizar", e não só "Autorizar".
 *
 * O ID vem do store de entrada (`/qr/:id`) e é consumido uma vez, como o
 * convite: deixá-lo lá reabriria esta confirmação a cada abertura do app.
 */
export function AutorizarQr({ aoFechar }: { aoFechar: () => void }) {
  const [id] = useState(() => {
    const tela = lerEntrada();
    if (tela.tipo !== "autorizarQr") return undefined;
    voltarParaEntrar();
    return tela.id;
  });
  const [estado, setEstado] = useState<Estado>(() =>
    id === undefined ? { tipo: "vencido" } : { tipo: "carregando" },
  );

  useEffect(() => {
    if (id === undefined) return;
    let vivo = true;
    verPedidoDeQr(id).then(
      (pedido) => {
        if (!vivo) return;
        setEstado(pedido ? { tipo: "pedido", pedido } : { tipo: "vencido" });
      },
      (e: unknown) => vivo && setEstado({ tipo: "erro", motivo: motivoDoErro(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [id]);

  function autorizar(pedido: PedidoParaAutorizar) {
    if (id === undefined) return;
    setEstado({ tipo: "autorizando", pedido });
    autorizarQr(id).then(
      () => setEstado({ tipo: "autorizado" }),
      (e: unknown) => setEstado({ tipo: "erro", motivo: motivoDoErro(e) }),
    );
  }

  function recusar() {
    if (id !== undefined && estado.tipo === "pedido") void recusarQr(id).catch(() => {});
    aoFechar();
  }

  const pedido =
    estado.tipo === "pedido" || estado.tipo === "autorizando" ? estado.pedido : undefined;

  return (
    <Dialog open onOpenChange={(v) => !v && recusar()}>
      <DialogContent
        titulo="Autorizar outro aparelho"
        descricao="Entrar nesta conta pelo código QR"
        rodape={
          pedido ? (
            <>
              <Botao variante="neutro" onClick={recusar}>
                Recusar
              </Botao>
              <Botao
                variante="primario"
                carregando={estado.tipo === "autorizando"}
                onClick={() => autorizar(pedido)}
              >
                Os números batem — autorizar
              </Botao>
            </>
          ) : (
            <Botao variante="neutro" onClick={aoFechar}>
              Fechar
            </Botao>
          )
        }
      >
        {estado.tipo === "carregando" ? (
          <div className={css.confirmacao}>
            <Girador tamanho={20} espessura={3} rotulo="Buscando o pedido" />
          </div>
        ) : null}

        {pedido ? (
          <div className={css.pedido}>
            <p className={css.recado}>
              Confira se este número é o mesmo que aparece na tela do outro
              aparelho. Se alguém te mandou este link, não autorize.
            </p>
            <div className={css.confirmacao}>
              <span className={css.rotulo}>Confirmação</span>
              <span className={css.codigo}>
                {pedido.codigo.slice(0, 3)} {pedido.codigo.slice(3)}
              </span>
            </div>
            <div className={css.aparelho}>
              <Monitor aria-hidden />
              {pedido.nome}
            </div>
            <p className={css.recado}>
              A sessão nova aparece em Configurações · Dispositivos, onde dá para
              derrubá-la a qualquer momento.
            </p>
          </div>
        ) : null}

        {estado.tipo === "autorizado" ? (
          <Banner tom="sucesso">
            Pronto. O outro aparelho já está entrando.
          </Banner>
        ) : null}

        {estado.tipo === "vencido" ? (
          <Banner tom="aviso">
            Este código já não vale — ele vence em dois minutos e só pode ser
            usado uma vez. Gere outro no aparelho que quer entrar.
          </Banner>
        ) : null}

        {estado.tipo === "erro" ? (
          <Banner tom="perigo" role="alert">
            {estado.motivo}
          </Banner>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
