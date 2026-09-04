/**
 * As enquetes, por mensagem.
 *
 * ⚠ **Enquete não existe no protocolo Stoat.** Não há tipo de mensagem, campo
 * ou evento — é a mesma classe da etiqueta FÓRUM e da figurinha: superfície
 * cujo dado nenhum servidor upstream sabe produzir. O design a desenha em duas
 * formas (aberta e encerrada) e a decisão de quem toca o produto é construir
 * 1:1 agora.
 *
 * Store de CLIENTE, como `pastas.ts`, `silencio.ts` e `colapso.ts` — os três
 * precedentes de conceito que o cliente tem e o protocolo não. A diferença é
 * que aqueles três são preferência de quem usa, e este seria dado
 * compartilhado: por isso **criar** uma enquete continua sendo pendência.
 * Guardar o voto localmente e chamar isso de enquete daria uma contagem que só
 * você vê, o que é pior que não ter a feature.
 *
 * Quem escreve aqui hoje é o ARNÊS, e isso é deliberado: é o mesmo arranjo de
 * `configurarSimulacaoDeEnvio` — código de produto dirigido pelo arnês para
 * que a superfície exista, seja medida e seja verificável antes de o backend
 * existir. Quando o protocolo tiver enquete, quem escreve passa a ser o
 * adapter e nada acima daqui muda.
 */

export type OpcaoDeEnquete = {
  readonly id: string;
  /** O glifo à esquerda — 🅰, 🅱. É do autor, não derivado da posição. */
  readonly marca: string;
  readonly texto: string;
  readonly votos: number;
};

export type Enquete = {
  readonly pergunta: string;
  readonly opcoes: readonly OpcaoDeEnquete[];
  /** Quantas opções cabem por pessoa. 1 = "uma resposta". */
  readonly maximo: number;
  /** Em que opção EU votei. `undefined` = ainda não votei. */
  readonly meuVoto: string | undefined;
  /**
   * Quando fecha, em ms. `undefined` = já encerrada.
   *
   * Duas informações num campo só de propósito: "fecha em 22 h" e "encerrada
   * ontem às 20:00" são a mesma pergunta — quanto tempo resta — e um booleano
   * separado abriria o estado inconsistente "encerrada com prazo no futuro".
   */
  readonly fechaEm: number | undefined;
  /**
   * Esconde a contagem até fechar.
   *
   * É a opção "Resultado só no fim" do modal de criação, e ela existe porque
   * enquete com resultado visível enviesa: as primeiras respostas puxam as
   * seguintes.
   */
  readonly resultadoNoFim: boolean;
};

type Ouvinte = () => void;

const enquetes = new Map<string, Enquete>();
const ouvintes = new Set<Ouvinte>();

export function assinarEnquetes(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * A enquete de uma mensagem, ou `undefined`.
 *
 * Devolve a REFERÊNCIA guardada — a armadilha nº 1. Este valor entra no
 * snapshot da mensagem, e um objeto novo a cada leitura faria toda linha com
 * enquete republicar em todo ciclo.
 */
export function lerEnquete(messageId: string): Enquete | undefined {
  return enquetes.get(messageId);
}

/** Escreve (ou substitui) a enquete de uma mensagem. */
export function definirEnquete(messageId: string, enquete: Enquete): void {
  enquetes.set(messageId, enquete);
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * Votar — otimista, e o design diz por quê.
 *
 * *"Voto é otimista: preenche na hora e reverte com toast em caso de erro."*
 * Não há para onde mandar hoje, então o otimismo é tudo o que existe; o que a
 * função guarda é a REGRA, que sobrevive à chegada do protocolo: votar de novo
 * na mesma opção RETIRA o voto, e votar em outra move.
 */
export function votar(messageId: string, opcaoId: string): void {
  const atual = enquetes.get(messageId);
  if (!atual || atual.fechaEm === undefined) return;

  const tirando = atual.meuVoto === opcaoId;
  enquetes.set(messageId, {
    ...atual,
    meuVoto: tirando ? undefined : opcaoId,
    opcoes: atual.opcoes.map((o) => {
      const delta =
        (o.id === opcaoId && !tirando ? 1 : 0) -
        (o.id === atual.meuVoto ? 1 : 0);
      return delta === 0 ? o : { ...o, votos: o.votos + delta };
    }),
  });
  for (const ouvinte of ouvintes) ouvinte();
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparEnquetes(): void {
  enquetes.clear();
}

/** O total de votos, para o rodapé "N votos". */
export function totalDeVotos(e: Enquete): number {
  let n = 0;
  for (const o of e.opcoes) n += o.votos;
  return n;
}

/**
 * A porcentagem de uma opção, arredondada.
 *
 * Zero votos devolve 0 e não `NaN` — divisão por zero numa enquete recém-criada
 * é o caso mais comum que existe, não a exceção.
 */
export function porcentagem(e: Enquete, opcao: OpcaoDeEnquete): number {
  const total = totalDeVotos(e);
  return total === 0 ? 0 : Math.round((opcao.votos / total) * 100);
}
