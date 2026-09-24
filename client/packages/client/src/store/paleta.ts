/**
 * Abrir e fechar a paleta de comandos.
 *
 * ⚠ **Este arquivo já foi o store da paleta e deixou de ser.** O estado
 * "aberta ou não" mora agora em `store/modais.ts`, junto com o de todo modal —
 * a paleta foi só o primeiro, e o plano de paridade abre dezenas. Manter um
 * store por overlay daria cinquenta e nove stores e cinquenta e nove
 * condicionais no `App`.
 *
 * ⚠ **E o listener de ⌘K também saiu daqui.** Ele era o único atalho do app
 * com handler, montado por `ligarAtalhoDaPaleta` — que tinha UM chamador,
 * `dev/Arnes.tsx`. Ou seja: a tecla funcionava na tela de medição e não
 * funcionava no produto. Agora ela é uma linha do registro de
 * `atalhos/registro.ts`, junto das outras vinte e três, e quem escuta é o
 * listener único de `atalhos/ligar.ts`.
 */
import { abrirModal, fecharModal, lerModal } from "./modais";

/**
 * Abre a paleta — ou fecha, se já estiver aberta.
 *
 * Alterna porque é o que a mão espera de um atalho que abre algo, e porque
 * evita o estado de "apertei duas vezes e não sei se abriu". O botão do
 * cabeçalho da lista de canais chama a mesma função: ele é o que torna o
 * recurso descobrível e alcançável por TOQUE — a tecla sozinha deixava a
 * paleta invisível para quem não a conhece.
 */
export function abrirPaleta(): void {
  buscaInicial = "";
  if (lerModal() === "paleta") fecharModal();
  else abrirModal("paleta");
}

/**
 * O texto com que a paleta ABRE — vazio, salvo quando quem abriu pediu um
 * filtro.
 *
 * ⚠ **É o prefixo, e não um estado de filtro paralelo.** A paleta tem um dono
 * só para o filtro, a string de busca (ver `analisarBusca`); abrir "já em
 * pessoas" é abrir com `@` escrito no campo, e apagá-lo com Backspace desfaz o
 * filtro exatamente como se a pessoa o tivesse digitado.
 *
 * Lido pelo inicializador do `useState` da paleta — leitura pura, sem
 * consumir: o `StrictMode` invoca inicializadores duas vezes, e um valor que
 * se apagasse na primeira leitura faria a segunda abrir sem filtro.
 */
let buscaInicial = "";

export function lerBuscaInicial(): string {
  return buscaInicial;
}

/**
 * Abre a paleta com `busca` já escrita no campo. Não alterna: quem chama é um
 * gatilho visível, e a paleta aberta cobre o gatilho.
 */
export function abrirPaletaCom(busca: string): void {
  buscaInicial = busca;
  abrirModal("paleta");
}
