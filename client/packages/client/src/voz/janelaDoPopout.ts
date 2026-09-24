import { definirFormaDoPopout } from "../store/popout";
import { espelharEstilos, NOME_DA_JANELA } from "./popoutNoSistema";

/**
 * A janela do sistema do popout — o store dela, module-level.
 *
 * ⚠ **Store e não estado de componente**, pela lei nº 1 e por uma razão mais
 * concreta: abrir a janela é efeito com cleanup (observadores, ouvinte de
 * `pagehide`, a própria janela), e o resultado (o elemento onde o portal
 * escreve) precisa chegar ao render. Guardado em `useState` dentro do efeito,
 * seria o `setState` em cascata que o lint do projeto reprova.
 *
 * Três estados. `indisponivel` é definitivo na sessão: quem nega é a casca
 * (antiga, ou o navegador sem ela), e perguntar de novo a cada troca de canal
 * daria a mesma resposta.
 */
export type JanelaDoPopout =
  | { readonly tipo: "fechada" }
  | { readonly tipo: "aberta"; readonly alvo: HTMLElement }
  | { readonly tipo: "indisponivel" };

const FECHADA: JanelaDoPopout = { tipo: "fechada" };
const INDISPONIVEL: JanelaDoPopout = { tipo: "indisponivel" };

let estado: JanelaDoPopout = FECHADA;
const ouvintes = new Set<() => void>();

function publicar(proximo: JanelaDoPopout): void {
  if (estado === proximo) return;
  estado = proximo;
  for (const o of ouvintes) o();
}

