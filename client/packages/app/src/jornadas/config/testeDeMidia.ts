import { dbDoRms, rmsDe } from "nucleo/lib/nivelDeAudio";
import { useEffect, useState } from "react";

import { config } from "../../textos";

/** O que a tela diz de cada falha do navegador ao abrir um dispositivo. */
export type TipoDeDispositivo = "microfone" | "camera";

export function frasesDeErro(tipo: TipoDeDispositivo): {
  permissao: string;
  semDispositivo: string;
  emUso: string;
  sumiu: string;
  generico: string;
} {
  if (tipo === "camera") return config.vozTela.erroDaCamera;
  return {
    permissao: config.vozTela.erroPermissao,
    semDispositivo: config.vozTela.erroSemDispositivo,
    emUso: config.vozTela.erroEmUso,
    sumiu: config.vozTela.erroSumiu,
    generico: config.vozTela.erroGenerico,
  };
}

/** Traduz o erro do navegador (`DOMException.name`) na frase da tela. */
export function traduzirErroDeMidia(e: unknown, tipo: TipoDeDispositivo): string {
  const frases = frasesDeErro(tipo);
  const nome = e instanceof DOMException ? e.name : "";
  switch (nome) {
    case "NotAllowedError":
    case "SecurityError":
      return frases.permissao;
    case "NotFoundError":
    case "DevicesNotFoundError":
      return frases.semDispositivo;
    case "NotReadableError":
    case "TrackStartError":
      return frases.emUso;
    case "OverconstrainedError":
      return frases.sumiu;
    default:
      return frases.generico;
  }
}

export type EstadoDoTeste = {
  readonly estado: "parado" | "abrindo" | "ligado" | "erro";
  readonly erro: string | undefined;
};

const PARADO: EstadoDoTeste = { estado: "parado", erro: undefined };

/**
 * Abre uma faixa local enquanto `ativo`, entrega o `MediaStream` a quem
 * desenha e a FECHA em todo caminho de saída: desligar, trocar de dispositivo,
 * desmontar e erro. A faixa que sobrevive à tela deixa a luz da câmera acesa e,
 * em alguns drivers, faz a próxima abertura falhar.
 *
 * Não toca nas preferências de voz nem no motor da chamada: o teste abre
 * `getUserMedia` cru, numa faixa própria que nunca chega ao transporte.
 */
export function useFaixaDeTeste(
  ativo: boolean,
  constraints: MediaStreamConstraints,
  tipo: TipoDeDispositivo,
): { readonly estado: EstadoDoTeste; readonly faixa: MediaStream | undefined } {
  const chave = JSON.stringify(constraints);
  const [resultado, setResultado] = useState<{
    readonly chave: string;
    readonly estado: EstadoDoTeste;
    readonly faixa: MediaStream | undefined;
  }>({ chave, estado: PARADO, faixa: undefined });

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    let aberta: MediaStream | undefined;
    const pedido = JSON.parse(chave) as MediaStreamConstraints;
    navigator.mediaDevices
      .getUserMedia(pedido)
      .then((s) => {
        if (!vivo) {
          for (const t of s.getTracks()) t.stop();
          return;
        }
        aberta = s;
        setResultado({ chave, estado: { estado: "ligado", erro: undefined }, faixa: s });
      })
      .catch((e: unknown) => {
        if (vivo) {
          setResultado({
            chave,
            estado: { estado: "erro", erro: traduzirErroDeMidia(e, tipo) },
            faixa: undefined,
          });
        }
      });
    return () => {
      vivo = false;
      if (aberta) for (const t of aberta.getTracks()) t.stop();
      // Um resultado velho não pode reaparecer na próxima ativação com o mesmo pedido.
      setResultado({ chave: "", estado: PARADO, faixa: undefined });
    };
  }, [ativo, chave, tipo]);

  // Resultado de outro pedido (dispositivo trocado) ou desligado não vale.
  if (!ativo) return { estado: PARADO, faixa: undefined };
  if (resultado.chave !== chave) return { estado: { estado: "abrindo", erro: undefined }, faixa: undefined };
  return { estado: resultado.estado, faixa: resultado.faixa };
}

const INTERVALO_DO_NIVEL_MS = 50;

/**
 * O nível da faixa em dB, medido de verdade com um `AnalyserNode`.
 *
 * Publica no máximo a cada 50 ms e só quando o dB inteiro muda; quem chama é
 * um componente pequeno (o medidor), então só ele acorda. `undefined` é "nada
 * medindo", que não é o mesmo que silêncio.
 */
export function useNivelDaFaixa(faixa: MediaStream | undefined): number | undefined {
  const [medida, setMedida] = useState<{ readonly faixa: MediaStream; readonly db: number } | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!faixa) return;
    const ctx = new AudioContext();
    const fonte = ctx.createMediaStreamSource(faixa);
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 1024;
    fonte.connect(analisador);
    const amostra = new Float32Array(analisador.fftSize);
    let vivo = true;
    let publicadoEm = -Infinity;
    let ultimo: number | undefined;
    let quadro = 0;

    function medir(agora: number) {
      if (!vivo) return;
      if (agora - publicadoEm >= INTERVALO_DO_NIVEL_MS) {
        analisador.getFloatTimeDomainData(amostra);
        publicadoEm = agora;
        const db = Math.round(dbDoRms(rmsDe(amostra)));
        if (db !== ultimo) {
          ultimo = db;
          setMedida({ faixa: faixa as MediaStream, db });
        }
      }
      quadro = requestAnimationFrame(medir);
    }
    quadro = requestAnimationFrame(medir);

    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
      fonte.disconnect();
      // Devolve o dispositivo de áudio ao sistema: o navegador limita os contextos por aba.
      void ctx.close();
    };
  }, [faixa]);

  return medida !== undefined && medida.faixa === faixa ? medida.db : undefined;
}
