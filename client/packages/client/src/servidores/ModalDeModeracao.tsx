import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { ProhibitInset, SignOut, Timer } from "../components/ui/icones";
import { Interruptor } from "../components/ui/Interruptor";
import { toast } from "../components/ui/toastStore";
import type { FalhaDeLote, ResultadoDeLote } from "../lib/lote";
import { plural } from "../lib/plural";
import { chaveDeMembro, type MemberSnapshot } from "../sdk/domain";
import {
  avisarPorDmEmLote,
  banirEmLote,
  castigarEmLote,
  expulsarEmLote,
  type JanelaDeExclusao,
} from "../sdk/moderacao";
import {
  historicoDoMembro,
  type EntradaDeAuditoria,
} from "../sdk/auditoria";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { useMembro, useServer } from "../store/hooks";
import { useAgoraPorMinuto } from "../store/relogio";
import antigo from "./AdicionarServidor.module.css";
import css from "./ModalDeModeracao.module.css";
import {
  avisoDeCastigo,
  DURACAO_PADRAO,
  DURACOES_DE_CASTIGO,
  entrouHa,
  idCurto,
  terminoDoCastigo,
} from "./textoDaModeracao";

/**
 * Expulsar, banir e deixar de castigo — uma pessoa ou várias.
 *
 * Um modal para os três porque a estrutura é a mesma — quem, o que acontece,
 * confirma — e o que muda é um campo. Três modais teriam três confirmações que
 * precisam concordar no tom.
 *
 * ⚠ **O texto diz a DIFERENÇA entre eles, e essa é a razão de o modal existir
 * em vez de a ação sair direto do menu.** Expulsar e banir parecem a mesma
 * coisa e não são: quem foi expulso volta pelo próximo convite, quem foi
 * banido não. Descobrir isso depois de clicar é tarde.
 *
 * ⚠ **Lote de verdade (D-SRVPG-07).** A barra da página de Membros abria este
 * modal com o PRIMEIRO selecionado e mais ninguém: "banir 12" banía um. Agora
 * ele recebe a lista, diz o plural, mostra o progresso e, quando alguém falha,
 * fica aberto dizendo QUEM e por quê — com "Tentar de novo" só para esses.
 *
 * A casca é a do design (D-SRVPG-44): ícone semântico à esquerda, título e
 * consequência no cabeçalho, card do alvo, motivo sempre presente e o rodapé
 * na faixa. O card NÃO aparece no castigo — o design não o desenha ali, e o
 * cabeçalho já nomeia a pessoa ("Téo não poderá falar…").
 */

/* D-SRVPG-43: Nenhuma · 1 h · 24 h · 7 dias. */
const EXCLUSOES = [
  { id: "0", rotulo: "Nenhuma", frase: "" },
  { id: "3600", rotulo: "1 h", frase: "na última hora" },
  { id: "86400", rotulo: "24 h", frase: "nas últimas 24 horas" },
  { id: "604800", rotulo: "7 dias", frase: "nos últimos 7 dias" },
] as const;
type IdDeExclusao = (typeof EXCLUSOES)[number]["id"];

/**
 * D-SRVPG-45: "banir" só habilita depois de 400ms de modal aberto, para o
 * clique que abriu o menu não cair no botão que acabou de aparecer embaixo
 * dele.
 */
const ATRASO_DO_BANIR_MS = 400;

type Andamento = { readonly terminados: number; readonly total: number };
type Acao = "expulsar" | "banir" | "castigo";

/*
  D-SRVPG-44: o ícone semântico. O design escreve ⏱ ⤴ ⛔ como caracteres; aqui
  são os ícones do ponto único, porque glifo de fonte muda de desenho entre
  sistemas e o resto do app não usa nenhum.
*/
const GLIFO: Record<Acao, ReactNode> = {
  castigo: <Timer aria-hidden />,
  expulsar: <SignOut aria-hidden />,
  banir: <ProhibitInset aria-hidden />,
};

