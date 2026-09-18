import { useEffect, useId, useState, useSyncExternalStore } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Segmentado } from "../components/ui/Segmentado";
import type { FalhaDeLote, ResultadoDeLote } from "../lib/lote";
import { chaveDeMembro } from "../sdk/domain";
import {
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
import { useMembro } from "../store/hooks";
import css from "./AdicionarServidor.module.css";

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
 */
const DURACOES = [
  { id: "5", rotulo: "5 min" },
  { id: "60", rotulo: "1 hora" },
  { id: "1440", rotulo: "1 dia" },
  { id: "10080", rotulo: "7 dias" },
] as const;

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

export function ModalDeModeracao({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const moderar = alvo?.tipo === "moderar" ? alvo : undefined;

  /* A lista que falta — começa com todos e encolhe a cada tentativa. */
  const [pendentes, setPendentes] = useState<readonly string[] | undefined>(undefined);
  const [razao, setRazao] = useState("");
  const [minutos, setMinutos] = useState("60");
  const [exclusao, setExclusao] = useState<IdDeExclusao>("0");
  const [andamento, setAndamento] = useState<Andamento | undefined>(undefined);
  const [falhas, setFalhas] = useState<readonly FalhaDeLote<string>[]>([]);
  const [armado, setArmado] = useState(false);
  const idDoMotivo = useId();

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

  if (!moderar) return null;

  const enviando = andamento !== undefined;
  const acao = moderar.acao;
  const varias = alvos.length > 1;
  const quem = varias
    ? `${String(alvos.length)} pessoas`
    : (membro?.displayName ?? "essa pessoa");

  const TITULO = {
    expulsar: varias ? `Expulsar ${quem}` : "Expulsar do servidor",
    banir: varias ? `Banir ${quem}` : "Banir do servidor",
    castigo: varias ? `Castigar ${quem}` : "Deixar de castigo",
  }[acao];

  const AVISO = {
    expulsar: varias
      ? `${quem} saem do servidor e podem voltar pelo próximo convite.`
      : `${quem} sai do servidor e pode voltar pelo próximo convite.`,
    banir: varias
      ? `${quem} saem do servidor e NÃO podem voltar, nem por convite.`
      : `${quem} sai do servidor e NÃO pode voltar, nem por convite.`,
    castigo: varias
      ? `${quem} continuam no servidor, mas não conseguem falar até o prazo acabar.`
      : `${quem} continua no servidor, mas não consegue falar até o prazo acabar.`,
  }[acao];

  const DICA_DO_MOTIVO = {
    expulsar: "Opcional, mas registrado na auditoria.",
    banir: "Esperado — fica no registro de banimentos e na auditoria.",
    castigo: "Vai para a auditoria.",
  }[acao];

  const janela = EXCLUSOES.find((e) => e.id === exclusao) ?? EXCLUSOES[0];

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
      p = castigarEmLote(
        moderar.serverId,
        ids,
        { minutos: Number(minutos), motivo },
        progredir,
      );
    }

    void p.then((r) => {
      setAndamento(undefined);
      moderar.aoConcluir?.(r.feitos);
      if (r.falhas.length === 0) {
        aoFechar();
        return;
      }
      setFalhas(r.falhas);
      setPendentes(r.falhas.map((f) => f.item));
    });
  }

  const bloqueadoPeloAtraso = acao === "banir" && !armado;

  return (
    <Dialog open onOpenChange={(v) => !v && !enviando && aoFechar()}>
      <DialogContent
        titulo={TITULO}
        className={css.painel}
        /*
          D-SRVPG-45: o destrutivo nunca é o foco inicial. O Radix focaria o
          primeiro tabulável, que num modal sem campo seria o botão de ação;
          o motivo existe nos três, e é onde a pessoa escreve primeiro.
        */
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById(idDoMotivo)?.focus();
        }}
        /* Cancelar ANTES de confirmar: a ação destrutiva fica na ponta, que é
           onde o ponteiro chega por último e onde o design a põe. */
        rodape={
          <>
            <Botao variante="sutil" onClick={aoFechar} disabled={enviando}>
              {falhas.length > 0 ? "Fechar" : "Cancelar"}
            </Botao>
            <Botao
              variante="perigo"
              disabled={enviando || bloqueadoPeloAtraso || alvos.length === 0}
              carregando={enviando}
              rotuloCarregando={
                andamento && andamento.total > 1
                  ? `Aplicando ${String(andamento.terminados)} de ${String(andamento.total)}…`
                  : "Aplicando…"
              }
              onClick={executar}
            >
              {falhas.length > 0 ? "Tentar de novo" : TITULO}
            </Botao>
          </>
        }
      >
        <div className={css.corpo}>
          <p className={css.aviso}>{AVISO}</p>

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

          <Campo
            id={idDoMotivo}
            rotulo={acao === "expulsar" ? "Motivo (opcional)" : "Motivo"}
            dica={DICA_DO_MOTIVO}
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
            <Segmentado
              rotulo="Por quanto tempo"
              valor={minutos}
              desabilitado={enviando}
              opcoes={DURACOES.map((d) => ({ id: d.id, rotulo: d.rotulo }))}
              aoEscolher={(id) => {
                setMinutos(id);
              }}
            />
          ) : null}

          {acao === "banir" ? (
            <>
              <Segmentado<IdDeExclusao>
                rotulo="Excluir mensagens recentes"
                valor={exclusao}
                desabilitado={enviando}
                opcoes={EXCLUSOES.map((d) => ({ id: d.id, rotulo: d.rotulo }))}
                aoEscolher={setExclusao}
              />
              {janela.id !== "0" ? (
                <Banner tom="aviso">
                  {`Serão excluídas todas as mensagens ${varias ? "destas contas" : "desta conta"} ${janela.frase} em todos os canais. Não há como desfazer.`}
                </Banner>
              ) : null}
            </>
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
              <ul className={css.falhas}>
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
    <div className={css.historico}>
      <p className={css.historicoTitulo}>
        Já registrado sobre essa pessoa
        {entradas.length > TETO_DO_HISTORICO
          ? ` · ${String(entradas.length)} entradas`
          : ""}
      </p>
      <ul className={css.historicoLista}>
        {entradas.slice(0, TETO_DO_HISTORICO).map((e) => (
          <li key={e.id}>
            <span className={css.historicoQuando}>{e.quandoTexto}</span>{" "}
            <strong>{e.autor}</strong> {e.frase}
            {e.razao === undefined ? null : ` · ${e.razao}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
