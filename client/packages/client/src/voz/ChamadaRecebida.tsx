import {
  Microphone,
  MicrophoneSlash,
  Phone,
  VideoCamera,
  X,
} from "../components/ui/icones";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { rotuloDeAmigosEmComum } from "../lib/plural";
import { useEmComum } from "../membros/EmComum";
import { atenderChamada, recusarChamada } from "../sdk/chamada";
import { assinarChamada, lerChamada } from "../store/chamada";
import {
  assinarChamadaRecebida,
  lerChamadaRecebida,
  type ChamadaRecebida as Toque,
} from "../store/chamadaRecebida";
import { useChannel, usePessoa } from "../store/hooks";
import css from "./ChamadaRecebida.module.css";

/**
 * Alguém está ligando — o aviso, nas duas formas do design.
 *
 * ⚠ **Toast e tela cheia são a MESMA chamada, e a tela cheia nasce do toast.**
 * O design desenha as duas lado a lado sem dizer quando cada uma vale; a
 * referência diz que a tela cheia é "do mobile e do popout dedicado", e nenhum
 * dos dois existe nesta plataforma. O que sobra é o que as duas oferecem de
 * diferente: a tela cheia tem as escolhas de entrar SEM microfone e COM câmera
 * e o recado ao recusar. Por isso o corpo do toast abre a tela cheia, em vez de
 * uma das duas formas ficar construída e inalcançável.
 *
 * ⚠ **Não é um toast do Radix.** Aquele expira, empilha com os outros e some
 * por gesto de arraste; este fica até alguém decidir ou quem ligou desistir,
 * e não pode ser dispensado por engano junto com um "mensagem copiada".
 *
 * Assina o store do toque, e da chamada em que você está só o BOOLEANO de
 * mudo, na tela cheia — ela mostra com que microfone você vai entrar. Assinar a
 * chamada inteira acordaria o aviso a cada câmera ou participante da SUA sala,
 * que é a lei nº 1 ao contrário.
 */
export function ChamadaRecebida() {
  const toque = useSyncExternalStore(assinarChamadaRecebida, lerChamadaRecebida);
  /*
    Expandida PARA QUAL chamada. Guardar a identidade do toque em vez de um
    booleano é o que faz uma ligação nova nascer como toast sem um efeito
    zerando o estado — o lint do projeto reprova `setState` em cascata dentro
    de efeito, e aqui ele nem é necessário.

    ⚠ **Canal E instante, e não só o canal.** A primeira versão guardava o
    canal: a mesma pessoa ligando de novo na mesma DM abria direto em tela
    cheia, porque o componente continua montado entre as duas ligações. Visto
    no arnês ligando duas vezes seguidas.
  */
  const [cheiaPara, setCheiaPara] = useState<string | undefined>(undefined);

  useAtalhosDoToque(toque);

  if (!toque || !toque.visivel) return null;

  const id = `${toque.channelId}:${String(toque.desde)}`;
  return cheiaPara === id ? (
    <TelaCheia key={id} toque={toque} />
  ) : (
    <Aviso toque={toque} aoExpandir={() => setCheiaPara(id)} />
  );
}

/**
 * Atender ⌘↵ / Ctrl+↵, recusar Esc — os atalhos do design.
 *
 * ⚠ **Captura, e com `stopPropagation`.** Esc fecha modal, marca canal como
 * lido e sai da edição; Ctrl+Enter envia no composer. Enquanto uma chamada
 * toca, a tecla é dela: responder a quem está ligando é a coisa mais urgente
 * na tela, e deixar o Esc descer marcaria o canal como lido E recusaria.
 *
 * Só com o aviso VISÍVEL: uma chamada tocando só por som (a matriz desligou o
 * toast) não pode sequestrar o Esc de quem nem sabe que há o que recusar.
 */
function useAtalhosDoToque(toque: Toque | undefined) {
  const ativo = toque?.visivel === true;
  useEffect(() => {
    if (!ativo) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        void atenderChamada();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        recusarChamada();
      }
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [ativo]);
}

/* ============================================================
   Toast
   ============================================================ */