export function ModalDeModeracao({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const moderar = alvo?.tipo === "moderar" ? alvo : undefined;

  /* A lista que falta — começa com todos e encolhe a cada tentativa. */
  const [pendentes, setPendentes] = useState<readonly string[] | undefined>(undefined);
  const [razao, setRazao] = useState("");
  const [minutos, setMinutos] = useState<number>(DURACAO_PADRAO);
  const [exclusao, setExclusao] = useState<IdDeExclusao>("0");
  /* D-SRVPG-40: ligado por padrão, como o design (`dmWarn: true`). */
  const [avisarPorDm, setAvisarPorDm] = useState(true);
  const [andamento, setAndamento] = useState<Andamento | undefined>(undefined);
  const [falhas, setFalhas] = useState<readonly FalhaDeLote<string>[]>([]);
  const [armado, setArmado] = useState(false);
  const idDoMotivo = useId();
  const agora = useAgoraPorMinuto();

  useEffect(() => {
    /* setState ASSÍNCRONO, no timer — não é o render em cascata que o lint
       reprova. */
    const t = setTimeout(() => {
      setArmado(true);
    }, ATRASO_DO_BANIR_MS);
    return () => {
      clearTimeout(t);
    };
  }, []);

  const alvos = pendentes ?? moderar?.userIds ?? [];
  const primeiro = alvos[0] ?? "";
  const membro = useMembro(chaveDeMembro(moderar?.serverId ?? "", primeiro));
  const servidor = useServer(moderar?.serverId ?? "");

  if (!moderar) return null;

  const enviando = andamento !== undefined;
  const acao = moderar.acao;
  const varias = alvos.length > 1;
  const n = String(alvos.length);
  const nome = membro?.displayName ?? "Essa pessoa";

  const TITULO: Record<Acao, string> = {
    castigo: varias ? `Castigar ${n} pessoas` : "Castigar membro",
    expulsar: varias ? `Expulsar ${n} pessoas` : "Expulsar membro",
    banir: varias ? `Banir ${n} pessoas` : "Banir membro",
  };

  /* D-SRVPG-38/41/42: a consequência, com as palavras do design. */
  const CONSEQUENCIA: Record<Acao, string> = {
    castigo: varias
      ? `${n} pessoas não poderão falar, reagir nem entrar em voz.`
      : `${nome} não poderá falar, reagir nem entrar em voz.`,
    expulsar: varias
      ? `${n} pessoas saem do servidor, mas podem voltar com um novo convite.`
      : `${nome} sai do servidor, mas pode voltar com um novo convite.`,
    banir: varias
      ? "As contas não conseguirão voltar, nem com convite novo."
      : "A conta não conseguirá voltar, nem com convite novo.",
  };

  const ACAO: Record<Acao, string> = {
    castigo: varias ? `Castigar ${n}` : "Castigar",
    expulsar: varias ? `Expulsar ${n}` : "Expulsar",
    /* D-SRVPG-42: "permanentemente" está no BOTÃO, e não só no texto — é a
       última coisa lida antes do clique. */
    banir: varias ? `Banir ${n} permanentemente` : "Banir permanentemente",
  };

  const janela = EXCLUSOES.find((e) => e.id === exclusao) ?? EXCLUSOES[0];
  const termino = terminoDoCastigo(agora, minutos);

  function executar() {
    if (!moderar || enviando || alvos.length === 0) return;
    const ids = alvos;
    const motivo = razao.trim() || undefined;
    const progredir = (terminados: number, total: number) => {
      setAndamento({ terminados, total });
    };
    setFalhas([]);
    setAndamento({ terminados: 0, total: ids.length });

    let p: Promise<ResultadoDeLote<string>>;
    if (acao === "expulsar") {
      p = expulsarEmLote(moderar.serverId, ids, { motivo }, progredir);
    } else if (acao === "banir") {
      p = banirEmLote(
        moderar.serverId,
        ids,
        { motivo, excluirMensagensDe: Number(exclusao) as JanelaDeExclusao },
        progredir,
      );
    } else {
      p = castigarEmLote(moderar.serverId, ids, { minutos, motivo }, progredir);
    }

    void p.then((r) => {
      setAndamento(undefined);
      moderar.aoConcluir?.(r.feitos);
      if (acao === "castigo" && avisarPorDm && r.feitos.length > 0) {
        /* O término é recalculado AGORA, e não o da tela: o texto chega a
           quem foi castigado e precisa bater com o instante gravado. */
        avisar(
          r.feitos,
          avisoDeCastigo({
            servidor: servidor?.name ?? "um servidor",
            termino: terminoDoCastigo(Date.now(), minutos),
            motivo,
          }),
        );
      }
      if (r.falhas.length === 0) {
        aoFechar();
        return;
      }
      setFalhas(r.falhas);
      setPendentes(r.falhas.map((f) => f.item));
    });
  }

  const bloqueadoPeloAtraso = acao === "banir" && !armado;
  const mostraTermino = acao === "castigo";

  return (
    <Dialog open onOpenChange={(v) => !v && !enviando && aoFechar()}>
      <DialogContent
        titulo={TITULO[acao]}
        descricao={CONSEQUENCIA[acao]}
        icone={
          <span className={css.icone} data-acao={acao}>
            {GLIFO[acao]}
          </span>
        }
        fechavel
        className={css.painel}
        /*
          D-SRVPG-45: o destrutivo nunca é o foco inicial. O Radix focaria o
          primeiro tabulável, que agora seria o ✕ ou um chip; o motivo existe
          nos três, e é onde a pessoa escreve primeiro.
        */
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById(idDoMotivo)?.focus();
        }}
        classeDoRodape={mostraTermino ? css.rodapeDividido : undefined}
        /* Cancelar ANTES de confirmar: a ação destrutiva fica na ponta, que é
           onde o ponteiro chega por último e onde o design a põe. */
        rodape={
          <>
            {mostraTermino ? <span className={css.termino}>Termina {termino}</span> : null}
            <div className={css.acoes}>
              <Botao variante="sutil" onClick={aoFechar} disabled={enviando}>
                {falhas.length > 0 ? "Fechar" : "Cancelar"}
              </Botao>
              <Botao
                /* Âmbar restringe, vermelho remove — o mesmo tom do ícone. */
                variante={acao === "castigo" ? "aviso" : "perigo"}
                disabled={enviando || bloqueadoPeloAtraso || alvos.length === 0}
                carregando={enviando}
                rotuloCarregando={
                  andamento && andamento.total > 1
                    ? `Aplicando ${String(andamento.terminados)} de ${String(andamento.total)}…`
                    : "Aplicando…"
                }
                onClick={executar}
              >
                {falhas.length > 0 ? "Tentar de novo" : ACAO[acao]}
              </Botao>
            </div>
          </>
        }
      >
        <div className={css.corpo}>
          {/* D-SRVPG-41/42: o card do alvo, só com UM alvo e só onde o design o
              desenha. Em lote não há "o" alvo — o título já diz quantos. */}
          {varias || acao === "castigo" ? null : (
            <CartaoDoAlvo userId={primeiro} membro={membro} acao={acao} agora={agora} />
          )}

          {/*
            ⚠ **O histórico de quem está sendo moderado, e é aqui que ele
            pertence.** "O que já fizeram com esta pessoa" é a pergunta que se
            faz ANTES de decidir entre castigo e banimento — um segundo
            castigo em duas semanas é um caso diferente do primeiro. Ler o
            registro numa tela e agir em outra é o gesto que esta caixa existe
            para poupar.

            Só com UM alvo: em lote não há uma história, há doze, e um bloco
            que some quando se seleciona a segunda pessoa é melhor que um que
            mostra a de quem calhou de ser o primeiro da lista.
          */}
          {varias ? null : (
            <HistoricoDoAlvo serverId={moderar.serverId} userId={primeiro} />
          )}

          {acao === "castigo" ? (
            <GradeDeEscolha
              rotulo="Duração"
              colunas={3}
              valor={String(minutos)}
              desabilitado={enviando}
              opcoes={DURACOES_DE_CASTIGO.map((d) => ({
                id: String(d.minutos),
                rotulo: d.rotulo,
              }))}
              aoEscolher={(id) => {
                setMinutos(Number(id));
              }}
            />
          ) : null}

          {acao === "banir" ? (
            <GradeDeEscolha
              rotulo="Excluir mensagens recentes"
              colunas={4}
              valor={exclusao}
              desabilitado={enviando}
              opcoes={EXCLUSOES.map((d) => ({ id: d.id, rotulo: d.rotulo }))}
              aoEscolher={(id) => {
                const achada = EXCLUSOES.find((e) => e.id === id);
                if (achada) setExclusao(achada.id);
              }}
            />
          ) : null}

          <div>
            <label className={css.rotuloDoMotivo} htmlFor={idDoMotivo}>
              {acao === "castigo" ? "Motivo · vai para a auditoria" : "Motivo"}
            </label>
            <textarea
              id={idDoMotivo}
              className={css.motivo}
              rows={2}
              placeholder={PLACEHOLDER_DO_MOTIVO[acao]}
              autoComplete="off"
              /* O cabeçalho corta em 512 BYTES; caracteres acentuados valem 2. */
              maxLength={512}
              disabled={enviando}
              value={razao}
              onChange={(e) => {
                setRazao(e.target.value);
              }}
            />
            {acao === "castigo" ? (
              <div className={css.linhaDoAviso}>
                {/* O rótulo visível é texto e o nome acessível vai no
                    interruptor — um `<label>` aqui apontaria para um botão. */}
                <span className={css.rotuloDoAviso} aria-hidden>
                  Avisar por DM
                </span>
                <Interruptor
                  rotulo="Avisar por DM"
                  ligado={avisarPorDm}
                  disabled={enviando}
                  aoAlternar={setAvisarPorDm}
                />
              </div>
            ) : null}
          </div>

          {acao === "banir" && janela.id !== "0" ? (
            <Banner tom="perigo">
              {`Serão excluídas todas as mensagens ${varias ? "destas contas" : "desta conta"} ${janela.frase} em todos os canais. Não há como desfazer.`}
            </Banner>
          ) : null}

          {falhas.length > 0 ? (
            <Banner
              tom="perigo"
              titulo={
                falhas.length === 1
                  ? "1 pessoa não foi alterada."
                  : `${String(falhas.length)} pessoas não foram alteradas.`
              }
            >
              <ul className={antigo.falhas}>
                {falhas.map((f) => (
                  <li key={f.item}>
                    <NomeDoMembro serverId={moderar.serverId} userId={f.item} /> — {f.motivo}
                  </li>
                ))}
              </ul>
            </Banner>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/*
  D-SRVPG-41/42: "opcional" no expulsar e "esperado" no banir — o design diz
  as duas palavras, e a diferença é o peso que cada decisão carrega no
  registro. O castigo não tem placeholder: o rótulo já diz para onde vai.
*/
const PLACEHOLDER_DO_MOTIVO: Record<Acao, string | undefined> = {
  castigo: undefined,
  expulsar: "Opcional, mas registrado na auditoria",
  banir: "Esperado — fica no registro de banimentos e na auditoria",
};

/**
 * Manda o aviso e conta quem não recebeu.
 *
 * Fora do modal e sem `await`: o modal já fechou quando isto termina, e o
 * castigo valeu de qualquer jeito. Quem não aceita DM de quem modera (a
 * privacidade por servidor existe) é o caso comum de falha, e ele merece ser
 * dito — senão quem castigou acredita que avisou.
 */
function avisar(userIds: readonly string[], texto: string): void {
  void avisarPorDmEmLote(userIds, texto).then((r) => {
    if (r.falhas.length === 0) return;
    toast({
      tipo: "info",
      titulo: `${plural(r.falhas.length, "pessoa não recebeu", "pessoas não receberam")} o aviso por DM.`,
      descricao: "O castigo foi aplicado mesmo assim.",
    });
  });
}

/**
 * Chips de escolha única em grade — as durações do castigo e a janela de
 * exclusão do banimento.
 *
 * `radiogroup` com tabulação itinerante, como o `Segmentado`: uma parada de
 * Tab para o grupo e setas entre as opções. O `Segmentado` não serve aqui —
 * ele é uma pílula contínua de largura de conteúdo, e o design quer uma GRADE
 * de caixas iguais, que é o que faz seis durações lerem como uma régua.
 */
function GradeDeEscolha({
  rotulo,
  colunas,
  valor,
  opcoes,
  desabilitado,
  aoEscolher,
}: {
  rotulo: string;
  colunas: 3 | 4;
  valor: string;
  opcoes: readonly { readonly id: string; readonly rotulo: string }[];
  desabilitado: boolean;
  aoEscolher: (id: string) => void;
}) {
  const idDoRotulo = useId();

  function aoTeclar(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const passo =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (passo === 0) return;
    e.preventDefault();
    const j = (i + passo + opcoes.length) % opcoes.length;
    const proxima = opcoes[j];
    if (!proxima) return;
    aoEscolher(proxima.id);
    /* O foco acompanha a escolha: com tabulação itinerante, só o marcado é
       tabulável, e deixar o foco no antigo o tornaria inalcançável. */
    const irmao = e.currentTarget.parentElement?.children[j];
    if (irmao instanceof HTMLElement) irmao.focus();
  }

  return (
    <div>
      <span className={css.rotulo} id={idDoRotulo}>
        {rotulo}
      </span>
      <div
        className={css.grade}
        data-colunas={colunas}
        role="radiogroup"
        aria-labelledby={idDoRotulo}
      >
        {opcoes.map((o, i) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === valor}
            tabIndex={o.id === valor ? 0 : -1}
            className={css.chip}
            disabled={desabilitado}
            onClick={() => {
              aoEscolher(o.id);
            }}
            onKeyDown={(e) => {
              aoTeclar(e, i);
            }}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Quem vai sair — o card do design (D-SRVPG-41/42).
 *
 * ⚠ **Expulsar mostra o HANDLE e banir mostra o ID**, como o design desenha.
 * Expulsar é sobre um membro presente, que se reconhece pelo nome de usuário;
 * banir é sobre a CONTA, que pode nem estar mais no servidor (o spam que entra
 * e sai), e é pelo ID que o registro de banimentos a mostra depois.
 */
function CartaoDoAlvo({
  userId,
  membro,
  acao,
  agora,
}: {
  userId: string;
  membro: MemberSnapshot | undefined;
  acao: "expulsar" | "banir";
  agora: number;
}) {
  const meta =
    acao === "banir"
      ? idCurto(userId)
      : [membro?.username, entrouHa(membro?.entrouEmMs, agora)]
          .filter((p): p is string => Boolean(p))
          .join(" · ");
  return (
    <div className={css.alvo}>
      <Avatar id={userId} sigla={membro?.sigla} url={membro?.avatarUrl} tamanho="sm" />
      <div className={css.alvoNomes}>
        <span className={css.alvoNome}>{membro?.displayName ?? userId}</span>
        {meta ? <span className={css.alvoMeta}>{meta}</span> : null}
      </div>
      {acao === "expulsar" && membro?.cargo ? (
        <span className={css.alvoCargo}>{membro.cargo}</span>
      ) : null}
    </div>
  );
}

/** Assina a própria pessoa — lei nº 1, e a lista de falhas pode ser longa. */
function NomeDoMembro({ serverId, userId }: { serverId: string; userId: string }) {
  const membro = useMembro(chaveDeMembro(serverId, userId));
  return <strong>{membro?.displayName ?? userId}</strong>;
}

/** Quantas entradas cabem sem o histórico virar a tela. */
const TETO_DO_HISTORICO = 5;

/**
 * O que a auditoria já registrou SOBRE esta pessoa.
 *
 * ⚠ **Filtrado no SERVIDOR por `target`, e não aqui.** Trazer a página inteira
 * e procurar a pessoa nela só funciona enquanto ela estiver entre as últimas
 * cem entradas — num servidor movimentado, o castigo de duas semanas atrás
 * está fora. `historicoDoMembro` manda `target` e o servidor escolhe.
 *
 * ⚠ **Ausente quando não há nada E quando não deu para saber.** A diferença
 * importaria numa tela de leitura; aqui o bloco é CONTEXTO para uma decisão
 * que já está sendo tomada, e uma faixa de erro sobre uma consulta secundária
 * competiria com o aviso destrutivo logo acima. `listarAuditoria` já não
 * levanta toast no modo silencioso, que é o mesmo arranjo da tela de
 * Banimentos: quem modera pode não ter `ViewAuditLogs`.
 */
function HistoricoDoAlvo({
  serverId,
  userId,
}: {
  serverId: string;
  userId: string;
}) {
  const [entradas, setEntradas] = useState<
    readonly EntradaDeAuditoria[] | undefined
  >(undefined);

  useEffect(() => {
    if (!serverId || !userId) return;
    let vivo = true;
    void historicoDoMembro(serverId, userId).then((l) => {
      if (vivo) setEntradas(l);
    });
    return () => {
      vivo = false;
    };
  }, [serverId, userId]);

  if (entradas === undefined || entradas.length === 0) return null;

  return (
    <div className={antigo.historico}>
      <p className={antigo.historicoTitulo}>
        Já registrado sobre essa pessoa
        {entradas.length > TETO_DO_HISTORICO
          ? ` · ${String(entradas.length)} entradas`
          : ""}
      </p>
      <ul className={antigo.historicoLista}>
        {entradas.slice(0, TETO_DO_HISTORICO).map((e) => (
          <li key={e.id}>
            <span className={antigo.historicoQuando}>{e.quandoTexto}</span>{" "}
            <strong>{e.autor}</strong> {e.frase}
            {e.razao === undefined ? null : ` · ${e.razao}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
