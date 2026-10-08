import { entrarPorConvite, type ResultadoDeEntrada } from "nucleo/sdk/servidores";
import { useState } from "react";

import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import { AvisoSimples } from "./AvisoDeEntrada";
import css from "./Entrada.module.css";
import { PreviaDoConvite } from "./PreviaDoConvite";
import { useConvite } from "./useConvite";

export interface ConviteRecebidoProps {
  codigo: string;
  /** Fecha sem entrar (e esquece o convite). */
  aoDispensar: () => void;
  /** Entrou, ou já era membro: abre o servidor e esquece o convite. */
  aoAbrir: (serverId: string) => void;
}

/**
 * O convite que esperou a sessão: abre dentro do app, no servidor do link.
 *
 * Todos os desfechos do protocolo têm estado próprio, porque dois deles não são
 * falha nem sucesso: o pedido registrado (servidor de aprovação manual) e o
 * banimento. Quem foi banido não recebe o botão de novo, e quem já pediu não pede
 * duas vezes.
 */
export function ConviteRecebido({ codigo, aoDispensar, aoAbrir }: ConviteRecebidoProps) {
  const estado = useConvite(codigo);
  const [entrando, setEntrando] = useState(false);
  const [desfecho, setDesfecho] = useState<ResultadoDeEntrada | undefined>();
  const t = sessao.convite;

  function entrar() {
    setEntrando(true);
    void entrarPorConvite(codigo)
      .then((r) => {
        if (r.tipo === "entrou") aoAbrir(r.serverId);
        else setDesfecho(r);
      })
      .finally(() => {
        setEntrando(false);
      });
  }

  const convite = estado.tipo === "pronto" ? estado.convite : undefined;
  const resolvido = desfecho?.tipo === "pedido" || desfecho?.tipo === "banido";

  return (
    <Dialogo
      open
      onOpenChange={(aberto) => {
        if (!aberto) aoDispensar();
      }}
    >
      <ConteudoDoDialogo titulo={t.titulo} data-testid="convite-recebido">
        <div className={css.formulario}>
          {estado.tipo === "procurando" && (
            <p className={css.recado} role="status" aria-busy="true">
              {t.procurando}
            </p>
          )}

          {estado.tipo === "falhou" && <AvisoSimples tom="erro">{estado.motivo}</AvisoSimples>}

          {convite && <PreviaDoConvite convite={convite} />}

          {desfecho?.tipo === "pedido" && <AvisoSimples tom="info">{t.pedidoFeito}</AvisoSimples>}
          {desfecho?.tipo === "banido" && <AvisoSimples tom="erro">{t.banido}</AvisoSimples>}
          {desfecho?.tipo === "falhou" && <AvisoSimples tom="erro">{desfecho.motivo}</AvisoSimples>}
          {convite?.jaSouMembro === true && <p className={css.recado}>{t.jaEsta}</p>}

          <div className={css.acoes}>
            {convite && !resolvido && (
              <Botao
                className={css.largo}
                carregando={entrando}
                onClick={() => {
                  if (convite.jaSouMembro) aoAbrir(convite.serverId);
                  else entrar();
                }}
              >
                {convite.jaSouMembro ? t.abrir : entrando ? t.entrando : t.entrarNoServidor}
              </Botao>
            )}
            <Botao variante="fantasma" className={css.largo} disabled={entrando} onClick={aoDispensar}>
              {t.ignorar}
            </Botao>
          </div>
        </div>
      </ConteudoDoDialogo>
    </Dialogo>
  );
}
