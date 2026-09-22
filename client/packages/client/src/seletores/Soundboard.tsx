import { useState, useSyncExternalStore } from "react";

import { Deslizante } from "../components/ui/Deslizante";
import { LockSimple } from "../components/ui/icones";
import { TECLAS_DO_SOUNDBOARD } from "../expressoes/atalhos";
import { useSonsDoServidor, useTocando, useVolumeDoPainel } from "../expressoes/hooks";
import { podeUsarSoundboard, tocarNaSala } from "../sdk/efeitosSonoros";
import type { EfeitoSonoro } from "../sdk/expressoes";
import { assinarChamada, lerChamada } from "../store/chamada";
import { useChannel, useServer } from "../store/hooks";
import { definirVolumeDoPainel } from "../store/soundboard";
import { CascaDeSeletor, CELULA_DA_GRADE } from "./CascaDeSeletor";
import css from "./Seletores.module.css";

/**
 * O painel de sons.
 *
 * ⚠ **Era casca com cinco sons de exemplo — "soundboard não existe no
 * protocolo".** O fork do `delta` tem os sons do servidor e o evento que leva
 * um toque à sala (ver `sdk/efeitosSonoros.ts`). O painel agora mostra os sons
 * do servidor DA CHAMADA — e não do canal aberto: é na sala que o som toca, e
 * quem está numa chamada de outro servidor lendo este canal espera os sons de
 * lá.
 *
 * A regra de contexto do design continua: fora de uma chamada os sons ficam
 * esmaecidos e o selo diz "FORA DE VOZ" — somem não, porque sumir faria parecer
 * que o servidor não tem som nenhum.
 */
export function Soundboard() {
  const [busca, setBusca] = useState("");
  const volume = useVolumeDoPainel();
  const channelId = useSyncExternalStore(assinarChamada, () =>
    lerChamada().estado === "dentro" ? lerChamada().channelId : "",
  );
  const canal = useChannel(channelId);
  const servidor = useServer(canal?.serverId ?? "");

  return (
    <CascaDeSeletor
      estreita
      rotulo="Painel de sons"
      cabecalho={
        <>
          <div className={css.cabecalhoDeSons}>
            <span className={css.tituloDeSons}>Painel de sons</span>
            <span className={css.previaOrigem}>
              {canal && servidor ? `${canal.name} · ${servidor.name}` : "Entre numa sala para tocar"}
            </span>
          </div>
          {channelId ? (
            <span className={css.selo}>EM VOZ</span>
          ) : (
            <span className={css.seloApagado}>FORA DE VOZ</span>
          )}
        </>
      }
      busca={{ valor: busca, aoMudar: setBusca, placeholder: "Buscar som" }}
      rodape={
        <div className={css.volume}>
          <div className={css.volumeCabecalho}>
            <span>Volume do painel</span>
            <span className={css.volumeValor}>{volume}%</span>
          </div>
          <Deslizante
            id="vx-volume-soundboard"
            rotulo="Volume do painel"
            texto={`${volume} por cento`}
            valor={volume}
            min={0}
            max={100}
            passo={5}
            aoMudar={definirVolumeDoPainel}
          />
          <p className={css.volumeDica}>
            Teclas 1–9 disparam os sons sem abrir o painel.
          </p>
        </div>
      }
    >
      {servidor && channelId ? (
        <GradeDeSons serverId={servidor.id} channelId={channelId} busca={busca} />
      ) : (
        <p className={css.bloqueio}>Os sons tocam para a sala em que você está.</p>
      )}
    </CascaDeSeletor>
  );
}

function GradeDeSons({
  serverId,
  channelId,
  busca,
}: {
  serverId: string;
  channelId: string;
  busca: string;
}) {
  const lista = useSonsDoServidor(serverId);
  if (lista.estado === "carregando") return <p className={css.bloqueio}>Carregando…</p>;
  if (lista.estado === "falhou") {
    return <p className={css.bloqueio}>Não deu para carregar os sons deste servidor.</p>;
  }
  if (lista.itens.length === 0) {
    return <p className={css.bloqueio}>Este servidor ainda não tem efeitos sonoros.</p>;
  }

  const pode = podeUsarSoundboard(channelId);
  const filtro = busca.trim().toLowerCase();
  const visiveis = lista.itens
    .map((som, i) => ({ som, tecla: i < TECLAS_DO_SOUNDBOARD ? String(i + 1) : undefined }))
    .filter(({ som }) => filtro === "" || som.nome.toLowerCase().includes(filtro));

  if (visiveis.length === 0) return <p className={css.bloqueio}>Nenhum som com esse nome.</p>;

  return (
    <div className={css.gradeDeSons}>
      {visiveis.map(({ som, tecla }) => (
        <LadrilhoDeSom key={som.id} som={som} tecla={tecla} channelId={channelId} pode={pode} />
      ))}
    </div>
  );
}

function LadrilhoDeSom({
  som,
  tecla,
  channelId,
  pode,
}: {
  som: EfeitoSonoro;
  tecla: string | undefined;
  channelId: string;
  pode: boolean;
}) {
  const tocando = useTocando(som.id);
  return (
    <button
      type="button"
      className={css.som}
      {...CELULA_DA_GRADE}
      data-tocando={tocando || undefined}
      /*
        Sem permissão o ladrilho fica ESMAECIDO e com o motivo — regra do
        design para os seletores. `aria-disabled` e não `disabled`: o `title`
        precisa do ponteiro, e botão desabilitado não recebe eventos.
      */
      aria-disabled={!pode || undefined}
      title={pode ? undefined : 'Falta a permissão "usar soundboard"'}
      onClick={() => {
        if (pode) tocarNaSala(channelId, som);
      }}
    >
      <span className={css.somGlifo} aria-hidden>
        {pode ? (som.emoji ?? "🔊") : <LockSimple aria-hidden />}
      </span>
      <span className={css.somNome}>{som.nome}</span>
      <span className={tocando ? css.somTocando : css.somTecla}>
        {!pode ? "sem perm." : tocando ? "tocando" : (tecla ?? "")}
      </span>
    </button>
  );
}
