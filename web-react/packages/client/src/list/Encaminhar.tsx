import { useMemo, useState, useSyncExternalStore } from "react";
import { Hash, LockSimple, MagnifyingGlass, X } from "@phosphor-icons/react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { toast } from "../components/ui/toastStore";
import { enviarMensagem } from "../sdk/adapter";
import { pode } from "../sdk/permissoes";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import {
  useCanaisDeTexto,
  useChannel,
  useConversas,
  useMembro,
  useMessage,
  useServidorAtivo,
} from "../store/hooks";
import { chaveDeMembro } from "../sdk/domain";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import css from "./Encaminhar.module.css";

/**
 * Quantos destinos de uma vez.
 *
 * O número é do design ("Escolha até 5 destinos"), e o teto existe pela razão
 * óbvia: encaminhar é o gesto mais barato que existe para espalhar a mesma
 * mensagem por um servidor inteiro. Um limite baixo não impede ninguém de
 * insistir; impede o gesto de um clique.
 */
const TETO_DE_DESTINOS = 5;

/**
 * Encaminhar uma mensagem para outros canais e conversas.
 *
 * ⚠ **O protocolo NÃO tem encaminhamento, e isto não é um `aindaNao`.** O
 * Stoat não conhece "mensagem encaminhada" como referência: não há campo que
 * diga de onde ela veio, e não há evento próprio. O que existe é enviar texto.
 *
 * Então é isso que este modal faz, e faz honestamente: manda uma CITAÇÃO em
 * markdown, com autor e canal de origem, mais o comentário de quem encaminhou.
 * Qualquer cliente Stoat lê o resultado, e a atribuição não se perde — ela
 * vira parte do texto em vez de metadado. A diferença para um encaminhamento
 * nativo é que a origem não é clicável, e ela está dita aqui para o dia em que
 * o protocolo ganhar o conceito: o que muda é o corpo desta função, não a
 * tela.
 *
 * Alternativa recusada: registrar o botão como pendência e deixar o modal
 * inteiro inerte. Um formulário completo — busca, chips, comentário — que não
 * faz nada é pior que o texto citado, porque quem o preenche descobre no fim.
 */
