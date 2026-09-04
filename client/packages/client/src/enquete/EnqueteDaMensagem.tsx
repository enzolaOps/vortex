import { Trophy } from "../components/ui/icones";

import { plural } from "../lib/plural";
import { republicarEnquete } from "../sdk/adapter";
import {
  porcentagem,
  totalDeVotos,
  votar,
  type Enquete,
  type OpcaoDeEnquete,
} from "../store/enquetes";
import css from "./Enquete.module.css";

/**
 * A enquete dentro da linha de mensagem — aberta e encerrada.
 *
 * ⚠ **A barra de resultado é o FUNDO da própria opção, nunca um irmão.** É
 * instrução do design, e a razão é a âncora: *"votar não muda a altura da
 * linha — a timeline não salta"*. Uma barra empilhada abaixo do rótulo
 * cresceria a linha no momento do voto, e uma linha que cresce acima da âncora
 * empurra o que está sendo lido.
 *
 * A mesma peça serve aos dois estados porque eles diferem em CINCO detalhes —
 * o selo, o troféu na vencedora, a cor da barra, o cursor e o rodapé — e não
 * em estrutura. Dois componentes divergiriam no primeiro ajuste de espaço.
 */
export function EnqueteDaMensagem({
  messageId,
  enquete,
}: {
  messageId: string;
  enquete: Enquete;
}) {
  const encerrada = enquete.fechaEm === undefined;
  const total = totalDeVotos(enquete);
  /*
    Esconder a contagem só vale enquanto a enquete está ABERTA e você não
    votou. Depois de fechada não há mais o que enviesar, e depois de votar o
    seu voto já está dado — é exatamente o momento em que a informação deixa
    de custar e passa a servir.
  */
  const escondido =
    enquete.resultadoNoFim && !encerrada && enquete.meuVoto === undefined;

  /* A vencedora ganha o troféu. Empate: a primeira, que é a ordem do autor. */
  const vencedora = encerrada
    ? enquete.opcoes.reduce((a, b) => (b.votos > a.votos ? b : a))
    : undefined;

  return (
    <div className={css.caixa}>
      <div className={css.tipo}>
        {encerrada ? (
          <>
            <span>Enquete encerrada</span>
            <span className={css.seloResultado}>RESULTADO</span>
          </>
        ) : (
          <span>
            Enquete ·{" "}
            {enquete.maximo > 1 ? "múltiplas respostas" : "uma resposta"}
          </span>
        )}
      </div>

      <p className={css.pergunta}>{enquete.pergunta}</p>

      {/*
        `role="group"` e não `radiogroup`: o design permite múltiplas respostas,
        e o mesmo componente serve aos dois casos. Um `radiogroup` mentiria
        sobre a exclusividade metade das vezes; o estado real de cada opção
        está no `aria-pressed` do botão dela.
      */}
      <div role="group" aria-label={enquete.pergunta}>
        {enquete.opcoes.map((o) => (
          <Opcao
            key={o.id}
            opcao={o}
            enquete={enquete}
            escondido={escondido}
            encerrada={encerrada}
            venceu={vencedora?.id === o.id}
            aoVotar={() => {
              votar(messageId, o.id);
              republicarEnquete(messageId);
            }}
          />
        ))}
      </div>

      <div className={css.rodape}>
        <span>
          {escondido
            ? "Resultado só no fim"
            : plural(total, "voto", "votos")}
        </span>
        <span className={css.rodapeDireita}>
          {encerrada ? null : <span className={css.link}>Ver votos</span>}
          <span>{encerrada ? "encerrada" : prazo(enquete.fechaEm)}</span>
        </span>
      </div>
    </div>
  );
}

function Opcao({
  opcao,
  enquete,
  escondido,
  encerrada,
  venceu,
  aoVotar,
}: {
  opcao: OpcaoDeEnquete;
  enquete: Enquete;
  escondido: boolean;
  encerrada: boolean;
  venceu: boolean;
  aoVotar: () => void;
}) {
  const pct = porcentagem(enquete, opcao);
  const minha = enquete.meuVoto === opcao.id;

  return (
    <button
      type="button"
      className={css.opcao}
      data-minha={minha || undefined}
      data-venceu={venceu || undefined}
      aria-pressed={minha}
      disabled={encerrada}
      onClick={aoVotar}
    >
      {/*
        A barra: `absolute inset-0` com largura em porcentagem, ATRÁS do
        conteúdo. É o que faz votar não mudar a altura — ver o comentário do
        componente.
      */}
      {escondido ? null : (
        <span className={css.barra} style={{ inlineSize: `${pct}%` }} aria-hidden />
      )}
      <span className={css.opcaoConteudo}>
        <span className={css.opcaoMarca} aria-hidden>
          {venceu ? <Trophy /> : opcao.marca}
        </span>
        <span className={css.opcaoTexto}>{opcao.texto}</span>
        {escondido ? null : (
          <span className={css.opcaoPct}>{pct}%</span>
        )}
      </span>
    </button>
  );
}

/**
 * "fecha em 22 h" — a partir do instante em ms.
 *
 * Arredonda para BAIXO na hora e para cima no minuto: "fecha em 1 h" quando
 * restam 59 minutos é uma promessa que o relógio quebra; "fecha em 59 min" é
 * verdade o tempo todo.
 */
function prazo(fechaEm: number | undefined): string {
  if (fechaEm === undefined) return "";
  const restante = fechaEm - Date.now();
  if (restante <= 0) return "fechando";
  const horas = Math.floor(restante / 3_600_000);
  if (horas >= 24) return `fecha em ${Math.floor(horas / 24)} d`;
  if (horas >= 1) return `fecha em ${horas} h`;
  return `fecha em ${Math.ceil(restante / 60_000)} min`;
}
