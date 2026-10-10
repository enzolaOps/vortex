import { ligarChamadasRecebidas } from "nucleo/notificacao/chamadas";
import { atenderChamada, recusarChamada } from "nucleo/sdk/chamada";
import { useChannel, usePessoa } from "nucleo/store/hooks";
import { useEffect, useRef } from "react";

import { casa } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import { Telefone, TelefoneDesligando } from "../../ui/icones";
import css from "./ChamadaRecebida.module.css";
import { useChamadaRecebida } from "./hooks";

/** Campo de texto em foco: ali Esc e Enter são da pessoa digitando, não da chamada. */
function emCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  return alvo.isContentEditable || alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT";
}

function Aviso({ channelId, quemLigou }: { channelId: string; quemLigou: string }) {
  const pessoa = usePessoa(quemLigou);
  const canal = useChannel(channelId);
  const atender = useRef<HTMLButtonElement | null>(null);
  const nome = pessoa?.displayName ?? casa.grupo.voce;
  const grupo = canal?.tipo === "grupo" ? canal.name : undefined;

  // Quem recebe a chamada vê o botão certo já focado: Enter atende, Tab chega em recusar.
  useEffect(() => {
    atender.current?.focus();
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void atenderChamada({ comCamera: true });
      } else if (e.key === "Escape" && !emCampoDeTexto(e.target) && document.querySelector("[role='dialog']") === null) {
        e.preventDefault();
        recusarChamada();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  return (
    <div className={css.camada}>
      <div className={css.cartao} role="alertdialog" aria-label={casa.chamada.rotulo(nome)}>
        <div className={css.rosto}>
          <span className={css.anel} aria-hidden="true" />
          <span className={css.anel} aria-hidden="true" />
          <Avatar nome={nome} id={quemLigou} tamanho={120} status={pessoa?.status} />
        </div>
        <div className={css.textos}>
          <h2 className={css.titulo}>{casa.chamada.rotulo(nome)}</h2>
          <span className={css.subtitulo}>
            {casa.chamada.subtitulo}
            {grupo !== undefined && ` · ${casa.chamada.noGrupo(grupo)}`}
          </span>
        </div>
        <div className={css.botoes}>
          <div className={css.opcao}>
            <button
              type="button"
              className={`${css.redondo} ${css.recusar}`}
              aria-label={casa.chamada.recusarDe(nome)}
              onClick={() => {
                recusarChamada();
              }}
            >
              <TelefoneDesligando tamanho={20} />
            </button>
            <span className={css.legenda}>
              {casa.chamada.recusar}
              <kbd className={css.tecla}>{casa.chamada.sinalTeclaRecusar}</kbd>
            </span>
          </div>
          <div className={css.opcao}>
            <button
              ref={atender}
              type="button"
              className={`${css.redondo} ${css.atender}`}
              aria-label={casa.chamada.atenderDe(nome)}
              onClick={() => {
                void atenderChamada({ comCamera: true });
              }}
            >
              <Telefone tamanho={20} />
            </button>
            <span className={css.legenda}>
              {casa.chamada.atender}
              <kbd className={css.tecla}>{casa.chamada.sinalTeclaAtender}</kbd>
            </span>
          </div>
        </div>
        <Botao
          variante="fantasma"
          icone={<Telefone />}
          onClick={() => {
            void atenderChamada({ comCamera: false });
          }}
        >
          {casa.chamada.soAudio}
        </Botao>
      </div>
    </div>
  );
}

/**
 * A chamada que está tocando. Liga o relógio do toque (som que repete, expira
 * sozinho) uma vez por sessão e, quando a matriz de avisos permite a tela, mostra
 * quem está ligando com as duas saídas: atender (Ctrl+Enter) e recusar (Esc).
 *
 * Não prende o foco nem bloqueia o app: uma ligação não pode trancar quem está no
 * meio de outra coisa. Por isso o véu não captura Esc dentro de um diálogo aberto.
 */
export function ChamadaRecebida() {
  useEffect(() => ligarChamadasRecebidas(), []);
  const tocando = useChamadaRecebida();
  if (!tocando?.visivel) return null;
  return <Aviso key={tocando.channelId} channelId={tocando.channelId} quemLigou={tocando.quemLigou} />;
}
