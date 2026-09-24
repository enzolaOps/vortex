import type { FaseDoSeletor, ModoDoSeletor } from "../store/seletorDeTela";

/**
 * Os estados do botão "Transmitir", como o design os enumera.
 *
 * ⚠ **União e não três booleanos no componente.** Com `disabled`, `rotulo` e
 * `motivo` calculados cada um num ternário, a precedência entre eles ficava
 * implícita — e é ela que decide o que a pessoa lê: sem permissão E sem fonte
 * precisa dizer a permissão, porque escolher uma fonte não resolveria nada.
 */
export type EstadoDoTransmitir =
  | { readonly tipo: "pronto" }
  | { readonly tipo: "semFonte" }
  | { readonly tipo: "semPermissao" }
  | { readonly tipo: "semCaptura" }
  | { readonly tipo: "iniciando" };

export function estadoDoTransmitir(e: {
  readonly fase: FaseDoSeletor;
  readonly modo: ModoDoSeletor;
  readonly temFonte: boolean;
  readonly podeVideo: boolean;
  readonly suportaCaptura: boolean;
}): EstadoDoTransmitir {
  if (e.fase === "iniciando") return { tipo: "iniciando" };
  if (!e.podeVideo) return { tipo: "semPermissao" };
  /* No modo `casca` quem captura é o `desktopCapturer`, e ele existe. */
  if (e.modo === "sistema" && !e.suportaCaptura) return { tipo: "semCaptura" };
  /* No modo `sistema` a fonte vem DEPOIS do clique — nunca falta aqui. */
  if (e.modo === "casca" && !e.temFonte) return { tipo: "semFonte" };
  return { tipo: "pronto" };
}

/**
 * O motivo escrito ao lado do botão, quando há um.
 *
 * As frases de permissão e de iniciando são as do design. `perigo` pinta em
 * `--vx-danger-text`: são os dois estados em que o clique nunca vai funcionar.
 */
export function motivoDoTransmitir(
  estado: EstadoDoTransmitir,
  modo: ModoDoSeletor,
): { readonly texto: string; readonly perigo: boolean } | undefined {
  switch (estado.tipo) {
    case "semPermissao":
      return { texto: 'sem permissão "Vídeo" neste canal', perigo: true };
    case "semCaptura":
      return {
        texto: "este navegador não compartilha tela",
        perigo: true,
      };
    case "iniciando":
      /* Na web, quem está na frente agora é a janela do sistema — dizer
         "negociando codec" ali descreveria um passo que ainda não começou. */
      return {
        texto:
          modo === "sistema"
            ? "escolha a fonte na janela do navegador"
            : "negociando codec",
        perigo: false,
      };
    case "pronto":
    case "semFonte":
      return undefined;
  }
}
