import { ponte, type AoFechar, type Canto } from "../sdk/desktop";

/**
 * As preferências que só existem no app instalado.
 *
 * ⚠ **A fonte da verdade é a CASCA, não este módulo.** Elas governam o
 * processo main — abrir com o sistema, minimizar para a bandeja, aceleração de
 * hardware — e o main precisa lê-las antes de a janela existir. Guardá-las só
 * aqui daria um `localStorage` que o main não enxerga, e "iniciar com o
 * sistema" ficaria marcado sem nunca ter sido registrado no sistema.
 *
 * Este store é o ESPELHO local: ele existe para a tela desenhar sem esperar
 * IPC a cada render, e toda escrita atravessa `gravarPreferencia`. No
 * navegador, onde não há casca, ele guarda em memória e a seção nem aparece.
 */

export type Desktop = {
  /**
   * Estamos dentro da casca?
   *
   * ⚠ **Campo do SNAPSHOT e não `naDesktop()` lido no render, e a diferença
   * mordeu.** `window.vortex` é estado global mutável sem subscrição: quem o
   * lesse durante o render não teria como ser acordado quando ele mudasse, e o
   * React Compiler — que memoiza por dependência declarada — não tem como
   * saber que aquela chamada precisa refazer.
   *
   * Medido no arnês: com a casca falsa ligada, `window.vortex` existia e a
   * barra de título NÃO renderizava. Nada falhava; o componente simplesmente
   * não voltava a rodar.
   *
   * Em produção o `window.vortex` existe desde o primeiro byte e nunca muda,
   * então o defeito seria invisível para sempre — e apareceria no dia em que
   * alguém precisasse alternar. O arnês pagou a passagem.
   */
  readonly naCasca: boolean;
  readonly iniciarComSistema: boolean;
  readonly minimizarParaBandeja: boolean;
  readonly abrirMinimizado: boolean;
  readonly lembrarJanela: boolean;
  readonly sempreNoTopoEmChamada: boolean;
  readonly barraNativa: boolean;
  readonly aoFechar: AoFechar;

  readonly aceleracaoDeHardware: boolean;
  readonly reduzirEmSegundoPlano: boolean;
  readonly preCarregarAnexos: boolean;

  readonly overlay: boolean;
  readonly cantoDoOverlay: Canto;
};

/*
  ⚠ **`aceleracaoDeHardware` começa LIGADA e é a única que exige reinício.** O
  Electron decide o backend de render antes de a primeira janela existir
  (`app.disableHardwareAcceleration()` só vale antes do `ready`), então trocá-la
  em runtime não faz nada — e um interruptor que parece funcionar e não funciona
  é pior que um desabilitado. A tela marca essa com um selo "reinício".
*/
const PADRAO: Desktop = {
  naCasca: false,
  iniciarComSistema: false,
  minimizarParaBandeja: true,
  abrirMinimizado: false,
  lembrarJanela: true,
  sempreNoTopoEmChamada: false,
  barraNativa: false,
  aoFechar: "bandeja",

  aceleracaoDeHardware: true,
  reduzirEmSegundoPlano: true,
  preCarregarAnexos: false,

  overlay: false,
  cantoDoOverlay: "cima-fim",
};

let estado: Desktop = PADRAO;
const ouvintes = new Set<() => void>();

export function assinarDesktop(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência cacheada — armadilha nº 1. */
export function lerDesktop(): Desktop {
  return estado;
}

function publicar(mudanca: Partial<Desktop>): void {
  estado = { ...estado, ...mudanca };
  for (const o of ouvintes) o();
}

/**
 * Escreve local E na casca.
 *
 * ⚠ **Otimista de propósito, e sem rollback.** O interruptor precisa responder
 * ao toque; esperar o IPC daria 30–80ms de nada acontecendo num controle cuja
 * única função é dar retorno imediato. Se o main recusar, ele reemite o estado
 * inteiro por `hidratar` — que é o mesmo caminho da abertura, e por isso não
 * há um segundo mecanismo de correção a manter.
 */
export function definirDesktop(mudanca: Partial<Desktop>): void {
  publicar(mudanca);
  const p = ponte();
  if (!p) return;
  for (const [chave, valor] of Object.entries(mudanca)) {
    void p.gravarPreferencia(chave, valor);
  }
}

/**
 * Lê da casca na abertura.
 *
 * ⚠ **Chave desconhecida é IGNORADA, e conhecida ausente cai no padrão** — a
 * mesma disciplina do schema de preset, e pela mesma razão: uma casca mais
 * nova que o cliente vai mandar chaves que este código não conhece, e
 * derrubar a leitura inteira por causa de uma delas apagaria todas as outras.
 */
export async function hidratarDesktop(): Promise<void> {
  const p = ponte();
  /*
    ⚠ Sem casca, publica o PADRÃO com `naCasca: false` em vez de sair calado.
    O arnês liga e DESLIGA a casca falsa, e um `return` seco deixaria a barra
    de título na tela depois de desligá-la — estado que a produção nunca tem e
    que o rig produziria a cada clique.
  */
  if (!p) {
    estado = PADRAO;
    for (const o of ouvintes) o();
    return;
  }

  const cru = await p.lerPreferencias();
  const proximo: Record<string, unknown> = { ...PADRAO, naCasca: true };
  for (const chave of Object.keys(PADRAO)) {
    if (chave in cru) proximo[chave] = cru[chave];
  }
  estado = proximo as unknown as Desktop;
  for (const o of ouvintes) o();
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparDesktop(): void {
  estado = PADRAO;
}
