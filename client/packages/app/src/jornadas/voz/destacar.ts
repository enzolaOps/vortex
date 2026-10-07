import { abrirJanela, modoDeDestaque, protegerJanela, type ModoDeDestaque } from "nucleo/sdk/popout";
import { definirJanelaDestacada, fecharJanelaDestacada, lerJanelaDestacada } from "nucleo/store/janelaDestacada";

/**
 * O tamanho com que a janela nasce: a coluna do overlay (160px) com o respiro
 * dela. O overlay mede o próprio conteúdo e pede o tamanho certo em seguida
 * (`JanelaDestacada`); este número só decide o primeiro quadro.
 */
export const TAMANHO_INICIAL = { largura: 192, altura: 240 } as const;

let modo: ModoDeDestaque | undefined;

/** Por onde a janela aberta foi aberta — quem a redimensiona precisa saber. */
export function modoDaJanela(): ModoDeDestaque | undefined {
  return modo;
}

/**
 * Destacar a chamada para uma janela própria. Chamar de um clique.
 *
 * Devolve `false` sem fazer nada quando não há como (a interface já escondeu o
 * botão) ou quando o navegador recusou. Já destacada, não abre outra: uma
 * janela por app.
 */
export async function destacarChamada(): Promise<boolean> {
  if (lerJanelaDestacada()) return true;
  const como = modoDeDestaque();
  if (!como) return false;
  const janela = await abrirJanela(como, TAMANHO_INICIAL);
  if (!janela) return false;
  modo = como;
  definirJanelaDestacada(janela);
  // A proteção de conteúdo é da casca; falhar não impede a janela de existir.
  void protegerJanela(como);
  return true;
}

/** Fecha a janela destacada: a chamada continua, só volta a viver dentro do app. */
export function trazerDeVolta(): void {
  fecharJanelaDestacada();
}

/**
 * O que é só da janela destacada, no `<body>` dela e não no `<html>`: o
 * espelhamento de estilos apaga o que o `<html>` da janela tem a mais que o da
 * principal, e o `<body>` ele não toca.
 *
 * Na casca a janela é transparente (o jogo aparece atrás do overlay); no
 * navegador, o Document PiP é opaco e leva o fundo do app.
 */
export function prepararDocumentoDestacado(janela: Window): void {
  const estilo = janela.document.body.style;
  estilo.margin = "0";
  estilo.overflow = "hidden";
  estilo.background = modo === "casca" ? "transparent" : "var(--vx-surface-solid)";
}
