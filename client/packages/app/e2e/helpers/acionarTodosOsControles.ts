import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Uma isenção DECLARADA: o controle que não produz efeito observável por si só
 * (abre um diálogo nativo, só move o foco, navega para fora). Sem declaração, controle
 * que não faz nada é defeito (PRD §3 nº 1: silêncio não é resposta).
 */
export interface Isencao {
  /** Nome acessível do controle (texto exato ou regex). */
  nome: string | RegExp;
  motivo: string;
}

export interface OpcoesDeAcionamento {
  /** Onde procurar os controles. Padrão: a página inteira. */
  raiz?: Locator;
  isencoes?: readonly Isencao[];
}

/** O que a pessoa pode focar e acionar. */
const FOCAVEIS = [
  "button",
  "a[href]",
  "input:not([type=hidden])",
  "select",
  "textarea",
  '[role="button"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface Controle {
  indice: number;
  nome: string;
  descricao: string;
}

/**
 * O retrato observável: árvore inteira do documento (atributos ARIA incluídos, então
 * `aria-pressed`, `aria-expanded` e `aria-current` contam), endereço e título. Qualquer
 * mudança de interface por causa do clique muda isto.
 */
async function retrato(pagina: Page): Promise<string> {
  return pagina.evaluate(() => `${location.href}\n${document.title}\n${document.documentElement.outerHTML}`);
}

const casa = (nome: string, alvo: string | RegExp) => (typeof alvo === "string" ? nome === alvo : alvo.test(nome));

/**
 * Clica em TUDO que é focável e exige efeito observável (a árvore do documento muda)
 * ou isenção declarada pelo nome. Devolve o relatório; reprova ao final, com a lista
 * completa dos controles inertes, em vez de parar no primeiro (quem corrige quer a lista).
 *
 * Entre um clique e outro a página volta ao ponto de partida: Esc fecha o que abriu, e se
 * o endereço mudou, volta. Controle desabilitado não é acionável por definição e fica de fora.
 */
export async function acionarTodosOsControles(
  pagina: Page,
  { raiz, isencoes = [] }: OpcoesDeAcionamento = {},
): Promise<{ acionados: number; isentos: number }> {
  const alvo = (raiz ?? pagina.locator("body")).locator(FOCAVEIS);
  const total = await alvo.count();

  const controles: Controle[] = [];
  for (let i = 0; i < total; i++) {
    const el = alvo.nth(i);
    if (!(await el.isVisible()) || !(await el.isEnabled())) continue;
    // Campo de formulário não tem texto interno: o nome é o do rótulo associado.
    const rotulo = await el.evaluate((n) => (n as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? "");
    const nome =
      (await el.getAttribute("aria-label")) ??
      ((await el.innerText()).trim() || rotulo || (await el.getAttribute("title")) || "");
    const descricao = await el.evaluate((n) => n.outerHTML.slice(0, 120));
    controles.push({ indice: i, nome, descricao });
  }

  const inertes: string[] = [];
  let isentos = 0;
  const inicio = pagina.url();

  for (const c of controles) {
    const isencao = isencoes.find((i) => casa(c.nome, i.nome));
    if (isencao) {
      isentos += 1;
      continue;
    }
    const antes = await retrato(pagina);
    await alvo.nth(c.indice).click({ trial: false, timeout: 5000 });
    // Um quadro para o React assentar antes de comparar.
    await pagina.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    const depois = await retrato(pagina);
    if (antes === depois) inertes.push(`"${c.nome || "(sem nome)"}"  ${c.descricao}`);

    // Volta ao ponto de partida para o próximo clique partir do mesmo estado.
    await pagina.keyboard.press("Escape");
    if (pagina.url() !== inicio) await pagina.goto(inicio);
  }

  expect(
    inertes,
    `Controles sem efeito observável (ligue a ação, desabilite ou declare isenção com motivo):\n${inertes.join("\n")}`,
  ).toEqual([]);

  return { acionados: controles.length - isentos, isentos };
}
