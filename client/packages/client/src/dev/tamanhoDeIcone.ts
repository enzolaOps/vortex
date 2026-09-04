/**
 * Todo ícone na tela tem UM dono do seu tamanho.
 *
 * ⚠ **A escala de ícone tem duas superfícies, e as duas podem dimensionar o
 * mesmo `svg`** — a prop `size={ICONE.x}` no TSX, que vira atributo `width`, e
 * uma regra de CSS Module como `.acoes svg { inline-size: var(--vx-icon-1) }`.
 * O CSS sempre ganha. Quando os dois falam, o número escrito no TSX não é o da
 * tela: medido em navegador, **43 ícones** traziam `size={20}` e desenhavam 12
 * ou 14.
 *
 * Não dá erro, não quebra teste, não some no lint. Quem lê o componente
 * acredita no número que está ali — e é a família do comentário que afirma uma
 * medida que não existe.
 *
 * ⚠ **Por que assertion e não lint.** A regra vencedora mora num arquivo e o
 * ícone em outro: `.cabecalho svg` dimensiona glifos renderizados por
 * componentes-filhos que o CSS nunca viu. Casar isso estaticamente é
 * reimplementar o seletor de CSS; o navegador já sabe a resposta. Um
 * analisador estático que escrevi antes desta assertion achou 27 sítios e
 * perdeu os cross-file — o navegador achou os dois grupos sem saber de nada.
 *
 * A regra é simétrica, e os dois lados são defeito:
 *
 * - **dois donos** — a prop é morta e mente.
 * - **nenhum dono** — o `svg` renderiza no `1em` do Phosphor, ou seja o
 *   tamanho dele é o da fonte herdada, que é o oposto de uma escala.
 *
 * Só em dev, e some do bundle de produção — inclusive do build que o
 * `pnpm gate` mede.
 */

import { FORA_DA_ESCALA, ICONE } from "../components/ui/icones";

const DEGRAUS: ReadonlySet<number> = new Set(Object.values(ICONE));
const TOLERADOS: ReadonlySet<number> = new Set(FORA_DA_ESCALA.map((e) => e.px));

/**
 * As regras de CSS que dimensionam `svg`, colhidas UMA vez.
 *
 * Percorrer `document.styleSheets` por ícone seria milhares de varreduras por
 * verificação. As folhas não mudam depois do boot em dev — o HMR recarrega o
 * módulo inteiro, e com ele este cache.
 */
let regrasDeTamanho: { seletor: string; valor: string }[] | undefined;

function colherRegras(): { seletor: string; valor: string }[] {
  if (regrasDeTamanho) return regrasDeTamanho;
  const achadas: { seletor: string; valor: string }[] = [];
  for (const folha of Array.from(document.styleSheets)) {
    let regras: CSSRuleList;
    try {
      regras = folha.cssRules;
    } catch {
      continue; // folha de outra origem: inacessível, e não é nossa
    }
    for (const regra of Array.from(regras)) {
      if (!(regra instanceof CSSStyleRule)) continue;
      const valor = regra.style.inlineSize || regra.style.width;
      if (!valor) continue;
      achadas.push({ seletor: regra.selectorText, valor });
    }
  }
  regrasDeTamanho = achadas;
  return achadas;
}

/** Quem dimensiona este `svg` pelo CSS, se alguém. */
function regraQueVence(svg: SVGElement): string | undefined {
  for (const { seletor } of colherRegras()) {
    try {
      if (svg.matches(seletor)) return seletor;
    } catch {
      // seletor que o navegador aceita na folha mas recusa em `matches`
    }
  }
  return undefined;
}

/**
 * Um rótulo estável para agrupar o relato.
 *
 * Sem ele, uma coluna de quarenta canais produz quarenta linhas idênticas no
 * console — e relatório que ninguém lê não guarda nada, que é o mesmo defeito
 * que a assertion de 0px teve antes de exigir `offsetParent`.
 */
function ondeMora(svg: SVGElement): string {
  const dono = svg.closest("[aria-label]");
  const rotulo = dono?.getAttribute("aria-label");
  const classe = svg.parentElement?.className;
  const texto = typeof classe === "string" ? classe.split(/\s+/)[0] : "";
  return rotulo ?? texto ?? "?";
}

export function verificarTamanhoDeIcone(): void {
  if (!import.meta.env.DEV) return;

  const doisDonos = new Map<string, string>();
  const semDono = new Map<string, string>();
  const foraDaEscala = new Map<string, string>();

  for (const svg of Array.from(document.querySelectorAll("svg"))) {
    // Não renderizado é diferente de renderizado com zero, e só o segundo é
    // bug — a mesma correção que a assertion de linha em 0px precisou.
    if (!svg.checkVisibility?.() && !svg.getBoundingClientRect().width) continue;

    const attr = svg.getAttribute("width");
    const temProp = attr !== null && attr !== "1em" && /^\d/.test(attr);
    const regra = regraQueVence(svg);
    const chave = `${ondeMora(svg)} | ${regra ?? "sem regra"}`;

    if (temProp && regra) {
      doisDonos.set(chave, `prop diz ${attr}px, "${regra}" manda`);
      continue;
    }
    if (!temProp && !regra) {
      semDono.set(chave, `renderiza no 1em herdado`);
      continue;
    }
    const px = Math.round(svg.getBoundingClientRect().width);
    if (px && !DEGRAUS.has(px) && !TOLERADOS.has(px)) {
      foraDaEscala.set(chave, `${px}px não é degrau nem exceção declarada`);
    }
  }

  const relatar = (titulo: string, achados: Map<string, string>) => {
    if (achados.size === 0) return;
    console.error(
      `[vortex] tamanho de ícone — ${titulo} (${achados.size} lugar(es)):\n` +
        [...achados].map(([k, v]) => `  ${k}\n      ${v}`).join("\n"),
    );
  };

  relatar("DOIS donos, a prop é morta", doisDonos);
  relatar("NENHUM dono, herda o 1em", semDono);
  relatar("fora da escala e sem exceção declarada", foraDaEscala);
}

/**
 * Liga a verificação e a religa quando a árvore muda.
 *
 * ⚠ **Uma passada na montagem nasceria cega**, pela mesma razão que a de
 * alinhamento: quase toda superfície deste app monta depois — modal, painel,
 * seletor, configurações. O `MutationObserver` com fila longa é o preço de a
 * guarda cobrir o que só aparece quando alguém clica.
 */
export function observarTamanhoDeIcone(): () => void {
  if (!import.meta.env.DEV) return () => {};

  let agendado: number | undefined;
  const agendar = () => {
    if (agendado !== undefined) return;
    agendado = window.setTimeout(() => {
      agendado = undefined;
      verificarTamanhoDeIcone();
    }, 1500);
  };

  agendar();
  const observador = new MutationObserver(agendar);
  observador.observe(document.body, { childList: true, subtree: true });
  return () => {
    observador.disconnect();
    if (agendado !== undefined) window.clearTimeout(agendado);
  };
}
