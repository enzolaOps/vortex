/**
 * "Atenuar outros apps", do lado do cliente: decide QUANDO. Quem baixa o
 * volume dos outros programas é a casca (`vendor/stoat-desktop/src/native/atenuacao.ts`).
 *
 * ⚠ **Liga na hora e desliga com atraso.** Fala tem pausa entre as palavras, e
 * `ActiveSpeakersChanged` acompanha cada uma: devolver o volume a cada pausa
 * faria a música "bombear" durante a conversa inteira. Segurar um instante
 * depois da última fala é o que todo cliente de voz faz.
 */

export type PonteDeAtenuacao = { readonly atenuar: (sim: boolean) => void };

declare global {
  interface Window {
    readonly vortexAtenuacao?: PonteDeAtenuacao;
  }
}

export function ponteDeAtenuacao(): PonteDeAtenuacao | undefined {
  if (typeof window === "undefined") return undefined;
  const p = window.vortexAtenuacao as Record<string, unknown> | undefined;
  return p && typeof p.atenuar === "function" ? window.vortexAtenuacao : undefined;
}

export const SEGURAR_MS = 800;

/**
 * A preferência vale AGORA?
 *
 * ⚠ **Transmitir som desliga a atenuação enquanto ela durar, e não é capricho.**
 * A casca baixa o volume de sessão de TODO aplicativo que não seja o Vortex —
 * medido em `vendor/stoat-desktop/src/native/atenuacaoModelo.test.ts`, sob
 * "alcance da atenuação". Compartilhar a tela inteira com som captura por
 * `audio: "loopback"`, que é o mix do DISPOSITIVO, ou seja o mix já atenuado:
 * quem assiste ouviria a transmissão cair pela metade a cada fala, sem nada na
 * tela dizendo por quê.
 *
 * A exceção certa seria isentar só a FONTE transmitida, e ela não cabe aqui: a
 * casca conhece as sessões por executável e a janela escolhida por PID, e ligar
 * os dois é Win32 novo (`QueryFullProcessImageName`) — enquanto isto é um
 * booleano que o cliente já tem. Para a tela inteira nem existe fonte única a
 * isentar, porque o loopback é tudo o que toca.
 *
 * ⚠ **A preferência de quem usa não é tocada** — ela continua ligada, e volta a
 * valer quando a transmissão sai do ar ou o som dela é mudado.
 */
export function atenuacaoValeAgora(estado: {
  /** `atenuarOutrosApps`, como a pessoa a deixou. */
  readonly preferencia: boolean;
  /** Há faixa de áudio de tela publicada E não mudada. */
  readonly transmitindoAudio: boolean;
}): boolean {
  return estado.preferencia && !estado.transmitindoAudio;
}

export function criarAtenuador(opcoes: {
  enviar: (sim: boolean) => void;
  segurarMs?: number;
  agendar?: (fn: () => void, ms: number) => unknown;
  cancelar?: (id: unknown) => void;
}) {
  const segurar = opcoes.segurarMs ?? SEGURAR_MS;
  const agendar = opcoes.agendar ?? ((fn, ms) => setTimeout(fn, ms));
  const cancelar =
    opcoes.cancelar ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let ativo = false;
  let pendente: unknown;

  function limparPendente() {
    if (pendente !== undefined) {
      cancelar(pendente);
      pendente = undefined;
    }
  }

  return {
    /**
     * `falando`: alguém ALÉM de você está falando. `ligado`: a preferência.
     * `imediato`: sair da chamada ou desligar a preferência não espera.
     */
    atualizar(falando: boolean, ligado: boolean, imediato = false): void {
      const querer = falando && ligado;
      if (querer) {
        limparPendente();
        if (!ativo) {
          ativo = true;
          opcoes.enviar(true);
        }
        return;
      }
      if (!ativo) return;
      const desligar = () => {
        pendente = undefined;
        ativo = false;
        opcoes.enviar(false);
      };
      if (imediato || !ligado) {
        limparPendente();
        desligar();
        return;
      }
      if (pendente === undefined) pendente = agendar(desligar, segurar);
    },
  };
}
