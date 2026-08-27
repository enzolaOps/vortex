/**
 * A paleta está aberta?
 *
 * Store module-level, não estado de componente. A razão é a mesma do toast na
 * fase 2: **quem abre a paleta é um atalho de TECLADO no `document`**, e um
 * listener global não está dentro de árvore de componente nenhuma.
 *
 * A alternativa seria um `useState` no App com um `useEffect` registrando o
 * listener — e aí o App re-renderiza a cada abertura, levando junto tudo o que
 * ele monta. É a lei nº 1 num lugar que não parece lista.
 */

type Ouvinte = () => void;

let aberta = false;
const ouvintes = new Set<Ouvinte>();

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte();
}

export function paletaAberta(): boolean {
  return aberta;
}

export function abrirPaleta(): void {
  if (aberta) return;
  aberta = true;
  avisar();
}

export function fecharPaleta(): void {
  if (!aberta) return;
  aberta = false;
  avisar();
}

export function assinarPaleta(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

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
    if (aberta) fecharPaleta();
    else abrirPaleta();
  });
}
