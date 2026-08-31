/**
 * O atalho que abre a paleta de comandos.
 *
 * ⚠ **Este arquivo já foi o store da paleta e deixou de ser.** O estado
 * "aberta ou não" mora agora em `store/modais.ts`, junto com o de todo modal —
 * a paleta foi só o primeiro, e o plano de paridade abre dezenas. Manter um
 * store por overlay daria cinquenta e nove stores e cinquenta e nove
 * condicionais no `App`.
 *
 * O que sobra aqui é o que é REALMENTE da paleta: a tecla. Ela continua
 * module-level pela razão de sempre — um listener de `document` não está
 * dentro de árvore de componente nenhuma, e prendê-lo a uma faria o `App`
 * re-renderizar a cada abertura, levando junto tudo o que ele monta.
 */
import { abrirModal, fecharModal, lerModal } from "./modais";

/**
 * O atalho global. Registrado UMA vez, no módulo, não por componente.
 *
 * Idempotente pela mesma razão do `startAdapter`: `StrictMode` monta duas
 * vezes em dev, e dois listeners fariam a paleta abrir e fechar no mesmo
 * pressionar.
 *
 * `Cmd+K` no macOS, `Ctrl+K` no resto — `metaKey` e `ctrlKey` testados
 * juntos, sem detectar plataforma. Detectar o SO por `navigator` erra em
 * teclado externo e em quem remapeia, e o custo de aceitar os dois é zero:
 * ninguém aperta Ctrl+K no Mac por acidente.
 */
let ligado = false;

export function ligarAtalhoDaPaleta(): void {
  if (ligado) return;
  ligado = true;

  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "k" && evento.key !== "K") return;
    if (!evento.metaKey && !evento.ctrlKey) return;

    // `preventDefault` porque o navegador usa Cmd+K para a barra de busca em
    // alguns casos, e porque sem ele o "k" chegaria no composer.
    evento.preventDefault();

    // Alterna: apertar de novo fecha. É o que a mão espera de um atalho que
    // abre algo — e evita o estado de "apertei duas vezes e não sei se abriu".
    if (lerModal() === "paleta") fecharModal();
    else abrirModal("paleta");
  });
}

/**
 * Abre a paleta. Existe para o botão do cabeçalho da lista de canais.
 *
 * O botão é o que torna o recurso descobrível e alcançável por TOQUE — a tecla
 * sozinha deixava a paleta invisível para quem não a conhece, e inacessível
 * onde não há teclado.
 */
export function abrirPaleta(): void {
  abrirModal("paleta");
}