export function assinarJanelaDoPopout(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** Referência cacheada — armadilha nº 1 do briefing. */
export function lerJanelaDoPopout(): JanelaDoPopout {
  return estado;
}

/** A janela aberta agora, e o que desfazer ao fechá-la. */
let viva: { readonly alvo: HTMLElement; readonly desfazer: () => void } | undefined;

/**
 * O fechamento ADIADO de um tique.
 *
 * ⚠ **O `StrictMode` monta, desmonta e monta de novo todo efeito em
 * desenvolvimento**, e fechar a janela de verdade no meio disso esbarra numa
 * regra do navegador: `window.open` com o nome de uma janela que está
 * FECHANDO pode devolver essa mesma janela, já morta. Adiado, o segundo
 * `abrir` cancela o fechamento e reaproveita a janela viva — e em produção a
 * troca rápida de dependências do efeito ganha o mesmo: nada pisca.
 */
let fechamento: ReturnType<typeof setTimeout> | undefined;

function esquecer(): void {
  if (fechamento !== undefined) clearTimeout(fechamento);
  fechamento = undefined;
  viva = undefined;
}

/**
 * O popout é querido agora? Quem decide é o efeito do componente; as
 * tentativas adiadas conferem isto antes de abrir.
 */
let querida = false;

/** Já abriu nesta sessão — ou seja, a casca SABE abrir. */
let jaAbriu = false;

/**
 * A abertura adiada.
 *
 * ⚠ **Atraso curto antes de abrir, e é o que impede a janela de piscar.**
 * Entrar numa chamada abre a sala na coluna um instante DEPOIS de a chamada
 * existir; sem o atraso, o popout seria visível nesse instante e uma janela do
 * sistema nasceria e morreria na frente da pessoa. O cartão tinha o mesmo
 * instante, mas um quadro de cartão não se nota e uma janela sim.
 */
let abertura: ReturnType<typeof setTimeout> | undefined;
const ATRASO_MS = 150;

/**
 * ⚠ **Recusa depois de já ter aberto é OCUPADO, não incapaz.** Fechar a
 * janela e pedir outra logo em seguida chega à casca antes de ela saber que a
 * anterior fechou — e ela nega, porque é um popout por app. Tratar essa
 * recusa como "a casca não sabe" trocaria a janela pelo cartão até o fim da
 * sessão. Então tenta de novo, poucas vezes.
 */
const TENTATIVAS = 8;
const INTERVALO_MS = 250;

/**
 * Pede a janela. Idempotente, e adiado — ver `ATRASO_MS`.
 */
export function abrirJanelaDoPopout(): void {
  querida = true;
  if (estado.tipo === "indisponivel" || typeof window === "undefined") return;
  if (fechamento !== undefined) {
    clearTimeout(fechamento);
    fechamento = undefined;
  }
  if (viva) {
    if (estado.tipo !== "aberta") publicar({ tipo: "aberta", alvo: viva.alvo });
    return;
  }
  if (abertura === undefined) abertura = setTimeout(() => tentarAbrir(TENTATIVAS), ATRASO_MS);
}

/**
 * Abre de verdade.
 *
 * `window.open` com URL VAZIA: a janela fica no documento inicial, sem
 * navegação nenhuma — navegar para `about:blank` troca o documento depois do
 * primeiro quadro, e o que o portal tivesse escrito no primeiro sumiria.
 */
function tentarAbrir(restantes: number): void {
  abertura = undefined;
  if (!querida || viva) return;

  let janela: Window | null;
  try {
    janela = window.open("", NOME_DA_JANELA, "popup,width=420,height=272");
  } catch {
    janela = null;
  }
  if (!janela) {
    if (jaAbriu && restantes > 1) {
      abertura = setTimeout(() => tentarAbrir(restantes - 1), INTERVALO_MS);
    } else {
      publicar(INDISPONIVEL);
    }
    return;
  }
  jaAbriu = true;
  const alvoDaJanela = janela;

  const doc = alvoDaJanela.document;
  /* Fundo transparente: a moldura é a do popout, com o raio do design, e a
     janela sem moldura é transparente na casca. O `body` do app pinta
     `surface-0`, e ele encheria os cantos arredondados. */
  doc.body.style.margin = "0";
  doc.body.style.background = "transparent";
  doc.body.style.overflow = "hidden";

  const pararDeEspelhar = espelharEstilos(document, doc);

  /*
    A raiz ENCOLHE ao conteúdo (absoluta, sem largura): é o tamanho dela que
    vira o tamanho da janela. Um `div` de bloco teria a largura do `body`, que
    é a da janela — e a janela nunca encolheria para a forma mínima.
  */
  const alvo = doc.createElement("div");
  alvo.style.position = "absolute";
  alvo.style.insetBlockStart = "0";
  alvo.style.insetInlineStart = "0";
  doc.body.append(alvo);

  /*
    ⚠ **O `ResizeObserver` do REINO da janela**, não o daqui. Observação de
    tamanho é entregue na atualização de renderização do documento do
    observador; um observador desta página vigiando um nó de outro documento
    dependeria de os dois pintarem juntos — e a principal minimizada não
    pinta.
  */
  const Observador = (alvoDaJanela as Window & typeof globalThis).ResizeObserver;
  /*
    Só o TAMANHO sai daqui; onde a janela fica é a casca que decide. Numa
    janela aberta por `window.open`, `screenX` e `outerWidth` devolvem os da
    principal (medido no Electron 44), então uma conta de posição feita aqui
    mandaria o popout para o meio da tela. A casca ancora o canto de baixo e
    do fim no `content-bounds-updated` (`popoutDeVozModelo.ts`).
  */
  const observador = new Observador(() => {
    const caixa = alvo.getBoundingClientRect();
    const largura = Math.ceil(caixa.width);
    const altura = Math.ceil(caixa.height);
    if (largura === 0 || altura === 0) return;
    alvoDaJanela.resizeTo(largura, altura);
  });
  observador.observe(alvo);

  let nossa = false;

  const limpar = (): void => {
    observador.disconnect();
    pararDeEspelhar();
    alvoDaJanela.removeEventListener("pagehide", aoFecharPorFora);
    window.removeEventListener("pagehide", aoSairDaPrincipal);
  };

  /*
    Fechada POR FORA (Alt+F4, a barra de tarefas): a pessoa escolheu não ver
    o popout, e isso é o mesmo `✕` do cabeçalho. Sem virar `fechado` no store,
    a próxima troca de canal abriria a janela de novo.
  */
  function aoFecharPorFora(): void {
    if (nossa) return;
    limpar();
    esquecer();
    publicar(FECHADA);
    definirFormaDoPopout("fechado");
  }

  /*
    A principal recarregando: a janela é desenhada POR ela, e sem dono ficaria
    no topo com o último quadro congelado. A casca fecha a janela quando a
    principal FECHA (`outlivesOpener: false`); recarregar não fecha nada,
    então é daqui.
  */
  function aoSairDaPrincipal(): void {
    nossa = true;
    alvoDaJanela.close();
  }

  alvoDaJanela.addEventListener("pagehide", aoFecharPorFora);
  window.addEventListener("pagehide", aoSairDaPrincipal);

  viva = {
    alvo,
    desfazer: () => {
      nossa = true;
      limpar();
      alvoDaJanela.close();
    },
  };
  publicar({ tipo: "aberta", alvo });
}

/** Fecha a janela aberta, se houver. `indisponivel` fica como está. */
export function fecharJanelaDoPopout(): void {
  querida = false;
  if (abertura !== undefined) {
    clearTimeout(abertura);
    abertura = undefined;
  }
  if (!viva || fechamento !== undefined) return;
  if (estado.tipo === "aberta") publicar(FECHADA);
  fechamento = setTimeout(() => {
    const desfazer = viva?.desfazer;
    esquecer();
    desfazer?.();
  }, 0);
}

/** O título da janela — o que a barra de tarefas e o Alt+Tab mostram. */
export function definirTituloDaJanela(titulo: string): void {
  if (viva) viva.alvo.ownerDocument.title = titulo;
}

/* --------------------------------------------- o foco da principal */

function assinarFoco(ouvinte: () => void): () => void {
  window.addEventListener("focus", ouvinte);
  window.addEventListener("blur", ouvinte);
  return () => {
    window.removeEventListener("focus", ouvinte);
    window.removeEventListener("blur", ouvinte);
  };
}

function lerFoco(): boolean {
  return document.hasFocus();
}

/** Para `useSyncExternalStore`: a janela principal tem o foco? */
export const focoDaPrincipal = { assinar: assinarFoco, ler: lerFoco } as const;
