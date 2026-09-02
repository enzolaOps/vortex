import { useState, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Interruptor } from "../components/ui/Interruptor";
import { Phone, X } from "../components/ui/icones";
import { gradienteDe } from "../lib/gradiente";
import { aindaNao } from "../pendente/pendencias";
import { entrarNaChamada } from "../sdk/chamada";
import { abrirConversaCom } from "../sdk/social";
import { PontoDePresenca } from "../presenca/PontoDePresenca";
import { chaveDeMembro } from "../sdk/domain";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { abrirConfig } from "../store/config";
import { abrirConversa } from "../store/navegacao";
import { useCorDeCargo, useMembro } from "../store/hooks";
import {
  alternarSilencioDe,
  assinarNota,
  assinarSilencioDe,
  escreverNota,
  estaSilenciado,
  lerNota,
} from "../store/sobrePessoas";
import { PilulasDeCargo } from "./PilulasDeCargo";
import css from "./ModalDePerfil.module.css";

/**
 * O perfil completo — 620px, banner, abas.
 *
 * ⚠ **Ele reusava o corpo do HOVER CARD, e é isso que quem usa apontou.** O
 * design desenha duas superfícies diferentes: o cartão que aparece passando o
 * ponteiro (resumo) e este, que é onde se decide mandar mensagem, ligar,
 * anotar e silenciar. Empilhar a nota embaixo do resumo dava um cartão de
 * hover com um formulário parafusado — 400px de largura para uma tela que o
 * design faz em 620, sem banner, sem abas e sem as ações.
 *
 * `CorpoDePerfil` continua servindo o hover card, que é o que ele sempre foi.
 */
export function ModalDePerfil({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  if (alvo?.tipo !== "perfil") return null;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Perfil"
        tituloOculto
        /* Sem respiro no painel: banner, corpo e colunas são donos do seu, e é
           isso que permite o banner sangrar até a borda. Mesma decisão dos
           dois modais que já tinham resolvido isso à mão. */
        className={`${css.painel} p-0`}
      >
        <Conteudo
          serverId={alvo.serverId}
          userId={alvo.userId}
          aoFechar={aoFechar}
        />
      </DialogContent>
    </Dialog>
  );
}

/** As três abas do design. */
const ABAS = ["sobre", "servidores", "amigos"] as const;
type Aba = (typeof ABAS)[number];

const NOME_DA_ABA: Record<Aba, string> = {
  sobre: "Sobre",
  servidores: "Servidores em comum",
  amigos: "Amigos em comum",
};

