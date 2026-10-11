import { chaveDeMembro, type SistemaSnapshot } from "nucleo/sdk/domain";
import { useChannel, useNomeDoMembro } from "nucleo/store/hooks";

import { chat } from "../../textos";

/** Os nomes já resolvidos que a frase usa; `undefined` = a pessoa não existe naquela posição. */
export interface NomesDaFrase {
  readonly primeiro: string;
  readonly segundo: string | undefined;
  readonly ator: string;
  readonly alvo: string;
  readonly canal: string;
}

/**
 * A frase de uma linha de sistema, a partir do FATO do domínio e dos nomes.
 * Pura: o idioma é do catálogo, o que o evento diz é do snapshot.
 *
 * `total` é quantas pessoas a linha cobre (fusão de entradas seguidas). Com
 * duas, a frase cita as duas; com três ou mais, "A e mais N".
 */
export function fraseDeSistema(s: SistemaSnapshot, n: NomesDaFrase, total: number): string {
  const t = chat.sistema;
  // Uma pessoa, duas ("Ana e Caio") ou três e mais ("Ana e mais 4").
  const pessoas =
    total >= 3
      ? `${n.primeiro} ${t.maisN(total - 1)}`
      : total === 2 && n.segundo !== undefined
        ? `${n.primeiro} ${t.conjuncao} ${n.segundo}`
        : n.primeiro;
  switch (s.tipo) {
    case "entrou":
      return `${pessoas} ${t.entrou(total)}`;
    case "saiu":
      return `${pessoas} ${t.saiu(total)}`;
    case "expulso":
      return `${pessoas} ${t.expulso(total)}`;
    case "banido":
      return `${pessoas} ${t.banido(total)}`;
    case "entrouNoTopico":
      return `${pessoas} ${t.entrouNoTopico(total)}`;
    case "adicionou":
      return `${n.ator} ${t.adicionou} ${pessoas}`;
    case "removeu":
      return `${n.ator} ${t.removeu} ${pessoas}`;
    case "renomeou":
      return `${n.ator} ${t.renomeou} “${s.nome}”`;
    case "mudouDescricao":
      return t.mudouDescricao(n.ator);
    case "mudouIcone":
      return t.mudouIcone(n.ator);
    case "transferiu":
      return `${n.ator} ${t.transferiu} ${n.alvo}`;
    case "fixou":
      return t.fixou(n.ator);
    case "desafixou":
      return t.desafixou(n.ator);
    case "chamada":
      return s.duracaoTexto === undefined
        ? t.chamadaEmAndamento(n.ator)
        : `${t.chamadaTerminou(n.ator)} · ${t.durou(s.duracaoTexto)}`;
    case "moveu":
      return `${n.primeiro} ${t.moveu} ${n.canal}`;
    case "transmitiu":
      return t.transmitiu(n.primeiro);
    case "texto":
      return s.texto;
    case "desconhecido":
      return chat.eventoDoCanal;
  }
}

/** Quem o evento trata (as pessoas que entraram, saíram, foram expulsas…). */
function pessoasDe(s: SistemaSnapshot, grupo: readonly string[] | undefined): readonly string[] {
  switch (s.tipo) {
    case "entrou":
    case "saiu":
    case "expulso":
    case "banido":
    case "adicionou":
    case "removeu":
    case "moveu":
    case "transmitiu":
      return grupo ?? [s.userId];
    case "entrouNoTopico":
      return s.userIds;
    default:
      return [];
  }
}

/** Quem FEZ o evento (ou o dono antigo, na transferência). */
function atorDe(s: SistemaSnapshot): string {
  switch (s.tipo) {
    case "adicionou":
    case "removeu":
    case "renomeou":
    case "fixou":
    case "desafixou":
    case "mudouDescricao":
    case "mudouIcone":
    case "chamada":
      return s.porId;
    case "transferiu":
      return s.deId;
    default:
      return "";
  }
}

/**
 * A linha de sistema: assina SÓ os nomes que a frase usa (no máximo quatro
 * ganchos fixos, na mesma ordem sempre). Cada nome é uma assinatura por
 * entidade — um apelido que muda acorda esta linha, não a lista.
 */
export function FraseDeSistema({
  sistema,
  servidorId,
  grupo,
}: {
  sistema: SistemaSnapshot;
  servidorId: string;
  grupo?: readonly string[] | undefined;
}) {
  const pessoas = pessoasDe(sistema, grupo);
  const quem = (id: string | undefined) => chaveDeMembro(servidorId, id ?? "");
  const primeiro = useNomeDoMembro(quem(pessoas[0]));
  const segundo = useNomeDoMembro(quem(pessoas[1]));
  const ator = useNomeDoMembro(quem(atorDe(sistema)));
  const alvo = useNomeDoMembro(quem(sistema.tipo === "transferiu" ? sistema.paraId : undefined));
  const canal = useChannel(sistema.tipo === "moveu" ? sistema.paraId : "");

  const frase = fraseDeSistema(
    sistema,
    {
      primeiro: primeiro ?? chat.autorDesconhecido,
      segundo: pessoas[1] === undefined ? undefined : (segundo ?? chat.autorDesconhecido),
      ator: ator ?? chat.autorDesconhecido,
      alvo: alvo ?? chat.autorDesconhecido,
      canal: canal === undefined ? chat.sistema.canalDesconhecido : `#${canal.name}`,
    },
    pessoas.length,
  );
  return <>{frase}</>;
}
