import { banirEmLote, castigarEmLote, expulsarEmLote } from "nucleo/sdk/moderacao";
import { alternarCargo, cargosDoServidor, meuAlcance, moderarVoz, moverParaCanalDeVoz, pessoasDoServidor } from "nucleo/sdk/cargos";
import { chaveDeMembro } from "nucleo/sdk/domain";
import { podeNoServidor } from "nucleo/sdk/permissoes";
import { canalDeVozDaPessoa } from "nucleo/sdk/salasDeVoz";
import { carregarMembros } from "nucleo/sdk/servidores";
import { useCanaisDeVoz, useChannel, useMembro, useMembrosDoServidor } from "nucleo/store/hooks";
import { useEffect, useState } from "react";

import { admin, comum } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import { MaisHorizontal } from "../../ui/icones";
import { toast } from "../../ui/primitivos/Avisos";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import {
  ConteudoDoMenu,
  GatilhoDoMenu,
  ItemDeMenu,
  MenuSuspenso,
  RotuloDeMenu,
  SeparadorDeMenu,
} from "../../ui/primitivos/Menus";
import { Interruptor } from "../config/controles";
import css from "./admin.module.css";
import { Confirmacao } from "./Confirmacao";
import { Carregando, Vazio } from "./Estados";

const t = admin.membrosPagina;

/** Quantas linhas desenhar de uma vez: servidor grande não monta dez mil linhas numa página de configuração. */
const PAGINA = 100;
const UM_DIA = 86_400 as const;

const CASTIGOS = [
  { minutos: 1, rotulo: t.umMinuto },
  { minutos: 10, rotulo: t.dezMinutos },
  { minutos: 60, rotulo: t.umaHora },
  { minutos: 1_440, rotulo: t.umDia },
  { minutos: 10_080, rotulo: t.umaSemana },
] as const;

type Acao =
  | { readonly tipo: "cargos"; readonly userId: string; readonly nome: string }
  | { readonly tipo: "expulsar"; readonly userId: string; readonly nome: string }
  | { readonly tipo: "banir"; readonly userId: string; readonly nome: string };

function NomeDoCanal({ id }: { id: string }) {
  const canal = useChannel(id);
  return <>{canal?.name ?? id}</>;
}

/** Quanto falta de castigo, em frase curta. Vazio se não há castigo valendo. */
function restante(ate: number | undefined, agora: number): string | undefined {
  if (ate === undefined || ate <= agora) return undefined;
  const min = Math.ceil((ate - agora) / 60_000);
  if (min < 60) return `${String(min)} min`;
  if (min < 1_440) return `${String(Math.ceil(min / 60))} h`;
  return `${String(Math.ceil(min / 1_440))} d`;
}

