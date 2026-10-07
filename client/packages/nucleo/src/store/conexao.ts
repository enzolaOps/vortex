/**
 * O estado da conexão, para a interface.
 *
 * Store module-level e não Context, pela lei nº 1: quem muda isto é um evento
 * de socket, que não está em árvore de componente nenhuma. E o valor é uma
 * string comparada por `Object.is`, então quem assina só acorda quando o
 * estado realmente muda.
 *
 * Os três estados do SDK viram três porque são exatamente as três respostas
 * que a interface precisa dar — "tudo bem", "espere" e "não deu" — e não
 * porque o protocolo tem três.
 */
import { quando } from "../lib/quando";

export type EstadoDaConexao = "conectado" | "reconectando" | "sem-conexao";

/**
 * O que a faixa precisa saber além do estado.
 *
 * ⚠ **Referência CACHEADA — é o erro nº 1 do briefing em forma de objeto.**
 * `lerDetalheDaConexao` devolve sempre a mesma instância até algo mudar de
 * verdade; montá-la dentro do getter seria o loop de render que trava a aba.
 *
 * Por que estes três campos e não os do design inteiro: cada um tem FONTE.
 * `tentativa` conta os `connecting` que o SDK emite, `ultimaSincronia` é o
 * instante do último `connected`, e `pausada` é a pessoa tendo clicado em
 * "Cancelar". O que o design mostra e não está aqui — perda em % e latência em
 * ms — não tem produtor: o websocket não reporta nenhum dos dois, e derivá-los
 * seria a mesma invenção que a faixa de voz recusou quando quis milissegundos
 * a partir de uma classificação.
 */
export type DetalheDaConexao = {
  estado: EstadoDaConexao;
  /** Quantos `connecting` desde a última vez que a sessão esteve de pé. */
  tentativa: number;
  /** Instante do último `connected`, em ms. `undefined` = nunca nesta sessão. */
  ultimaSincronia: number | undefined;
  /**
   * O mesmo instante, já escrito ("14:31", "ontem", "2 dias").
   *
   * ⚠ **Formatado na ESCRITA e não no render**, como `createdAtText` e
   * `tamanhoTexto`. Duas razões, e a segunda é a que obriga: `quando` precisa
   * do agora, e ler o relógio dentro do render é chamada impura — o lint do
   * React Compiler reprova, e com razão, porque o valor mudaria entre dois
   * renders que deveriam ser idênticos.
   *
   * Recalculado a cada publicação, ou seja a cada tentativa de reconexão:
   * uma queda que atravessa a meia-noite passa de "14:31" para "ontem 14:31"
   * sozinha, em vez de afirmar um horário de hoje que não houve.
   */
  ultimaSincroniaTexto: string | undefined;
  /** A pessoa pediu para parar de tentar. Só sai com "Tentar agora". */
  pausada: boolean;
};

/**
 * Quanto tempo fora do ar antes de AVISAR.
 *
 * Reconexão de socket é frequente e quase sempre invisível: um segundo de
 * túnel, um wi-fi trocando de ponto. Uma faixa que pisca a cada engasgo ensina
 * a ignorá-la, e aí ela não serve para o caso que importa — a queda que dura.
 *
 * Um segundo e meio é o ponto onde a pessoa já percebeu que algo travou. Antes
 * disso o silêncio é mais honesto que o aviso.
 */
const ESPERA_ANTES_DE_AVISAR = 1500;

let estado: EstadoDaConexao = "conectado";
/** O que o SDK disse, antes da espera. */
let bruto: EstadoDaConexao = "conectado";
let tentativa = 0;
let ultimaSincronia: number | undefined;
let pausada = false;
let agendado: ReturnType<typeof setTimeout> | undefined;

let detalhe: DetalheDaConexao = {
  estado: "conectado",
  tentativa: 0,
  ultimaSincronia: undefined,
  ultimaSincroniaTexto: undefined,
  pausada: false,
};

const ouvintes = new Set<() => void>();

export function assinarConexao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável: uma string. */
export function lerConexao(): EstadoDaConexao {
  return estado;
}

/** Referência estável: o objeto só é remontado quando um campo muda. */
export function lerDetalheDaConexao(): DetalheDaConexao {
  return detalhe;
}

