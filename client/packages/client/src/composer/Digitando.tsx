import { chaveDeMembro } from "../sdk/domain";
import { useMembro, useServidorAtivo, useTyping } from "../store/hooks";
import css from "./Composer.module.css";

/**
 * Quem está digitando.
 *
 * É o primeiro consumo do store efêmero na UI, e ele existe separado do store
 * de mensagens exatamente por isto: num canal movimentado esse texto muda
 * várias vezes por segundo, e cada mudança acorda ESTE parágrafo e mais nada.
 *
 * Sem `aria-live` de propósito. Anunciar "fulano está digitando" a cada
 * piscada transformaria um leitor de tela em ruído contínuo — e a informação
 * não é acionável: ela some sozinha.
 *
 * PENDÊNCIA: mostra contagem porque não existe store de usuários; o que
 * chega são IDs. A member list traz esse store, e aí vira nome. A linha de
 * mensagem tem hoje exatamente a mesma lacuna.
 */
export function Digitando({ channelId }: { channelId: string }) {
  const quem = useTyping(channelId);
  const serverId = useServidorAtivo();

  /*
    ⚠ **Os NOMES, e antes era contagem — a pendência que envelheceu.**

    O comentário acima dizia "mostra contagem porque não existe store de
    usuários; a member list traz esse store". Ela trouxe, há várias etapas, e
    ninguém voltou aqui: "alguém está digitando…" continuou no ar depois de a
    informação estar disponível.

    Até dois nomes por extenso, como o design ("**Téo** está digitando…").
    De três em diante volta a ser contagem — "Ana, Bruno, Carla, Diego e mais
    quatro" é mais difícil de ler do que o fato que ela carrega.
  */
  const nomes = quem.slice(0, 2).map((id) => (
    <NomeDeQuemDigita key={id} serverId={serverId} userId={id} />
  ));

  return (
    <p className={css.digitando}>
      {quem.length === 0 ? null : (
        <>
          {/*
            Os três pontos que pulam.

            `aria-hidden` porque o texto ao lado já diz tudo: um leitor de tela
            anunciando "três pontos" seria ruído, e a animação não carrega
            informação que o texto não carregue.
          */}
          <span className={css.pontos} aria-hidden>
            <span />
            <span />
            <span />
          </span>
          {quem.length === 1 ? (
            <span>{nomes[0]} está digitando…</span>
          ) : quem.length === 2 ? (
            <span>
              {nomes[0]} e {nomes[1]} estão digitando…
            </span>
          ) : (
            <span>{quem.length} pessoas estão digitando…</span>
          )}
        </>
      )}
    </p>
  );
}

/**
 * O nome de quem digita, em destaque.
 *
 * Componente próprio pela razão de sempre: ele assina o MEMBRO, e trocar de
 * apelido acorda este `<span>` — não o composer, que contém a `textarea` onde
 * alguém está escrevendo.
 */
function NomeDeQuemDigita({
  serverId,
  userId,
}: {
  serverId: string;
  userId: string;
}) {
  const membro = useMembro(chaveDeMembro(serverId, userId));
  return <strong className={css.quemDigita}>{membro?.displayName ?? "alguém"}</strong>;
}