function MenuDaPessoa({
  serverId,
  userId,
  nome,
  abaixoDeMim,
  castigado,
  aoAbrir,
}: {
  serverId: string;
  userId: string;
  nome: string;
  abaixoDeMim: boolean;
  castigado: boolean;
  aoAbrir: (acao: Acao) => void;
}) {
  const alcance = meuAlcance(serverId);
  const podeCargos = alcance.podeAtribuir && abaixoDeMim;
  const podeCastigar = podeNoServidor(serverId, "silenciarMembro") && abaixoDeMim;
  const podeExpulsar = podeNoServidor(serverId, "expulsar") && abaixoDeMim;
  const podeBanir = podeNoServidor(serverId, "banir") && abaixoDeMim;
  const voz = useCanaisDeVoz(serverId);
  /* Onde a pessoa está agora: lido na abertura do menu, que é quando importa. */
  const salaDela = canalDeVozDaPessoa(userId);
  const podeModerarVoz = abaixoDeMim && salaDela !== undefined;
  const podeMudo = podeModerarVoz && podeNoServidor(serverId, "silenciarNaVoz");
  const podeSurdo = podeModerarVoz && podeNoServidor(serverId, "ensurdecerNaVoz");
  const podeMover = podeModerarVoz && podeNoServidor(serverId, "moverMembros");

  // Sem nenhuma ação possível o menu inteiro some, em vez de abrir vazio.
  if (!podeCargos && !podeCastigar && !podeExpulsar && !podeBanir && !podeMudo && !podeSurdo && !podeMover) {
    return null;
  }

  const moderar = async (acao: Parameters<typeof moderarVoz>[2]) => {
    if (await moderarVoz(serverId, userId, acao)) toast({ tipo: "info", titulo: comum.confirmar });
  };

  const castigar = async (minutos: number) => {
    const r = await castigarEmLote(serverId, [userId], { minutos });
    const falha = r.falhas[0];
    if (falha) toast({ tipo: "erro", titulo: t.recusou, descricao: falha.motivo });
    else toast({ tipo: "info", titulo: minutos === 0 ? t.tirouCastigo(nome) : t.castigou(nome) });
  };

  return (
    <MenuSuspenso>
      <GatilhoDoMenu asChild>
        <Botao variante="fantasma" tamanho="sm" icone={<MaisHorizontal />} aria-label={t.acoes(nome)} />
      </GatilhoDoMenu>
      <ConteudoDoMenu align="end">
        {podeCargos && (
          <ItemDeMenu
            onSelect={() => {
              aoAbrir({ tipo: "cargos", userId, nome });
            }}
          >
            {t.gerenciarCargos}
          </ItemDeMenu>
        )}
        {podeCastigar && (
          <>
            {podeCargos && <SeparadorDeMenu />}
            <RotuloDeMenu>{t.castigo}</RotuloDeMenu>
            {CASTIGOS.map((c) => (
              <ItemDeMenu
                key={c.minutos}
                onSelect={() => {
                  void castigar(c.minutos);
                }}
              >
                {c.rotulo}
              </ItemDeMenu>
            ))}
            {castigado && (
              <ItemDeMenu
                onSelect={() => {
                  void castigar(0);
                }}
              >
                {t.tirarCastigo}
              </ItemDeMenu>
            )}
          </>
        )}
        {(podeMudo || podeSurdo || podeMover) && (
          <>
            <SeparadorDeMenu />
            {podeMudo && (
              <ItemDeMenu
                onSelect={() => {
                  void moderar({ tipo: "mudo", ligar: true });
                }}
              >
                {t.silenciarNaVoz}
              </ItemDeMenu>
            )}
            {podeSurdo && (
              <ItemDeMenu
                onSelect={() => {
                  void moderar({ tipo: "surdo", ligar: true });
                }}
              >
                {t.ensurdecerNaVoz}
              </ItemDeMenu>
            )}
            {podeMover &&
              voz
                .filter((id) => id !== salaDela)
                .map((id) => (
                  <ItemDeMenu
                    key={id}
                    onSelect={() => {
                      void moverParaCanalDeVoz(serverId, userId, id);
                    }}
                  >
                    {t.moverPara} <NomeDoCanal id={id} />
                  </ItemDeMenu>
                ))}
            {podeMover && (
              <ItemDeMenu
                onSelect={() => {
                  void moderar({ tipo: "desconectar" });
                }}
              >
                {t.desconectarDaSala}
              </ItemDeMenu>
            )}
          </>
        )}
        {(podeExpulsar || podeBanir) && <SeparadorDeMenu />}
        {podeExpulsar && (
          <ItemDeMenu
            variante="perigo"
            onSelect={() => {
              aoAbrir({ tipo: "expulsar", userId, nome });
            }}
          >
            {t.expulsar}
          </ItemDeMenu>
        )}
        {podeBanir && (
          <ItemDeMenu
            variante="perigo"
            onSelect={() => {
              aoAbrir({ tipo: "banir", userId, nome });
            }}
          >
            {t.banir}
          </ItemDeMenu>
        )}
      </ConteudoDoMenu>
    </MenuSuspenso>
  );
}

function LinhaDaPessoa({
  serverId,
  userId,
  aoAbrir,
  cargos,
}: {
  serverId: string;
  userId: string;
  aoAbrir: (acao: Acao) => void;
  cargos: ReturnType<typeof cargosDoServidor>;
}) {
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const [agora] = useState(() => Date.now());
  if (!membro) return null;
  const meus = cargos.filter((c) => membro.cargosIds.includes(c.id));
  const castigo = restante(membro.silenciadoAte, agora);
  return (
    <li className={css.linha} data-testid="linha-de-membro" data-pessoa={userId}>
      <span className={css.pessoa}>
        <Avatar nome={membro.displayName} id={userId} tamanho={32} imagem={membro.avatarUrl} />
        <span className={css.pessoaTextos}>
          <span className={css.pessoaNome}>{membro.displayName}</span>
          <span className={css.pessoaMeta}>
            {castigo !== undefined ? t.castigoPor(castigo) : `@${membro.username}`}
          </span>
        </span>
      </span>
      <span className={css.chips}>
        {meus.length === 0 ? (
          <span className={css.meta}>{t.semCargo}</span>
        ) : (
          meus.map((c) => (
            <span key={c.id} className={css.chip}>
              <span className={css.chipPonto} style={c.cor ? { ["--cor" as string]: c.cor } : undefined} aria-hidden="true" />
              {c.nome}
            </span>
          ))
        )}
      </span>
      <span className={`${css.celula} ${css.meta}`}>{membro.entrouEm ?? "—"}</span>
      <span className={css.acoesDaLinha}>
        <MenuDaPessoa
          serverId={serverId}
          userId={userId}
          nome={membro.displayName}
          abaixoDeMim={membro.abaixoDeMim}
          castigado={castigo !== undefined}
          aoAbrir={aoAbrir}
        />
      </span>
    </li>
  );
}