export function Encaminhar({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const messageId = alvo?.tipo === "encaminhar" ? alvo.messageId : "";
  const message = useMessage(messageId);

  const serverId = useServidorAtivo();
  const canais = useCanaisDeTexto(serverId);
  const conversas = useConversas();

  /* Autor e canal de origem — a atribuição que vai dentro da citação. */
  const autor = useMembro(chaveDeMembro(serverId, message?.authorId ?? ""));
  const origem = useChannel(message?.channelId ?? "");

  const [busca, setBusca] = useState("");
  const [escolhidos, setEscolhidos] = useState<readonly string[]>([]);
  const [comentario, setComentario] = useState("");

  /*
    Uma lista só, canais e conversas juntos.

    É como a caixa de busca funciona em qualquer lugar deste app: quem procura
    "Téo" não pensa "isso é uma conversa direta, então é a outra aba". Separar
    por tipo aqui obrigaria a pessoa a saber a resposta antes de perguntar.
  */
  const destinos = useMemo(
    () => [...canais, ...conversas],
    [canais, conversas],
  );

  function alternar(id: string) {
    setEscolhidos((atual) =>
      atual.includes(id)
        ? atual.filter((x) => x !== id)
        : atual.length >= TETO_DE_DESTINOS
          ? atual
          : [...atual, id],
    );
  }

  function confirmar() {
    if (!message || escolhidos.length === 0) return;

    /*
      A citação, montada uma vez e mandada igual para todos.

      `>` em cada LINHA, porque a citação do markdown é por linha: uma mensagem
      de três parágrafos com um `>` só no começo viraria uma citação de uma
      linha e dois parágrafos soltos.

      A atribuição vai na primeira linha da própria citação — é o que substitui
      o metadado que o protocolo não tem. Sem ela o texto chega ao outro canal
      parecendo escrito por quem encaminhou.
    */
    const quem = autor?.displayName ?? "alguém";
    const onde = origem ? ` em #${origem.name}` : "";
    const corpo = [`**${quem}**${onde}`, ...message.content.split("\n")]
      .map((linha) => `> ${linha}`)
      .join("\n");
    const texto = comentario.trim() ? `${comentario.trim()}\n\n${corpo}` : corpo;

    for (const destino of escolhidos) enviarMensagem(destino, texto);

    toast({
      tipo: "info",
      titulo:
        escolhidos.length === 1
          ? "Mensagem encaminhada"
          : `Encaminhada para ${escolhidos.length} destinos`,
    });
    aoFechar();
  }

  const filtro = busca.trim().toLowerCase();

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Encaminhar"
        descricao={`Escolha até ${TETO_DE_DESTINOS} destinos`}
        className={css.painel}
      >
        {/*
          A prévia do que vai ser mandado.

          Barra de acento à esquerda, como o design — e é a mesma linguagem da
          prévia de resposta no composer, de propósito: as duas respondem "esta
          mensagem, esta aqui" antes de a pessoa confirmar qualquer coisa.
        */}
        {message ? (
          <div className={css.previa}>
            <div className={css.previaCabecalho}>
              {message.authorId ? (
                <NomeDoAutor userId={message.authorId} denso />
              ) : (
                <span>desconhecido</span>
              )}
              {origem ? (
                <span className={css.previaCanal}>#{origem.name}</span>
              ) : null}
            </div>
            <p className={css.previaCorpo}>{message.content}</p>
          </div>
        ) : null}

        <label className={css.busca}>
          <MagnifyingGlass aria-hidden />
          <input
            className={css.buscaCampo}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar canal ou pessoa"
            aria-label="Buscar canal ou pessoa"
          />
        </label>

        {escolhidos.length > 0 ? (
          <div className={css.chips}>
            {escolhidos.map((id) => (
              <Chip key={id} channelId={id} aoRemover={() => alternar(id)} />
            ))}
          </div>
        ) : null}

        {/*
          `tabIndex={0}` no container rolável.

          Rolável sem foco é inoperável por teclado — a lista pode ter dezenas
          de canais e a barra de rolagem só responde ao ponteiro. Foi um dos
          achados da auditoria de acessibilidade, e vale para toda caixa com
          `overflow` deste projeto.
        */}
        <div className={css.lista} tabIndex={0}>
          {destinos.map((id) => (
            <LinhaDeDestino
              key={id}
              channelId={id}
              filtro={filtro}
              escolhido={escolhidos.includes(id)}
              cheio={escolhidos.length >= TETO_DE_DESTINOS}
              aoAlternar={() => alternar(id)}
            />
          ))}
        </div>

        <input
          className={css.comentario}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Comentário opcional…"
          aria-label="Comentário opcional"
        />

        <div className={css.rodape}>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            disabled={escolhidos.length === 0 || !message}
            onClick={confirmar}
          >
            {escolhidos.length > 1
              ? `Encaminhar para ${escolhidos.length}`
              : "Encaminhar"}
          </Botao>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Chip({
  channelId,
  aoRemover,
}: {
  channelId: string;
  aoRemover: () => void;
}) {
  const canal = useChannel(channelId);
  const nome = canal ? rotuloDe(canal.tipo, canal.name) : channelId;

  return (
    <span className={css.chip}>
      {nome}
      <button
        type="button"
        className={css.chipRemover}
        aria-label={`Tirar ${nome} dos destinos`}
        onClick={aoRemover}
      >
        <X aria-hidden />
      </button>
    </span>
  );
}

/**
 * Uma linha da lista de destinos.
 *
 * Componente próprio porque cada uma assina o PRÓPRIO canal — é o mesmo motivo
 * de `NomeDoAutor` e `AvatarDoAutor` existirem: a alternativa faria o modal
 * inteiro re-renderizar quando qualquer canal da lista mudasse de nome.
 *
 * O filtro é aplicado aqui e não na lista de IDs de propósito: o nome mora no
 * snapshot do canal, e filtrar lá fora obrigaria o pai a lê-los todos — que é
 * exatamente a subscrição que este componente existe para evitar.
 */
function LinhaDeDestino({
  channelId,
  filtro,
  escolhido,
  cheio,
  aoAlternar,
}: {
  channelId: string;
  filtro: string;
  escolhido: boolean;
  cheio: boolean;
  aoAlternar: () => void;
}) {
  const canal = useChannel(channelId);
  if (!canal) return null;
  if (filtro && !canal.name.toLowerCase().includes(filtro)) return null;

  /*
    Sem permissão a linha FICA, esmaecida e com o motivo escrito.

    É instrução do design, e ela contraria a regra do projeto ("não renderizar
    ação que a pessoa não pode executar") pelo mesmo critério que o menu do
    usuário usa: aqui o item é um DESTINO, não uma ação, e sumir com ele faria
    a pessoa procurar por um canal que ela vê na coluna ao lado.
  */
  const permitido = pode(channelId, "enviar");
  const bloqueado = !permitido || (cheio && !escolhido);

  return (
    <button
      type="button"
      className={css.destino}
      role="checkbox"
      aria-checked={escolhido}
      disabled={bloqueado}
      onClick={aoAlternar}
    >
      {canal.tipo === "texto" || canal.tipo === "voz" ? (
        permitido ? (
          <Hash aria-hidden className={css.destinoGlifo} />
        ) : (
          <LockSimple aria-hidden className={css.destinoGlifo} />
        )
      ) : (
        <Avatar id={channelId} sigla={sigla(canal.name)} tamanho="xs" />
      )}
      <span className={css.destinoNome}>{canal.name}</span>
      {permitido ? (
        <span className={css.caixa} data-marcada={escolhido || undefined} />
      ) : (
        <span className={css.semPermissao}>sem permissão</span>
      )}
    </button>
  );
}

function rotuloDe(tipo: string, nome: string): string {
  return tipo === "texto" || tipo === "voz" ? `#${nome}` : nome;
}

/*
  A inicial da conversa, calculada AQUI.

  `ChannelSnapshot` não tem `sigla` — e não deve ter: sigla é derivação de
  escrita para superfícies que rolam milhares de linhas, e esta lista tem
  dezenas. Pagar o campo no snapshot de todo canal do app para desenhar um
  avatar num modal seria o custo no lugar errado.
*/
function sigla(nome: string): string {
  return [...nome.trim()][0]?.toUpperCase() ?? "?";
}
