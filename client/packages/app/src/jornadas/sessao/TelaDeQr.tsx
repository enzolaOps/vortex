import { useEffect, useState } from "react";
import { motivoDoErro } from "nucleo/sdk/erros";
import { linkDoQr, pedirQr, trocarQr, type PedidoDeQr, type ResultadoDaTroca } from "nucleo/sdk/qr";

import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { AvisoSimples } from "./AvisoDeEntrada";
import { CodigoQr } from "./CodigoQr";
import css from "./Entrada.module.css";
import { MoldeDaEntrada } from "./MoldeDaEntrada";

/** De quanto em quanto tempo perguntar se alguém autorizou. */
export const PERGUNTA_MS = 2000;

type Estado =
  | { tipo: "carregando" }
  | { tipo: "pronto"; pedido: PedidoDeQr }
  | { tipo: "entrando" }
  | { tipo: "erro"; motivo: string };

export interface TelaDeQrProps {
  aoVoltar: () => void;
  /** Troca do pedido e da pergunta pelo servidor: os testes injetam um falso. */
  pedir?: () => Promise<PedidoDeQr>;
  trocar?: (pedido: PedidoDeQr) => Promise<ResultadoDaTroca>;
}

/** Espaça o código em dois grupos de três, como se lê: "482 913". */
export function codigoLegivel(codigo: string): string {
  return `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
}

/**
 * Entrar com código QR: o lado do aparelho SEM sessão.
 *
 * Mostra um QR com o LINK do pedido e um número de confirmação; quem já tem sessão
 * lê o código, confere o número e autoriza (`AutorizarQr`). O segredo que troca a
 * autorização por sessão fica só na memória desta aba, e o QR leva só o id.
 *
 * O pedido se RENOVA sozinho quando vence: um código esquecido na tela perde a
 * validade em dois minutos, e quem volta encontra outro, não um erro. Se a pergunta
 * falhar, a tela diz e oferece gerar outro; nunca fica girando para sempre.
 */
export function TelaDeQr({ aoVoltar, pedir = pedirQr, trocar = trocarQr }: TelaDeQrProps) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [geracao, setGeracao] = useState(0);

  function renovar() {
    setEstado({ tipo: "carregando" });
    setGeracao((g) => g + 1);
  }

  useEffect(() => {
    let vivo = true;
    pedir().then(
      (pedido) => {
        if (vivo) setEstado({ tipo: "pronto", pedido });
      },
      (e: unknown) => {
        if (vivo) setEstado({ tipo: "erro", motivo: motivoDoErro(e) });
      },
    );
    return () => {
      vivo = false;
    };
  }, [geracao, pedir]);

  const pedido = estado.tipo === "pronto" ? estado.pedido : undefined;

  useEffect(() => {
    if (!pedido) return;
    let vivo = true;
    let emVoo = false;

    const pergunta = setInterval(() => {
      if (emVoo) return;
      if (Date.now() >= pedido.expiraEm) {
        renovar();
        return;
      }
      emVoo = true;
      trocar(pedido)
        .then((r) => {
          if (!vivo) return;
          if (r === "expirado") renovar();
          // `concluida`: o portão de sessão já trocou de tela; esta desmonta.
          if (r === "concluida") setEstado({ tipo: "entrando" });
        })
        .catch((e: unknown) => {
          if (vivo) setEstado({ tipo: "erro", motivo: motivoDoErro(e) });
        })
        .finally(() => {
          emVoo = false;
        });
    }, PERGUNTA_MS);

    return () => {
      vivo = false;
      clearInterval(pergunta);
    };
  }, [pedido, trocar]);

  const t = sessao.qr;

  return (
    <MoldeDaEntrada titulo={t.titulo}>
      <p className={css.recado}>{t.instrucao}</p>

      {estado.tipo === "erro" && <AvisoSimples tom="erro">{estado.motivo}</AvisoSimples>}

      <div className={css.palcoDoQr} aria-busy={estado.tipo === "carregando" || estado.tipo === "entrando"}>
        {pedido && <CodigoQr texto={linkDoQr(pedido.id)} rotulo={t.rotuloDoCodigo} />}
        {estado.tipo === "carregando" && (
          <span className={css.recado} role="status">
            {t.gerando}
          </span>
        )}
        {estado.tipo === "entrando" && (
          <span className={css.recado} role="status">
            {t.entrando}
          </span>
        )}
      </div>

      {pedido && (
        <div className={css.codigoDeConfirmacao}>
          <span className={css.codigoRotulo}>{t.confirmacao}</span>
          <span className={css.codigo}>{codigoLegivel(pedido.codigo)}</span>
        </div>
      )}

      <div className={css.acoes}>
        {estado.tipo === "erro" && (
          <Botao variante="secundario" className={css.largo} onClick={renovar}>
            {t.outroCodigo}
          </Botao>
        )}
        <Botao variante="fantasma" className={css.largo} onClick={aoVoltar}>
          {t.voltar}
        </Botao>
      </div>
    </MoldeDaEntrada>
  );
}