/** Os cargos de uma pessoa: um interruptor por cargo que eu posso dar. */
function DialogoDeCargos({
  serverId,
  alvo,
  aoFechar,
}: {
  serverId: string;
  alvo: Extract<Acao, { tipo: "cargos" }> | undefined;
  aoFechar: () => void;
}) {
  const membro = useMembro(chaveDeMembro(serverId, alvo?.userId ?? ""));
  const topo = meuAlcance(serverId).topo;
  const dar = cargosDoServidor(serverId).filter((c) => c.rank > topo);
  const [ocupado, setOcupado] = useState<string | undefined>();

  return (
    <Dialogo
      open={alvo !== undefined}
      onOpenChange={(a) => {
        if (!a) aoFechar();
      }}
    >
      <ConteudoDoDialogo titulo={t.cargosDe(alvo?.nome ?? "")}>
        <div className={css.formulario}>
          {dar.length === 0 ? (
            <p className={css.dica}>{t.semCargosNoServidor}</p>
          ) : (
            <ul className={css.listaDeCargos}>
              {dar.map((c) => (
                <li key={c.id} className={css.permissao} style={{ border: 0, padding: "var(--vx-space-2) 0" }}>
                  <span>{c.nome}</span>
                  <Interruptor
                    rotulo={c.nome}
                    ligado={membro?.cargosIds.includes(c.id) ?? false}
                    disabled={ocupado === c.id}
                    aoMudar={() => {
                      if (alvo === undefined) return;
                      setOcupado(c.id);
                      void alternarCargo(serverId, alvo.userId, c.id).then(() => {
                        setOcupado(undefined);
                      });
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className={css.rodapeDoDialogo}>
            <Botao onClick={aoFechar}>{comum.fechar}</Botao>
          </div>
        </div>
      </ConteudoDoDialogo>
    </Dialogo>
  );
}

function DialogoDeBanir({
  serverId,
  alvo,
  aoFechar,
}: {
  serverId: string;
  alvo: Extract<Acao, { tipo: "banir" }> | undefined;
  aoFechar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [apagar, setApagar] = useState(false);
  return (
    <Confirmacao
      aberto={alvo !== undefined}
      aoMudar={(a) => {
        if (!a) {
          setMotivo("");
          setApagar(false);
          aoFechar();
        }
      }}
      titulo={t.banirTitulo(alvo?.nome ?? "")}
      texto={t.banirTexto}
      confirmar={t.banir}
      aoConfirmar={async () => {
        if (alvo === undefined) return false;
        const r = await banirEmLote(serverId, [alvo.userId], {
          motivo: motivo.trim() || undefined,
          excluirMensagensDe: apagar ? UM_DIA : 0,
        });
        const falha = r.falhas[0];
        if (falha) {
          toast({ tipo: "erro", titulo: t.recusou, descricao: falha.motivo });
          return false;
        }
        toast({ tipo: "info", titulo: t.baniu(alvo.nome) });
        return true;
      }}
    >
      <div className={css.campo}>
        <label className={css.rotulo} htmlFor="motivo-do-banimento">
          {t.motivo}
        </label>
        <input
          id="motivo-do-banimento"
          className={css.entrada}
          value={motivo}
          maxLength={256}
          onChange={(e) => {
            setMotivo(e.target.value);
          }}
        />
        <p className={css.dica}>{t.motivoAjuda}</p>
      </div>
      <div className={css.verificacao}>
        <Interruptor ligado={apagar} aoMudar={setApagar} rotulo={t.apagarMensagens} />
        <div>
          <span>{t.apagarMensagens}</span>
          <p className={css.dica}>{t.apagarMensagensAjuda}</p>
        </div>
      </div>
    </Confirmacao>
  );
}

/** Membros e moderação (PRD 4.7): cargos, castigo, expulsar e banir. */
export function Membros({ serverId }: { serverId: string }) {
  const ids = useMembrosDoServidor(serverId);
  const [busca, setBusca] = useState("");
  const [cargoFiltro, setCargoFiltro] = useState<string | undefined>();
  const [limite, setLimite] = useState(PAGINA);
  const [acao, setAcao] = useState<Acao | undefined>();
  const cargos = cargosDoServidor(serverId);
  const pessoas = pessoasDoServidor(serverId, ids);

  useEffect(() => {
    void carregarMembros(serverId);
  }, [serverId]);

  const procurado = busca.trim().toLowerCase();
  const visiveis = pessoas.filter(
    (p) =>
      (cargoFiltro === undefined || p.cargosIds.includes(cargoFiltro)) &&
      (procurado === "" ||
        p.nome.toLowerCase().includes(procurado) ||
        p.username.toLowerCase().includes(procurado)),
  );
  const fecharAcao = () => {
    setAcao(undefined);
  };

  return (
    <div className={css.pagina} style={{ maxInlineSize: "none" }}>
      <div className={css.barra}>
        <div className={css.barraEsquerda}>
          <input
            type="search"
            className={css.busca}
            placeholder={t.buscarPlaceholder}
            aria-label={t.buscar}
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
            }}
          />
          <div className={css.chips} role="group" aria-label={t.filtroDeCargo}>
            <button
              type="button"
              className={css.filtro}
              aria-pressed={cargoFiltro === undefined}
              onClick={() => {
                setCargoFiltro(undefined);
              }}
            >
              {t.todosOsCargos}
            </button>
            {cargos.map((c) => (
              <button
                key={c.id}
                type="button"
                className={css.filtro}
                aria-pressed={cargoFiltro === c.id}
                onClick={() => {
                  setCargoFiltro(c.id);
                }}
              >
                {c.nome}
              </button>
            ))}
          </div>
        </div>
        <span className={css.meta} data-testid="total-de-membros">
          {t.total(visiveis.length)}
        </span>
      </div>

      {ids.length === 0 ? (
        <Carregando texto={t.carregando} />
      ) : visiveis.length === 0 ? (
        <Vazio titulo={t.vazio} texto={t.vazioDica} />
      ) : (
        <>
          <ul
            className={css.tabela}
            aria-label={admin.navegacao.membros}
            style={{ ["--colunas" as string]: "minmax(0,1.3fr) minmax(0,1.2fr) minmax(0,0.7fr) auto" }}
          >
            <li className={css.cabecalhoDaTabela} aria-hidden="true">
              <span>{t.pessoa}</span>
              <span>{t.cargos}</span>
              <span>{t.entrouEm}</span>
              <span />
            </li>
            {visiveis.slice(0, limite).map((p) => (
              <LinhaDaPessoa key={p.id} serverId={serverId} userId={p.id} aoAbrir={setAcao} cargos={cargos} />
            ))}
          </ul>
          {visiveis.length > limite && (
            <div>
              <Botao
                variante="secundario"
                onClick={() => {
                  setLimite((l) => l + PAGINA);
                }}
              >
                {t.mostrarMais}
              </Botao>
            </div>
          )}
        </>
      )}

      <DialogoDeCargos serverId={serverId} alvo={acao?.tipo === "cargos" ? acao : undefined} aoFechar={fecharAcao} />
      <DialogoDeBanir serverId={serverId} alvo={acao?.tipo === "banir" ? acao : undefined} aoFechar={fecharAcao} />
      <Confirmacao
        aberto={acao?.tipo === "expulsar"}
        aoMudar={(a) => {
          if (!a) fecharAcao();
        }}
        titulo={t.expulsarTitulo(acao?.nome ?? "")}
        texto={t.expulsarTexto}
        confirmar={t.expulsar}
        aoConfirmar={async () => {
          if (acao?.tipo !== "expulsar") return false;
          const r = await expulsarEmLote(serverId, [acao.userId], {});
          const falha = r.falhas[0];
          if (falha) {
            toast({ tipo: "erro", titulo: t.recusou, descricao: falha.motivo });
            return false;
          }
          toast({ tipo: "info", titulo: t.expulsou(acao.nome) });
          return true;
        }}
      />
    </div>
  );
}
