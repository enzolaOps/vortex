import { ArrowLeft, Check, Minus, X } from "../../components/ui/icones";
import { useEffect, useId, useState } from "react";

import { Banner } from "../../components/ui/Banner";
import { Botao } from "../../components/ui/Botao";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/DropdownMenu";
import { Interruptor } from "../../components/ui/Interruptor";
import {
  categoriaDoCanal,
  conjuntoDoCanal,
  diferencasDoCanal,
  divergencias,
  sincronizarComCategoria,
  temSobreposicoes,
  type ConjuntoDeSobreposicoes,
} from "../../sdk/categorias";
import { pode } from "../../sdk/permissoes";
import { salvarPermissaoDeCanal, type OverrideDeCanal } from "../../sdk/canal";
import { BIT_VER_CANAL } from "../../sdk/bits";
import {
  baseDoServidor,
  bitDaPermissao,
  listarCargos,
  meuAlcance,
  PERMISSOES,
  type Cargo,
} from "../../sdk/cargos";
import {
  acimaDaMinhaHierarquia,
  MOTIVO_HIERARQUIA,
} from "../selecaoDeCargo";
import { useCategorias, useChannel, useCorDeCargo } from "../../store/hooks";
import secao from "../Secao.module.css";
import { CampoDeBusca } from "../../components/ui/CampoDeBusca";
import { ListaDeDiff } from "../ListaDeDiff";
import {
  ALVO_EVERYONE,
  alvosDaMatriz,
  aplicar,
  canalPrivado,
  cargosComAcessoExplicito,
  cargosParaAdicionar,
  contarDecisoes,
  estadoDe,
  herdado,
  notaDoAlvo,
  overrideDoAlvo,
  procedencia,
  resumoDeAcesso,
  rotuloDeAcesso,
  tomDaContagem,
  totalDeDecisoes,
  type Estado,
} from "./acessoDoCanal";
import css from "./Canal.module.css";

/**
 * Permissões do canal.
 *
 * ⚠ **A matriz tri-state NÃO é esta tela, e eu tinha entregue como se fosse.**
 * Medido com `pnpm espelho`: Permissões mostra o cartão "Canal privado" e a
 * LISTA de quem tem acesso; a matriz mora numa subpágina atrás de "Permissões
 * avançadas", com cabeçalho próprio, coluna de alvos de 264px e cabeçalhos de
 * grupo grudados. São duas telas, não uma.
 *
 * A separação tem razão de produto: a pergunta comum é "quem entra aqui", e
 * ela se responde com uma lista de cinco linhas. A matriz de trinta bits por
 * cargo é a pergunta rara, e pôr as duas juntas faz a rara esconder a comum.
 *
 * **O banner de dessincronização entra, e depende do fork.** Categoria com
 * permissões é do serviço `api` do Vortex (`Category.role_permissions`); o
 * banner compara o conjunto do canal com o da categoria que o contém e diz
 * quantos ALVOS divergem.
 *
 * ⚠ **Só aparece quando a categoria TEM sobreposições.** Categoria sem
 * nenhuma é o caso de todo servidor Stoat de fábrica, e ali qualquer canal
 * com um override "diverge" — um aviso amarelo em todo canal com permissão
 * própria seria ruído permanente, não informação.
 */