function Aviso({ toque, aoExpandir }: { toque: Toque; aoExpandir: () => void }) {
  const pessoa = usePessoa(toque.quemLigou);
  const canal = useChannel(toque.channelId);
  const nome = pessoa?.displayName ?? "Alguém";

  return (
    <div className={css.toast} role="alert" aria-live="assertive">
      <button
        type="button"
        className={css.corpo}
        onClick={aoExpandir}
        aria-label={`Ver chamada de ${nome}`}
      >
        <Anel userId={toque.quemLigou} tamanho="toast" />
        <span className={css.texto}>
          <span className={css.nome}>{nome}</span>
          <span className={css.sub}>
            {canal?.tipo === "grupo" ? `chamada em ${canal.name}…` : "chamada de voz…"}
          </span>
        </span>
      </button>

      <div className={css.botoes}>
        <button
          type="button"
          className={css.recusarRedondo}
          aria-label="Recusar chamada"
          title="Recusar · esc"
          onClick={() => recusarChamada()}
        >
          <X aria-hidden />
        </button>
        <button
          type="button"
          className={css.atenderRedondo}
          aria-label="Atender chamada"
          title="Atender · ⌘↵"
          onClick={() => void atenderChamada()}
        >
          <Phone aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Tela cheia
   ============================================================ */

/** O recado do design, palavra por palavra. */
const RECADO = "não posso agora";

function TelaCheia({ toque }: { toque: Toque }) {
  const pessoa = usePessoa(toque.quemLigou);
  const canal = useChannel(toque.channelId);
  const nome = pessoa?.displayName ?? "Alguém";
  /*
    As duas escolhas nascem do que VALE hoje: microfone da preferência de mudo
    (que sobrevive entre chamadas), câmera desligada — ninguém entra numa
    chamada com a câmera aberta sem ter pedido.

    `useSyncExternalStore` e não `lerChamada()` no inicializador: a preferência
    de mudo pode mudar pelo painel de usuário com o aviso aberto, e o botão
    precisa mostrar o que vai valer.
  */
  const mudoPreferido = useSyncExternalStore(assinarChamada, () => lerChamada().mudo);
  const [semMicrofone, setSemMicrofone] = useState<boolean | undefined>(undefined);
  const [comCamera, setComCamera] = useState(false);
  const microfoneFechado = semMicrofone ?? mudoPreferido;
  /*
    ⚠ **Uma consulta por TOQUE, e só na tela cheia.** O toast não desenha o
    chip, e buscar ali pagaria `GET /users/{id}/mutual` a cada chamada que
    ninguém abriu. A tela cheia monta uma vez por toque, então a rota sai uma
    vez por decisão — a mesma do perfil, com a mesma regra de "não sei" ≠ 0.
  */
  const emComum = useEmComum(toque.quemLigou);
  const amigosEmComum = rotuloDeAmigosEmComum(emComum.dados?.amigos.length);
  const grupo = canal?.tipo === "grupo" ? canal.name : undefined;

  return (
    <div className={css.veu}>
      <div
        className={css.telaCheia}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="vx-chamada-recebida-nome"
        aria-describedby="vx-chamada-recebida-estado"
      >
        <div className={css.topo}>
          <Anel userId={toque.quemLigou} tamanho="cheia" />
          <div className={css.identidade}>
            <div id="vx-chamada-recebida-nome" className={css.nomeGrande}>
              {nome}
            </div>
            <div id="vx-chamada-recebida-estado" className={css.chamando}>
              chamando…
            </div>
          </div>
          {/* A fileira de chips do design (`gap: 6`): o grupo de onde vem a
              chamada e quantos amigos vocês têm em comum. Some inteira sem
              nenhum dos dois, para não deixar um vão no `gap` do topo. */}
          {grupo !== undefined || amigosEmComum !== undefined ? (
            <div className={css.chips}>
              {grupo !== undefined ? (
                <span className={css.contexto}>{grupo}</span>
              ) : null}
              {amigosEmComum !== undefined ? (
                <span className={css.contexto}>{amigosEmComum}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={css.base}>
          <div className={css.escolhas}>
            <button
              type="button"
              className={css.escolha}
              aria-label="Entrar sem microfone"
              aria-pressed={microfoneFechado}
              data-perigo={microfoneFechado}
              title={microfoneFechado ? "Entra com o microfone fechado" : "Entrar sem microfone"}
              onClick={() => setSemMicrofone(!microfoneFechado)}
            >
              {microfoneFechado ? <MicrophoneSlash aria-hidden /> : <Microphone aria-hidden />}
            </button>
            <button
              type="button"
              className={css.escolha}
              /*
                ⚠ **Pressionado = ENTRA COM câmera, e não "sem".** O design
                desenha os dois controles neutros em repouso; como ninguém
                entra numa chamada com a câmera aberta por padrão, o estado de
                repouso É "sem câmera", e o que merece destaque é a exceção.
                Nome do recurso, estado no `aria-pressed` — a regra do lint.
              */
              aria-label="Câmera ao entrar"
              aria-pressed={comCamera}
              data-ativo={comCamera}
              title={comCamera ? "Entra com a câmera ligada" : "Entrar com câmera"}
              onClick={() => setComCamera(!comCamera)}
            >
              <VideoCamera aria-hidden />
            </button>
          </div>

          <div className={css.decisao}>
            <button
              type="button"
              className={css.recusar}
              onClick={() => recusarChamada()}
            >
              Recusar
            </button>
            <button
              type="button"
              className={css.atender}
              /* É um `alertdialog`: o foco precisa chegar à decisão, e Atender é
                 o que o design destaca. */
              autoFocus
              onClick={() =>
                void atenderChamada({ semMicrofone: microfoneFechado, comCamera })
              }
            >
              Atender
            </button>
          </div>

          {/*
            ⚠ **O design escreve isto como NOTA** — "Recusar envia 'não posso
            agora' como mensagem opcional" — e não desenha onde a opção fica.
            Uma nota afirmando uma opção que não existe é a mentira que o
            registro de pendências foi instalado para matar. Aqui ela É a
            opção: o mesmo tom e tamanho da nota, e clicável.
          */}
          <button
            type="button"
            className={css.nota}
            onClick={() => recusarChamada(RECADO)}
          >
            Recusar enviando “{RECADO}” como mensagem
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   O anel
   ============================================================ */

/**
 * O avatar de quem liga, com o anel pulsando.
 *
 * ⚠ **O pulso é transform e opacidade, e só.** É a doutrina de movimento do
 * Foundations, e o `pnpm movimento` a guarda: o anel é absoluto, fora do
 * fluxo, e escalar ele não mexe na caixa de ninguém.
 */
function Anel({ userId, tamanho }: { userId: string; tamanho: "toast" | "cheia" }) {
  const pessoa = usePessoa(userId);
  return (
    <span className={css.anel} data-tamanho={tamanho}>
      <span className={css.pulso} aria-hidden />
      <Avatar id={userId} sigla={pessoa?.sigla} url={pessoa?.avatarUrl} tamanho="lg" />
    </span>
  );
}
