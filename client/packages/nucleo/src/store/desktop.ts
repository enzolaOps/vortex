import { AO_FECHAR, ponte, type AoFechar } from "../sdk/desktop";

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

  /**
   * O corretor ortográfico do Chromium, no composer e em todo campo.
   *
   * ⚠ **Ele existia no store da casca e ninguém o lia.** O menu nativo
   * gravava `spellchecker`, `config.sync()` mandava a chave ao renderer e
   * nenhuma tela a mostrava — e na partida seguinte o valor era ignorado,
   * porque quem liga o motor é o `webPreferences` da janela. A casca traduz o
   * nome: lá a chave é `spellchecker`, do upstream.
   */
  readonly corretorOrtografico: boolean;

  /**
   * O que está EM USO neste processo — só a casca sabe, e só muda reiniciando.
   *
   * ⚠ **A barra de título desenha por `barraNativaEmUso`, nunca por
   * `barraNativa`.** A moldura da janela é decidida ao criá-la: se a barra
   * custom sumisse ao marcar "barra do sistema", a janela atual ficaria sem
   * moldura nenhuma e sem barra nossa até o próximo início — uma janela que
   * não fecha.
   */
  readonly barraNativaEmUso: boolean;
  readonly aceleracaoEmUso: boolean;
};

/** O que a tela pode escrever: o que está em uso e `naCasca` são só leitura. */
export type MudancaDeDesktop = Partial<
  Omit<Desktop, "naCasca" | "barraNativaEmUso" | "aceleracaoEmUso">
>;

/** Quais escolhas só valem depois de reiniciar, na ordem em que a tela as cita. */
export function pendentesDeReinicio(d: Desktop): ("aceleracao" | "barra")[] {
  const pendentes: ("aceleracao" | "barra")[] = [];
  if (d.aceleracaoDeHardware !== d.aceleracaoEmUso) pendentes.push("aceleracao");
  if (d.barraNativa !== d.barraNativaEmUso) pendentes.push("barra");
  return pendentes;
}

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
  /* Ligado, como o store da casca — o padrão mostra o estado VERDADEIRO. */
  corretorOrtografico: true,

  barraNativaEmUso: false,
  aceleracaoEmUso: true,
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
export function definirDesktop(mudanca: MudancaDeDesktop): void {
  publicar(mudanca);
  const p = ponte();
  if (!p) return;
  /*
    ⚠ **Depois de gravar, RELÊ.** A casca é quem decide o que vale: ela recusa
    chave que não entende (casca antiga), acopla "minimizar para a bandeja" a
    "ao fechar", e no macOS ignora a barra nativa. Sem reler, a tela mostraria
    o que a pessoa clicou em vez do que ficou gravado — que é exatamente como
    o defeito de "nada persiste" passou despercebido.
  */
  void Promise.all(
    Object.entries(mudanca).map(([chave, valor]) => p.gravarPreferencia(chave, valor)),
  ).then(hidratarDesktop, hidratarDesktop);
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
  estado = desktopDaLeitura(cru);
  for (const o of ouvintes) o();
}

/**
 * A leitura crua da casca vira o snapshot. Exportada para o teste.
 *
 * ⚠ **Sem as chaves de "em uso" (casca antiga), o em uso é a PREFERÊNCIA.**
 * Uma casca que não as manda também nunca gravou a preferência, então as duas
 * são o padrão — e a barra custom continua desenhada, que é o que ela sempre
 * foi.
 */
export function desktopDaLeitura(cru: Record<string, unknown>): Desktop {
  const proximo: Record<string, unknown> = { ...PADRAO, naCasca: true };
  for (const chave of Object.keys(PADRAO)) {
    if (chave === "naCasca" || chave === "barraNativaEmUso" || chave === "aceleracaoEmUso") {
      continue;
    }
    if (chave in cru && typeof cru[chave] === typeof PADRAO[chave as keyof Desktop]) {
      proximo[chave] = cru[chave];
    }
  }
  /* O único campo que não é booleano: valor fora da união cai no padrão. */
  if (!(AO_FECHAR as readonly unknown[]).includes(proximo.aoFechar)) {
    proximo.aoFechar = PADRAO.aoFechar;
  }
  proximo.barraNativaEmUso =
    typeof cru.barraNativaEmUso === "boolean" ? cru.barraNativaEmUso : proximo.barraNativa;
  proximo.aceleracaoEmUso =
    typeof cru.aceleracaoEmUso === "boolean"
      ? cru.aceleracaoEmUso
      : proximo.aceleracaoDeHardware;
  return proximo as unknown as Desktop;
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparDesktop(): void {
  estado = PADRAO;
}