export function PermissoesDoCanal({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  const serverId = canal?.serverId;

  const [cargos, setCargos] = useState<readonly Cargo[]>([]);
  /** O alvo aberto na matriz; `undefined` = a página simples. */
  const [avancadas, setAvancadas] = useState<string | undefined>(undefined);
  /**
   * Cargos que alguém acrescentou e ainda não decidem nada. Mora AQUI, e não
   * na matriz, porque "Adicionar" da página simples também acrescenta — e o
   * cargo escolhido lá precisa aparecer na coluna de alvos de cá.
   */
  const [adicionados, setAdicionados] = useState<ReadonlySet<string>>(new Set());
  /*
    Contador de escrita: o par de um cargo mora em `role_permissions`, que o
    snapshot do canal não carrega — então uma escrita confirmada não acorda
    esta tela sozinha. Um número que sobe depois de cada escrita basta.
  */
  const [, setEscritas] = useState(0);
  const [verDiferenca, setVerDiferenca] = useState(false);
  const idDaDiferenca = useId();
  /* Assinado só para acordar quando as sobreposições da categoria mudam — elas
     chegam num `ServerUpdate` de `categories`, que é o que este store publica. */
  useCategorias(serverId ?? "");

  useEffect(() => {
    if (!serverId) return;
    let vivo = true;
    void listarCargos(serverId).then((c) => {
      if (vivo) setCargos(c);
    });
    return () => {
      vivo = false;
    };
  }, [serverId]);

  if (!canal) {
    return <p className={secao.recado}>Abra um canal para ver isto.</p>;
  }
  if (!serverId) {
    return (
      <p className={secao.recado}>
        Conversas diretas não têm cargos — as permissões delas são as das
        pessoas na conversa.
      </p>
    );
  }

  const conjunto = conjuntoDoCanal(channelId);
  const categoria = categoriaDoCanal(channelId);
  const podeEditar = pode(channelId, "gerenciarPermissoes");
  const podeSincronizar = categoria !== undefined && podeEditar;
  const divergentes =
    categoria !== undefined && temSobreposicoes(categoria.conjunto)
      ? divergencias(conjunto, categoria.conjunto)
      : 0;
  const sincronizar = podeSincronizar
    ? () => void sincronizarComCategoria(channelId)
    : undefined;
  const salvar = (alvo: string, o: OverrideDeCanal) =>
    salvarPermissaoDeCanal(channelId, alvo, o).finally(() =>
      setEscritas((n) => n + 1),
    );
  const acrescentar = (id: string) =>
    setAdicionados((a) => new Set(a).add(id));

  if (avancadas !== undefined) {
    return (
      <Avancadas
        serverId={serverId}
        nomeDoCanal={canal.name}
        cargos={cargos}
        conjunto={conjunto}
        categoria={categoria}
        alvoInicial={avancadas}
        adicionados={adicionados}
        aoAcrescentar={acrescentar}
        aoSalvar={salvar}
        aoSincronizar={sincronizar}
        aoVoltar={() => setAvancadas(undefined)}
      />
    );
  }

  /*
    "Canal privado" é `ViewChannel` negado para @everyone — e @everyone mora em
    `default_permissions`, não em `role_permissions["default"]`, que era onde a
    tela lia. Ver `acessoDoCanal.ts`.
  */
  const padrao = overrideDoAlvo(conjunto, ALVO_EVERYONE);
  const privado = canalPrivado(conjunto);
  const explicitos = cargosComAcessoExplicito(conjunto, cargos);
  const paraAdicionar = cargosParaAdicionar(conjunto, cargos, new Set());

  return (
    /* 760 é a largura desta tela no design — ver `.forma.larga`. */
    <div
      className={`${secao.forma} ${secao.larga}`}
      style={{ "--vx-editor-w": "760px" } as React.CSSProperties}
    >
      <p className={secao.recado}>
        Use canal privado para o caso comum. A matriz por cargo fica em
        Permissões avançadas.
      </p>

      {categoria !== undefined && divergentes > 0 ? (
        <Banner
          tom="aviso"
          titulo="Permissões dessincronizadas da categoria"
          acoes={
            <>
              {/*
                ⚠ **Abria a MATRIZ, e a matriz não diz o que difere.** Ela
                mostra o canal inteiro, bit a bit, sem a categoria ao lado — a
                pessoa teria de lembrar o que a categoria decide e comparar de
                cabeça. Agora abre o diff da auditoria (D-CCANAL-10), aqui
                mesmo, logo abaixo do banner: − o que o canal decide, + o que
                "Sincronizar agora" põe no lugar.
              */}
              <Botao
                variante="sutil"
                aria-expanded={verDiferenca}
                aria-controls={idDaDiferenca}
                onClick={() => setVerDiferenca((v) => !v)}
              >
                {verDiferenca ? "Ocultar diferença" : "Ver diferença"}
              </Botao>
              {sincronizar ? (
                <Botao variante="avisoSutil" onClick={sincronizar}>
                  Sincronizar agora
                </Botao>
              ) : null}
            </>
          }
        >
          Este canal tem {divergentes}{" "}
          {divergentes === 1 ? "override próprio" : "overrides próprios"} e não
          segue mais <strong>{categoria.titulo}</strong>. Sincronizar substitui
          os overrides locais pelos da categoria.
        </Banner>
      ) : null}

      {/*
        O diff some junto com o banner: ele é a explicação DO banner, e depois
        de sincronizar não há o que explicar — `divergentes` cai a zero e os
        dois saem no mesmo render (D-CCANAL-10, "some só após sincronizar").
      */}
      {categoria !== undefined && divergentes > 0 && verDiferenca ? (
        <section id={idDaDiferenca} className={css.diferenca}>
          <p className={css.diferencaLegenda}>
            <span className={css.diferencaAntes}>− este canal</span>
            <span className={css.diferencaDepois}>
              + {categoria.titulo}
            </span>
          </p>
          <ListaDeDiff
            rotulo={`Diferença entre este canal e ${categoria.titulo}`}
            linhas={diferencasDoCanal(
              conjunto,
              categoria.conjunto,
              cargos.map((c) => c.id),
              (id) => cargos.find((c) => c.id === id)?.nome ?? "cargo removido",
            )}
          />
        </section>
      ) : null}

      <section className={css.cartaoChave}>
        <span className={css.cartaoTexto}>
          <span className={css.cartaoTitulo}>Canal privado</span>
          <span className={css.cartaoDetalhe}>
            Nega &ldquo;Ver canais&rdquo; para @everyone. Quem tiver um cargo
            com acesso continua entrando.
          </span>
        </span>
        <Interruptor
          rotulo="Canal privado"
          ligado={privado}
          disabled={!podeEditar}
          aoAlternar={() => {
            void salvar(ALVO_EVERYONE, {
              allow: padrao.allow & ~BIT_VER_CANAL,
              deny: privado
                ? padrao.deny & ~BIT_VER_CANAL
                : padrao.deny | BIT_VER_CANAL,
            });
          }}
        />
      </section>

      <section className={css.listaDeAcesso}>
        <header className={css.acessoCabecalho}>
          <span className={css.cartaoTexto}>
            <span className={css.cartaoTitulo}>
              Quem pode acessar este canal?
            </span>
            {/*
              ⚠ O design escreve "4 cargos e 2 membros": override por MEMBRO é
              trabalho que ainda não tem plano (item G de #295), e a contagem
              diz só o que a lista mostra.
            */}
            <span className={css.cartaoDetalhe}>
              {resumoDeAcesso(explicitos.length)}
            </span>
          </span>
          {/*
            "Adicionar" escolhe o CARGO aqui e abre a matriz já nele: dar acesso
            explícito é dar um override, e o override se escolhe bit a bit lá.
            Só os cargos que ainda não decidem nada — oferecer um que já está
            na lista seria um item que não muda nada.
          */}
          {podeEditar ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Botao variante="primario">Adicionar</Botao>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {paraAdicionar.length === 0 ? (
                  <DropdownMenuItem disabled>
                    Todos os cargos já decidem algo aqui
                  </DropdownMenuItem>
                ) : (
                  paraAdicionar.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onSelect={() => {
                        acrescentar(c.id);
                        setAvancadas(c.id);
                      }}
                    >
                      {c.nome}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </header>

        {/* Uma linha só: no design o @everyone não tem subtítulo, e os
            cargos têm. Medido — 43px contra 51. */}
        <LinhaDeAcesso
          cor={undefined}
          glifo="@"
          nome="@everyone"
          detalhe={undefined}
          veredito={rotuloDeAcesso(padrao)}
        />
        {explicitos.map((c) => (
          <LinhaDeAcesso
            key={c.id}
            cor={c.cor}
            glifo="◆"
            nome={c.nome}
            detalhe={`${c.concedidas.length} permissões no servidor`}
            veredito={rotuloDeAcesso(overrideDoAlvo(conjunto, c.id))}
            aoRemover={
              podeEditar
                ? () => {
                    /* Remover é herdar tudo: o cargo deixa de decidir neste
                       canal e volta a valer o que ele vale no servidor. */
                    void salvar(c.id, { allow: 0n, deny: 0n });
                  }
                : undefined
            }
          />
        ))}
      </section>

      {/*
        ⚠ Um CARTÃO, e eu tinha posto dois botões soltos. Dois botões no fim da
        tela leem como ações da lista acima; o cartão lê como um destino, que é
        o que ele é. "Sincronizar com a categoria" saiu daqui — no design ela
        mora dentro do banner de dessincronização.
      */}
      <button
        type="button"
        className={css.cartaoDeAtalho}
        onClick={() => setAvancadas(ALVO_EVERYONE)}
      >
        <span className={css.cartaoTexto}>
          <span className={css.cartaoTitulo}>Permissões avançadas</span>
          <span className={css.cartaoDetalhe}>
            Matriz tri-state por cargo
          </span>
        </span>
        <span className={css.abrir}>Abrir ›</span>
      </button>
    </div>
  );
}

/**
 * Uma linha da lista de acesso.
 *
 * O selo é TINGIDO com a cor do cargo, não preenchido com ela: a cor vem do
 * servidor, e `useCorDeCargo` já a passa pelo clamp de luminosidade que existe
 * desde a auditoria — 22 de 22 nomes reprovavam 4,5:1 no tema claro antes
 * dele. Tingido a 18% funciona com qualquer matiz que sobreviva ao clamp.
 */
function LinhaDeAcesso({
  cor,
  glifo,
  nome,
  detalhe,
  veredito,
  aoRemover,
}: {
  cor: string | undefined;
  glifo: string;
  nome: string;
  detalhe: string | undefined;
  veredito: ReturnType<typeof rotuloDeAcesso>;
  aoRemover?: () => void;
}) {
  const tinta = useCorDeCargo(cor);
  return (
    <div className={css.acessoLinha}>
      <span
        className={css.acessoSelo}
        style={
          tinta
            ? {
                background: `color-mix(in oklab, ${tinta} 18%, transparent)`,
                color: tinta,
              }
            : undefined
        }
        aria-hidden
      >
        {glifo}
      </span>
      <span className={css.acessoNome}>
        {/* O nome sai NA COR do cargo — medido, "Núcleo" em `#7ee3e9`. É o
            mesmo tratamento que a member list dá, e é o que faz a lista de
            acesso ser varrível sem ler. */}
        <span
          className={css.acessoRotulo}
          style={tinta ? { color: tinta } : undefined}
        >
          {nome}
        </span>
        {detalhe ? (
          <span className={css.acessoContagem}>{detalhe}</span>
        ) : null}
      </span>
      {/*
        O veredito sai do par do canal, nunca fixo: antes todo cargo dizia
        "acesso total", inclusive o que o canal nega (D-CCANAL-12).
      */}
      <span
        className={
          veredito.tom === "negado"
            ? css.acessoNegado
            : veredito.tom === "total"
              ? css.acessoEstado
              : css.acessoNeutro
        }
      >
        {veredito.texto}
      </span>
      {/*
        O ✕ existe só nas linhas de CARGO — @everyone não tem, e o design
        também não lhe dá um: não há override a remover de "todo mundo", e um
        alvo que some ao ser acionado seria mentira.
      */}
      {aoRemover ? (
        <button
          type="button"
          className={css.acessoRemover}
          aria-label={`Remover ${nome} deste canal`}
          onClick={aoRemover}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------ permissões avançadas */

const OPCOES: readonly { valor: Estado; rotulo: string }[] = [
  { valor: "negar", rotulo: "Negar" },
  { valor: "herdar", rotulo: "Herdar" },
  { valor: "permitir", rotulo: "Permitir" },
];

/** O glifo de cada estado — o mesmo no botão e na legenda. */
function GlifoDoEstado({ estado }: { estado: Estado }) {
  return estado === "negar" ? (
    <X aria-hidden />
  ) : estado === "herdar" ? (
    <Minus aria-hidden />
  ) : (
    <Check aria-hidden />
  );
}

/**
 * A subpágina da matriz.
 *
 * Cabeçalho com volta e alvo, coluna de 264px com os alvos, matriz à direita
 * com filtro e "Herdar tudo". Os cabeçalhos de grupo GRUDAM — o design escreve
 * isso por extenso, e numa lista de trinta linhas em quatro famílias é o que
 * impede a pessoa de perder de qual família é a linha que está olhando.
 */
function Avancadas({
  serverId,
  nomeDoCanal,
  cargos,
  conjunto,
  categoria,
  alvoInicial,
  adicionados,
  aoAcrescentar,
  aoSalvar,
  aoSincronizar,
  aoVoltar,
}: {
  serverId: string;
  nomeDoCanal: string;
  cargos: readonly Cargo[];
  conjunto: ConjuntoDeSobreposicoes;
  categoria: ReturnType<typeof categoriaDoCanal>;
  alvoInicial: string;
  adicionados: ReadonlySet<string>;
  aoAcrescentar: (id: string) => void;
  aoSalvar: (alvo: string, o: OverrideDeCanal) => Promise<unknown>;
  /** Ausente quando o canal não está em categoria ou falta o direito. */
  aoSincronizar: (() => void) | undefined;
  aoVoltar: () => void;
}) {
  /*
    Lido na render e não assinado: `meuAlcance` consulta o cache do SDK, e a
    tabela de cargos só muda quando alguém edita a hierarquia — que é a mesma
    decisão de "ordenar quando é observável" já tomada na coluna de cargos.
  */
  const alcance = meuAlcance(serverId);
  const [alvo, setAlvo] = useState(alvoInicial);
  const [busca, setBusca] = useState("");
  const [buscaDeAlvo, setBuscaDeAlvo] = useState("");
  const [edicao, setEdicao] = useState<
    { readonly alvo: string; readonly o: OverrideDeCanal } | undefined
  >(undefined);
  const [salvando, setSalvando] = useState(false);

  /*
    O valor do servidor é lido na render e o estado local só existe depois que
    alguém mexeu — carregando o `alvo` junto, para que trocar de cargo o
    invalide sozinho. Sem efeito espelhando estado do servidor, que é o que o
    lint das Rules of React reprovou na primeira versão desta tela.

    O conjunto VIVO aplica a edição local por cima do do canal: a sub-linha de
    um cargo depende do @everyone deste canal, e editar o @everyone tem de se
    refletir nela antes de o servidor responder.
  */
  const vivo: ConjuntoDeSobreposicoes =
    edicao === undefined
      ? conjunto
      : edicao.alvo === ALVO_EVERYONE
        ? { ...conjunto, padrao: edicao.o }
        : { ...conjunto, cargos: { ...conjunto.cargos, [edicao.alvo]: edicao.o } };
  const override = overrideDoAlvo(vivo, alvo);
  const base = baseDoServidor(serverId);

  const escrever = (proximo: OverrideDeCanal) => {
    setEdicao({ alvo, o: proximo });
    setSalvando(true);
    void aoSalvar(alvo, proximo).finally(() => setSalvando(false));
  };

  const coluna = alvosDaMatriz(vivo, cargos, adicionados, buscaDeAlvo);
  const paraAdicionar = cargosParaAdicionar(vivo, cargos, adicionados);
  const nAlvos = (coluna.everyone ? 1 : 0) + coluna.cargos.length;
  const cargoAtual = cargos.find((c) => c.id === alvo);
  const atual =
    alvo === ALVO_EVERYONE || cargoAtual === undefined
      ? { nome: "@everyone", cor: undefined }
      : cargoAtual;
  const filtro = busca.trim().toLowerCase();
  const { permitidas, negadas } = contarDecisoes(override);

  /*
    ⚠ **A linha travada por HIERARQUIA — D-FND-21, e ela não existia.** Os três
    botões só olhavam `salvando`, e `permissions_set.rs` recusa com
    `NotElevated` mexer nas permissões de canal de um cargo no meu nível ou
    acima. Sem a trava, quem modera clicava, via o tri-state mudar e recebia um
    toast de recusa — o estado local já trocado, discordando do servidor.

    `@everyone` fica fora da comparação de rank de propósito: ele não é um
    cargo da hierarquia, não tem `rank`, e o servidor o gateia só por
    `ManagePermissions`. Tratá-lo como rank 0 o travaria para todo mundo que
    não é dono.
  */
  const acima =
    cargoAtual !== undefined && acimaDaMinhaHierarquia(cargoAtual.rank, alcance);
  const travado = acima || !alcance.podeEditarPermissoes;

  return (
    <div className={`${secao.forma} ${secao.larga}`}>
      <header className={css.avancadasTopo}>
        <button type="button" className={css.voltar} onClick={aoVoltar}>
          <ArrowLeft aria-hidden /> Permissões
        </button>
        <h2 className={css.avancadasTitulo}>
          Permissões avançadas{" "}
          <span className={css.avancadasAlvo}>#{nomeDoCanal}</span>
        </h2>
        {aoSincronizar ? (
          <Botao variante="sutil" onClick={aoSincronizar}>
            Sincronizar com a categoria
          </Botao>
        ) : null}
      </header>

      <div className={css.avancadasCorpo}>
        <nav className={css.colunaDeAlvos} aria-label="Alvos">
          {/*
            ⚠ O design busca "Cargos e membros". Override por membro é item G
            de #295 — o campo diz só o que ele encontra.
          */}
          <CampoDeBusca
            className={css.buscaDeAlvos}
            denso
            aria-label="Buscar cargos"
            placeholder="Buscar cargos"
            value={buscaDeAlvo}
            onChange={(e) => setBuscaDeAlvo(e.target.value)}
          />
          <p className={css.grupoDeAlvos}>Cargos — {nAlvos}</p>
          {coluna.everyone ? (
            <ItemDeAlvo
              cor={undefined}
              nome="@everyone"
              override={overrideDoAlvo(vivo, ALVO_EVERYONE)}
              ativo={alvo === ALVO_EVERYONE}
              aoEscolher={() => setAlvo(ALVO_EVERYONE)}
            />
          ) : null}
          {coluna.cargos.map((c) => (
            <ItemDeAlvo
              key={c.id}
              cor={c.cor}
              nome={c.nome}
              override={overrideDoAlvo(vivo, c.id)}
              ativo={c.id === alvo}
              aoEscolher={() => setAlvo(c.id)}
            />
          ))}
          {nAlvos === 0 ? (
            <p className={css.alvosVazio}>Nenhum cargo com esse nome.</p>
          ) : null}
          {/*
            Oferece só quem ainda NÃO está na coluna — a coluna mostra quem
            decide algo aqui, e acrescentar é o primeiro passo de decidir.
          */}
          {alcance.podeEditarPermissoes && paraAdicionar.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={css.adicionarAlvo}>
                  ＋ Adicionar cargo
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {paraAdicionar.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={() => {
                      aoAcrescentar(c.id);
                      setAlvo(c.id);
                    }}
                  >
                    {c.nome}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </nav>

        <div className={css.matrizColuna}>
          <div className={css.matrizTopo}>
            <PontoDoAlvo cor={atual.cor} nome={atual.nome} />
            {/* D-CCANAL-17: de onde este alvo parte, e quanto ele decide. */}
            <span className={css.matrizNota}>{notaDoAlvo(alvo, override)}</span>
            <Botao
              variante="sutil"
              disabled={salvando || travado || totalDeDecisoes(override) === 0}
              onClick={() => escrever({ allow: 0n, deny: 0n })}
            >
              Herdar tudo
            </Botao>
          </div>

          {/* D-CCANAL-20: a legenda dos três glifos e a contagem ao vivo. */}
          <div className={css.legenda}>
            {OPCOES.map((o) => (
              <span key={o.valor} className={css.legendaItem}>
                <span className={css.legendaMarca} data-valor={o.valor} aria-hidden>
                  <GlifoDoEstado estado={o.valor} />
                </span>
                {o.valor === "herdar"
                  ? `herdar ${categoria ? "da categoria" : "do servidor"}`
                  : o.valor === "negar"
                    ? "negar"
                    : "permitir"}
              </span>
            ))}
            <span className={css.legendaContagem}>
              {permitidas} {permitidas === 1 ? "permitida" : "permitidas"} ·{" "}
              {negadas} {negadas === 1 ? "negada" : "negadas"}
            </span>
          </div>

          <div className={css.matrizLista}>
            {/*
              O motivo UMA vez, no topo da matriz — e não trinta vezes, uma por
              linha cinza. É a mesma escolha do editor de cargo: controle
              desabilitado sem explicação é o defeito que "acima da sua
              hierarquia" já registrou neste projeto.
            */}
            {travado ? (
              <Banner tom="aviso">
                {acima
                  ? `${MOTIVO_HIERARQUIA}. Este cargo está no seu nível ou acima dele.`
                  : "Você não pode alterar permissões neste servidor."}
              </Banner>
            ) : null}
            {/*
              O filtro é um campo simples e não o `Campo` de formulário: aqui
              ele é busca, e o design afunda busca em `surface-0` enquanto põe
              campo de formulário em `surface-3`.
            */}
            <CampoDeBusca
              className={css.filtro}
              aria-label="Filtrar permissões"
              placeholder="Filtrar permissões"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />

            {PERMISSOES.map((grupo) => {
              const itens = grupo.itens.filter(
                (p) => filtro === "" || p.rotulo.toLowerCase().includes(filtro),
              );
              if (itens.length === 0) return null;
              return (
                <div key={grupo.titulo}>
                  <p className={css.grupoDaMatriz}>
                    {grupo.titulo}
                    <span className={css.grupoRegua} aria-hidden />
                  </p>
                  {itens.map((p) => {
                    const bit = bitDaPermissao(p.id);
                    const estado = estadoDe(override, bit);
                    return (
                      <div key={p.id} className={css.linhaDePermissao}>
                        {/*
                          ⚠ A segunda linha é PROCEDÊNCIA, não consequência — é
                          a troca que o design faz, e ela é a certa aqui. A
                          consequência ("quem pode expulsar?") é CONSTANTE: ela
                          se lê uma vez e não volta a mudar, então foi para o
                          `title`. A procedência MUDA a cada clique, e no
                          "herdar" ela diz DE ONDE e QUANTO (D-CCANAL-21) —
                          era o texto fixo "Herdando da categoria".
                        */}
                        <span
                          className={css.permissaoTexto}
                          title={p.detalhe}
                        >
                          <span className={css.permissaoNome}>{p.rotulo}</span>
                          <span
                            className={css.permissaoProcedencia}
                            data-estado={estado}
                          >
                            {procedencia(
                              estado,
                              herdado({
                                alvo,
                                bit,
                                canal: vivo,
                                categoria,
                                servidor: base,
                              }),
                            )}
                          </span>
                        </span>
                        <span
                          className={css.triEstado}
                          role="radiogroup"
                          aria-label={p.rotulo}
                        >
                          {OPCOES.map((o) => (
                            <button
                              key={o.valor}
                              type="button"
                              /*
                                ⚠ `role="radio"` com `aria-checked`, e não
                                `aria-pressed`. O pai é um `radiogroup`, e
                                `radiogroup` exige filhos `radio` — com
                                `button`+`aria-pressed` o leitor anuncia "grupo
                                de opções" e depois três alternadores
                                independentes, que é o modelo errado: aqui
                                exatamente um dos três vale por vez.
                              */
                              role="radio"
                              data-valor={o.valor}
                              className={css.triBotao}
                              aria-checked={estado === o.valor}
                              aria-label={o.rotulo}
                              disabled={salvando || travado}
                              title={travado ? MOTIVO_HIERARQUIA : undefined}
                              onClick={() =>
                                escrever(aplicar(override, bit, o.valor))
                              }
                            >
                              <GlifoDoEstado estado={o.valor} />
                            </button>
                          ))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Um alvo na coluna, com o ponto colorido e a CONTAGEM de overrides do design
 * (D-CCANAL-16). A contagem tem cor: só negações em vermelho, só permissões em
 * verde, misturado em neutro — é o que deixa a coluna ser varrida sem abrir
 * cada alvo. Zero não é escrito.
 */
function ItemDeAlvo({
  cor,
  nome,
  override,
  ativo,
  aoEscolher,
}: {
  cor: string | undefined;
  nome: string;
  override: OverrideDeCanal;
  ativo: boolean;
  aoEscolher: () => void;
}) {
  const tinta = useCorDeCargo(cor);
  const tom = tomDaContagem(override);
  const n = totalDeDecisoes(override);
  return (
    <button
      type="button"
      className={css.alvo}
      aria-current={ativo}
      onClick={aoEscolher}
    >
      <span
        className={css.pontoDeCargo}
        style={{ background: tinta ?? "var(--vx-neutral)" }}
        aria-hidden
      />
      <span className={css.alvoNome}>{nome}</span>
      {tom ? (
        <span
          className={css.alvoContagem}
          data-tom={tom}
          aria-label={`${n} ${n === 1 ? "override" : "overrides"}`}
        >
          {n}
        </span>
      ) : null}
    </button>
  );
}

/** O mesmo ponto, no topo da matriz. */
function PontoDoAlvo({
  cor,
  nome,
}: {
  cor: string | undefined;
  nome: string;
}) {
  const tinta = useCorDeCargo(cor);
  return (
    <span className={css.matrizNome}>
      <span
        className={css.pontoDeCargo}
        style={{ background: tinta ?? "var(--vx-neutral)" }}
        aria-hidden
      />
      {nome}
    </span>
  );
}
