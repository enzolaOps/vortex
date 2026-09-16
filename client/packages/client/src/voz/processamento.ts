import type { FundoDeVideo, NivelDeRuido } from "../store/preferenciasDeVoz";

/**
 * As decisões dos processadores de mídia, sem mídia nenhuma.
 *
 * Separadas das bibliotecas (`ruidoForte.ts`, `fundoDeVideo.ts`) por dois
 * motivos. O primeiro é o BUNDLE: estas funções são lidas pelo motor de voz e
 * pela tela de configurações, e importá-las não pode puxar meio megabyte de
 * WASM. O segundo é o teste: a parte que erra em silêncio é a ordem das
 * operações — ligar duas vezes, trocar o que não existe, desligar o que já
 * saiu —, e ela não precisa de microfone para ser exercitada.
 */

/**
 * A taxa que o RNNoise exige. Mora aqui, e não em `ruidoForte.ts`, porque o
 * motor cria o `AudioContext` antes de saber se o WASM vai ser baixado.
 */
export const TAXA_DO_RNNOISE = 48000;

/** "Agressiva" é a única que o navegador não sabe fazer: é o RNNoise. */
export function querRuidoForte(ruido: NivelDeRuido): boolean {
  return ruido === "agressiva";
}

/**
 * O fundo que VALE agora: a preferência, e só com a câmera ligada.
 *
 * ⚠ **Câmera desligada remove o processador, não o pausa.** O segmentador
 * roda por quadro na GPU; manter um modelo vivo atrás de uma câmera fechada é
 * pagar por nada. Religar a câmera recria — e recriar é o caminho que já
 * existe para a primeira vez.
 */
export function fundoEfetivo(
  preferencia: FundoDeVideo,
  cameraLigada: boolean,
): FundoDeVideo {
  return cameraLigada ? preferencia : "nenhum";
}

export type PlanoDeFundo = "nada" | "criar" | "trocar" | "remover";

/**
 * O que fazer com o processador de fundo da câmera.
 *
 * ⚠ **"nenhum" REMOVE o processador em vez de trocá-lo para desligado.** O
 * `BackgroundProcessor` tem um modo `disabled`, que mantém o segmentador vivo
 * e só para de aplicar o efeito — e o segmentador é o que custa GPU a cada
 * quadro. Quem escolheu "Nenhum" não pediu para pagar por um modelo rodando
 * sem uso.
 */
export function planoDeFundo(
  atual: FundoDeVideo,
  desejado: FundoDeVideo,
): PlanoDeFundo {
  if (atual === desejado) return "nada";
  if (atual === "nenhum") return "criar";
  if (desejado === "nenhum") return "remover";
  return "trocar";
}

/**
 * Serializa uma tarefa assíncrona, coalescendo os pedidos que chegam durante
 * a execução numa ÚNICA repetição.
 *
 * ⚠ **Existe porque as preferências mudam mais rápido que o WASM carrega.**
 * Clicar "Desfoque" e logo "Imagem" dispara duas aplicações; sem fila, a
 * segunda começa com o processador da primeira ainda em `init`, e o
 * `setProcessor` de uma derruba o da outra no meio — o resultado depende de
 * quem termina por último, não de qual foi a última escolha. Com a fila, a
 * tarefa relê o estado desejado a cada volta, então a última escolha é a que
 * vale, e dez cliques seguidos custam duas execuções, não dez.
 *
 * Erro de uma volta não trava a fila: a tarefa é quem decide o que dizer à
 * pessoa, e a próxima escolha precisa poder tentar de novo.
 */
export function coalescer(tarefa: () => Promise<void>): () => Promise<void> {
  let rodando: Promise<void> | undefined;
  let deNovo = false;

  const volta = async (): Promise<void> => {
    do {
      deNovo = false;
      try {
        await tarefa();
      } catch {
        /* a tarefa trata o próprio erro; a fila segue */
      }
    } while (deNovo);
    rodando = undefined;
  };

  return () => {
    if (rodando) {
      deNovo = true;
      return rodando;
    }
    rodando = volta();
    return rodando;
  };
}
