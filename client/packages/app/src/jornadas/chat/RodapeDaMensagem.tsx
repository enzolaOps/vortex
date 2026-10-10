import { alternarReacao, descartarPendente, reenviar } from "nucleo/sdk/adapter";
import { urlDeEmoji } from "nucleo/sdk/anexos";
import type { MessageSnapshot, ReacaoSnapshot } from "nucleo/sdk/domain";
import { useConexao } from "nucleo/store/hooks";
import { cancelarUpload } from "nucleo/store/uploads";

import { chat } from "../../textos";
import { Alerta, Fixar } from "../../ui/icones";
import { useProgressoDeUpload } from "./hooks";
import css from "./Linha.module.css";

/** ULID de 26 caracteres = emoji personalizado do servidor; o resto é Unicode. */
const EMOJI_PERSONALIZADO = /^[0-9A-Z]{26}$/;

function Reacao({ id, r, podeReagir }: { id: string; r: ReacaoSnapshot; podeReagir: boolean }) {
  const url = EMOJI_PERSONALIZADO.test(r.emoji) ? urlDeEmoji(r.emoji) : undefined;
  return (
    <button
      type="button"
      className={css.reacao}
      aria-pressed={r.minha}
      aria-label={`${chat.reagirRotulo} ${url === undefined ? r.emoji : ""} ${r.total}`.replace(/\s+/g, " ")}
      disabled={!podeReagir}
      onClick={() => {
        alternarReacao(id, r.emoji);
      }}
    >
      {url === undefined ? (
        <span className={css.reacaoEmoji} aria-hidden="true">
          {r.emoji}
        </span>
      ) : (
        <img className={css.reacaoImagem} src={url} alt="" />
      )}
      {r.total}
    </button>
  );
}

function ProgressoDoEnvio({ id }: { id: string }) {
  const progresso = useProgressoDeUpload(id);
  const fracao = progresso?.fracao ?? 0;
  const porcento = Math.round(fracao * 100);
  return (
    <span className={css.estado} role="status">
      {chat.enviandoArquivo(porcento)}
      {progresso?.taxaTexto !== undefined && <span>{progresso.taxaTexto}</span>}
      <span className={css.progresso} aria-hidden="true">
        <i style={{ transform: `scaleX(${fracao})` }} />
      </span>
      <button
        type="button"
        className={css.acaoDoEstado}
        onClick={() => {
          cancelarUpload(id);
        }}
      >
        {chat.cancelarEnvio}
      </button>
    </span>
  );
}

/** Só as pendentes montam isto, então a assinatura da conexão não pesa na lista. */
function EnvioPendente() {
  const conectado = useConexao() === "conectado";
  return (
    <span className={css.estado} role="status">
      {conectado ? chat.enviando : chat.naFilaSemConexao}
    </span>
  );
}

function EnvioFalhou({ id }: { id: string }) {
  /* Só as falhadas montam isto: a mesma causa do aviso e do rodapé do campo. */
  const conectado = useConexao() === "conectado";
  return (
    <span className={`${css.estado} ${css.estadoFalha}`} role="alert">
      <Alerta tamanho={14} />
      {`${chat.naoEnviada} · ${chat.causaDaFalha(conectado)}`}
      <button
        type="button"
        className={css.acaoDoEstado}
        onClick={() => {
          reenviar(id);
        }}
      >
        {chat.reenviar}
      </button>
      <button
        type="button"
        className={css.acaoDoEstado}
        onClick={() => {
          descartarPendente(id);
        }}
      >
        {chat.descartar}
      </button>
    </span>
  );
}

/** Tem algo para desenhar sob o corpo? Evita um `div` vazio em toda linha comum. */
export function temRodape(m: MessageSnapshot): boolean {
  return m.reactions.length > 0 || m.editedAt !== undefined || m.fixada || m.sendState !== "sent";
}

/** Reações, "editada", "fixada" e o estado de envio, sob o corpo da mensagem. */
export function RodapeDaMensagem({ m, podeReagir }: { m: MessageSnapshot; podeReagir: boolean }) {
  return (
    <div className={css.rodape}>
      {m.sendState === "subindo" && <ProgressoDoEnvio id={m.id} />}
      {m.sendState === "pending" && <EnvioPendente />}
      {m.sendState === "failed" && <EnvioFalhou id={m.id} />}
      {m.reactions.map((r) => (
        <Reacao key={r.emoji} id={m.id} r={r} podeReagir={podeReagir && m.sendState === "sent"} />
      ))}
      {m.fixada && (
        <span className={css.marca}>
          <Fixar tamanho={14} />
          {chat.fixada}
        </span>
      )}
      {m.editedAt !== undefined && <span>({chat.editada})</span>}
    </div>
  );
}