function Conteudo({
  serverId,
  userId,
  aoFechar,
}: {
  serverId: string;
  userId: string;
  aoFechar: () => void;
}) {
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const corDeCargo = useCorDeCargo(membro?.cor);
  const nota = useSyncExternalStore(
    (o) => assinarNota(userId, o),
    () => lerNota(userId),
  );
  const silenciado = useSyncExternalStore(
    (o) => assinarSilencioDe(userId, o),
    () => estaSilenciado(userId),
  );
  const [aba, setAba] = useState<Aba>("sobre");

  if (!membro) return <p className={css.carregando}>carregando…</p>;

  /*
    ⚠ **A linha de metadado junta o que EXISTE, e o design junta mais.** Ele
    escreve `marina · ela/dela · entrou em mar 2024`; aqui as três partes só
    entram quando há dado, senão sobrariam separadores soltos. `entrouEm` já
    vem formatado do adapter — formatar data no render multiplicaria um `Intl`
    por abertura.
  */
  const meta = [
    membro.username,
    membro.pronomes,
    membro.entrouEm ? `entrou em ${membro.entrouEm}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {/* O gradiente da identidade esticado — ver o comentário de `.banner`. */}
      <div className={css.banner} style={{ background: gradienteDe(userId) }}>
        <div className={css.acoesDoBanner}>
          {/*
            "Editar perfil" é REAL e leva às configurações — é a mesma tela que
            o painel de usuário abre. Ele aparece para todo mundo porque o
            perfil que se edita é sempre o seu; abrir o de outra pessoa e ver o
            botão apontando para o SEU seria mentira, então ele só existe
            quando o perfil é o seu.
          */}
          <button
            type="button"
            className={css.acaoDoBanner}
            onClick={() => {
              aoFechar();
              abrirConfig("perfil");
            }}
          >
            Editar perfil
          </button>
          <button
            type="button"
            className={`${css.acaoDoBanner} ${css.fecharDoBanner}`}
            aria-label="Fechar"
            onClick={aoFechar}
          >
            <X aria-hidden />
          </button>
        </div>
      </div>

      <div className={css.corpo}>
        <div className={css.identidade}>
          {/* A moldura é quem recorta o avatar do banner — ver `.moldura`. */}
          <div className={css.moldura}>
            <Avatar
              id={userId}
              sigla={membro.sigla}
              url={membro.avatarUrl}
              tamanho="lg"
            >
              <PontoDePresenca userId={userId} rotular />
            </Avatar>
          </div>

          <div className={css.acoes}>
            <button
              type="button"
              className={css.acao}
              data-primaria="true"
              /*
                ⚠ **`openDM` é idempotente no protocolo** — chamar com uma
                conversa que já existe devolve a mesma. É o que permite não
                haver dois caminhos ("abrir" e "criar") que precisariam
                concordar. A navegação fica aqui e não em `sdk/social`: aquele
                traduz protocolo, e para onde a pessoa vai é do store.
              */
              onClick={() => {
                aoFechar();
                void abrirConversaCom(userId).then((canal) => {
                  if (canal) abrirConversa(canal);
                });
              }}
            >
              Mensagem
            </button>
            {/*
              ⚠ **Ligar é abrir a conversa E entrar na sala dela**, nesta
              ordem. No Stoat não existe "chamada avulsa": chamada é sempre de
              um CANAL, e o canal de uma conversa direta é a própria DM. Sem
              abrir antes, a pessoa entraria numa chamada sem ver com quem.
            */}
            <button
              type="button"
              className={css.acao}
              onClick={() => {
                aoFechar();
                void abrirConversaCom(userId).then((canal) => {
                  if (!canal) return;
                  abrirConversa(canal);
                  void entrarNaChamada(canal);
                });
              }}
            >
              <Phone aria-hidden />
              Ligar
            </button>
            {/*
              ⚠ **O `⋯` do design NÃO entrou.** As ações que ele carregaria —
              cargos, apelido, moderação — são as do menu de contexto da member
              list, e elas dependem da hierarquia resolvida, que já é pendência
              registrada. Um alvo que abre um menu vazio é pior que a ausência.
            */}
          </div>
        </div>

        <div className={css.linhaDoNome}>
          <h2
            className={css.nome}
            style={corDeCargo ? { color: corDeCargo } : undefined}
          >
            {membro.displayName}
          </h2>
        </div>
        {meta ? <p className={css.meta}>{meta}</p> : null}

        {/*
          ⚠ **`role="tablist"` de verdade, e não três botões parecidos.** Sem
          ele o leitor de tela anuncia "Sobre, botão" três vezes e nada diz que
          são alternativas de uma mesma região — e a seta do teclado, que é
          como se navega uma faixa de abas, não faria nada.
        */}
        <div className={css.abas} role="tablist" aria-label="Seções do perfil">
          {ABAS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              className={css.aba}
              onClick={
                id === "sobre"
                  ? () => setAba(id)
                  : id === "servidores"
                    ? aindaNao("servidoresEmComum")
                    : aindaNao("amigosEmComum")
              }
            >
              {NOME_DA_ABA[id]}
            </button>
          ))}
        </div>

        <div className={css.colunas}>
          <div className={css.secao}>
            <p className={css.rotulo}>Sobre</p>
            {membro.statusTexto ? (
              <p className={css.texto}>{membro.statusTexto}</p>
            ) : (
              <p className={css.vazio}>Sem recado.</p>
            )}

            <p className={css.rotulo}>Cargos</p>
            <PilulasDeCargo serverId={serverId} cargosIds={membro.cargosIds} />
          </div>

          <div className={css.secao}>
            <p className={css.rotulo}>Nota privada · só você vê</p>
            {/*
              ⚠ **Salva a cada tecla, sem botão — e o design escreve "Salva
              automaticamente" por extenso.** Um botão de salvar aqui produziria
              a nota perdida por fechar o modal, que é o modo de falha que faz
              alguém parar de usar a caixa.
            */}
            <textarea
              className={css.nota}
              rows={3}
              value={nota}
              placeholder="Onde nos conhecemos, o que combinamos…"
              onChange={(e) => escreverNota(userId, e.target.value)}
            />
            <p className={css.dica}>Salva automaticamente</p>

            {/*
              ⚠ **"só para mim" está no rótulo, e não é enfeite.** Silenciar
              aqui não conta ao servidor nem à outra pessoa — é filtro local.
              Sem essa metade da frase, alguém marcaria acreditando ter
              bloqueado, e a diferença entre esconder e bloquear é exatamente o
              que importa saber.
            */}
            <Interruptor
              rotulo="Silenciar só para mim"
              ligado={silenciado}
              aoAlternar={() => alternarSilencioDe(userId)}
            />
            <p className={css.dica}>
              As mensagens desta pessoa ficam ocultas para você. Ela não fica
              sabendo.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
