import { Trophy } from "../components/ui/icones";

import { republicarEnquete } from "../sdk/adapter";
import { votarNaEnquete } from "../sdk/enquetes";
import { administrar } from "../store/administracao";
import {
  estaEncerrada,
  porcentagem,
  rodapeDaEnquete,
  totalDeVotos,
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
  channelId,
  enquete,
}: {
  messageId: string;
  channelId: string;
  enquete: Enquete;
}) {
  const encerrada = encerradaAgora(enquete);
  const total = totalDeVotos(enquete);
  /*
    Esconder a contagem só vale enquanto a enquete está ABERTA e você não
    votou. Depois de fechada não há mais o que enviesar, e depois de votar o
    seu voto já está dado — é exatamente o momento em que a informação deixa
    de custar e passa a servir.
  */
  const escondido =
    enquete.resultadoNoFim && !encerrada && enquete.meusVotos.length === 0;

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
            aoVotar={() =>
              void votarNaEnquete(channelId, messageId, o.id, () =>
                republicarEnquete(messageId),
              )
            }
          />
        ))}
      </div>

      <div className={css.rodape}>
        {/*
          ⚠ **A contagem TOTAL aparece mesmo com o resultado escondido**, e a
          versão anterior a trocava por "Resultado só no fim". O design escreve
          os três desfechos da mesma linha — `18 votos · você votou`,
          `18 votos · resultado no fim`, `18 votos` —, e o total é o que ele
          mantém nos três: quantas pessoas responderam não enviesa ninguém,
          porque não diz em QUÊ. O que "resultado no fim" esconde é a
          porcentagem por resposta, e essa continua escondida.
        */}
        <span>
          {rodapeDaEnquete(total, escondido, enquete.meusVotos.length > 0)}
        </span>
        <span className={css.rodapeDireita}>
          {/*
            "Ver votos" só existe onde a contagem já está visível.

            Encerrada ele sai porque o design não o desenha no estado final —
            ali a linha é "25 votos · encerrada ontem às 20:00". E com o
            resultado escondido ele sairia de qualquer forma: a lista de quem
            votou em quê diz mais do que a porcentagem que o modo existe para
            esconder.
          */}
          {encerrada || escondido ? null : (
            <button
              type="button"
              className={css.link}
              onClick={() => administrar({ tipo: "verVotos", messageId })}
            >
              Ver votos
            </button>
          )}
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
  const minha = enquete.meusVotos.includes(opcao.id);

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
 * Encerrada agora — pelo autor ou pelo relógio.
 *
 * Função de módulo e não expressão no render: o snapshot da enquete é
 * cacheado e não sabe que o tempo andou, então a pergunta tem de olhar o
 * relógio na hora — do mesmo jeito que `prazo` já olha.
 */
function encerradaAgora(e: Enquete): boolean {
  return estaEncerrada(e, Date.now());
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