/**
 * Publica o que estiver nas variáveis, se algo mudou.
 *
 * Compara CAMPO a campo, e não o estado sozinho: o contador de tentativa anda
 * com a faixa já na tela, e comparar só `estado` congelaria o número. Quem
 * assina `lerConexao` (a linha de mensagem, a member list) acorda junto, mas
 * devolve a mesma string e o React descarta o render — o custo é a chamada.
 */
function publicar() {
  /*
    O texto só existe enquanto a faixa pode mostrá-lo. Conectado ele seria uma
    chamada de `Intl` por publicação para uma string que ninguém lê — e a
    publicação acontece a cada `connected`.
  */
  const ultimaSincroniaTexto =
    estado !== "conectado" && ultimaSincronia !== undefined
      ? quando(ultimaSincronia, Date.now(), "curto")
      : undefined;

  if (
    detalhe.estado === estado &&
    detalhe.tentativa === tentativa &&
    detalhe.ultimaSincronia === ultimaSincronia &&
    detalhe.ultimaSincroniaTexto === ultimaSincroniaTexto &&
    detalhe.pausada === pausada
  ) {
    return;
  }
  detalhe = {
    estado,
    tentativa,
    ultimaSincronia,
    ultimaSincroniaTexto,
    pausada,
  };
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * O SDK mudou de estado.
 *
 * Voltar a "conectado" é IMEDIATO; sair dele espera. A assimetria é o ponto:
 * ninguém precisa ser avisado com atraso de que voltou a funcionar, e um aviso
 * que demora a sumir depois de resolvido é pior que não ter havido aviso.
 */
export function definirConexao(novo: EstadoDaConexao): void {
  bruto = novo;

  if (agendado !== undefined) {
    clearTimeout(agendado);
    agendado = undefined;
  }

  if (novo === "conectado") {
    estado = "conectado";
    tentativa = 0;
    ultimaSincronia = Date.now();
    pausada = false;
    publicar();
    return;
  }

  /*
    Cada `connecting` é uma tentativa, e ela é contada mesmo dentro da espera.

    O contador não é o que decide se a faixa aparece — quem decide é o relógio
    de 1,5s. Separá-los é o que faz a faixa já nascer dizendo "tentativa 2"
    quando o engasgo passou de curto a longo, em vez de recomeçar do 1 e
    afirmar que a primeira tentativa acabou de sair.
  */
  if (novo === "reconectando") {
    tentativa += 1;
    // Voltar a tentar sozinho desfaz a pausa: o que ela representa é "pare", e
    // o SDK só volta a emitir `connecting` depois de alguém mandar.
    pausada = false;
  }

  // Já estava avisando: troca o texto na hora, sem reiniciar a espera. Sair de
  // "reconectando" para "sem-conexão" é uma piora, e fazer a pessoa esperar
  // de novo para saber disso seria esconder a informação nova.
  if (estado !== "conectado") {
    estado = novo;
    publicar();
    return;
  }

  // O contador pode ter andado dentro da espera; publicar aqui não mostra
  // faixa nenhuma (o estado ainda é "conectado") e mantém o número em dia.
  publicar();

  agendado = setTimeout(() => {
    agendado = undefined;
    estado = bruto;
    publicar();
  }, ESPERA_ANTES_DE_AVISAR);
}

/**
 * A pessoa pediu para parar de tentar ("Cancelar").
 *
 * Vai direto para "sem-conexão", SEM a espera: a espera existe para não
 * assustar com engasgo curto, e aqui quem produziu o estado foi um clique —
 * atrasar a resposta a um clique é o defeito que ela evita, invertido.
 */
export function pausarConexao(): void {
  if (agendado !== undefined) {
    clearTimeout(agendado);
    agendado = undefined;
  }
  bruto = "sem-conexao";
  estado = "sem-conexao";
  pausada = true;
  publicar();
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparConexao(): void {
  if (agendado !== undefined) clearTimeout(agendado);
  agendado = undefined;
  estado = "conectado";
  bruto = "conectado";
  tentativa = 0;
  ultimaSincronia = undefined;
  pausada = false;
  detalhe = {
    estado: "conectado",
    tentativa: 0,
    ultimaSincronia: undefined,
    ultimaSincroniaTexto: undefined,
    pausada: false,
  };
}
