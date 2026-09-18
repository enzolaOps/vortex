import { useEffect, useMemo, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Caixa } from "../components/ui/Marcador";
import { Campo } from "../components/ui/Campo";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { SeletorDeCor } from "../components/ui/SeletorDeCor";
import {
  apagarCargo,
  criarCargo,
  lerPermissoesPadrao,
  meuAlcance,
  pessoasDoServidor,
  reordenarCargos,
  listarCargos,
  PERMISSOES,
  salvarCargo,
  salvarPermissoes,
  salvarPermissoesPadrao,
  type Alcance,
  type Cargo,
  type PessoaParaCargo,
} from "../sdk/cargos";
import {
  cargoMovivel,
  MOTIVO_HIERARQUIA,
  reordenacaoPermitida,
} from "./selecaoDeCargo";
import { toast } from "../components/ui/toastStore";
import { IconeDoCargo } from "./IconeDoCargo";
import { IconeDeCargo } from "../membros/IconeDeCargo";
import { MembrosDoCargo } from "./MembrosDoCargo";
import css from "./Secao.module.css";
import cargoCss from "./Cargos.module.css";
import { CaretRight, Lock } from "../components/ui/icones";
import { CampoDeBusca } from "../components/ui/CampoDeBusca";
import {
  useCorDeCargo,
  useMembrosDoServidor,
  usePinturaDeCargo,
} from "../store/hooks";
import {
  ehHolografico,
  FIM_DO_GRADIENTE,
  gradienteParaGravar,
  HOLOGRAFICO,
  lerGradiente,
  TINTA_HOLOGRAFICA,
  type PinturaDeCargo,
} from "../tema/cargo";
import { propsDoNome } from "../membros/pinturaDoNome";
import { LinhaDeAjuste } from "./Pagina";
import { LinksDoCargo } from "./LinksDoCargo";
import { Abas } from "../components/ui/Abas";
import { Interruptor } from "../components/ui/Interruptor";
import { Banner } from "../components/ui/Banner";
import { cn } from "../lib/cn";
import { Avatar } from "../components/ui/Avatar";

/**
 * Cargos e o que cada um pode fazer.
 *
 * A tela mais densa do plano de paridade — no upstream é um editor de bitmask
 * de 596 linhas. O que a torna administrável aqui é a camada de tradução: a
 * lista de `PERMISSOES` agrupa por pergunta que alguém de fato faz ("quem pode
 * expulsar?"), e nenhum `BigInt` chega ao componente.
 *
 * ⚠ **É uma lista CURADA, não o espelho do protocolo.** `GrantAllSafe` ficou
 * de fora por ser um atalho perigoso de um clique, e `Masquerade` por ser de
 * bot. Uma tela que espelha campo a campo vira despejo de bits.
 *
 * ⚠ **Arrastar reordena de verdade, e a justificativa contra ENVELHECEU.** O
 * comentário aqui dizia "sem arrastar, porque `DataEditRole.rank` não tem
 * efeito". A primeira metade segue verdadeira — o campo é documentado como
 * *"**Removed** - no effect"* no próprio `DataEditRole` —, mas a conclusão
 * não: quem reordena é `PATCH /servers/:id/roles/ranks`, que `reordenarCargos`
 * já chamava por `setRoleOrdering`. O que faltava não era a escrita, era a
 * TRAVA: o servidor recusa com `NotElevated` qualquer reordenação que mexa na
 * posição de um cargo no seu nível ou acima (`roles_edit_positions.rs`), e a
 * tela não conhecia essa regra — ela reordenava otimista e só descobria depois.
 */
/**
 * Uma linha da hierarquia.
 *
 * ⚠ **Componente próprio porque o NOME sai na cor do cargo**, e essa cor
 * precisa passar pelo clamp — `useCorDeCargo` é hook, e hook dentro do
 * `.map()` do pai não é hook. É a mesma razão de `NomeDoAutor` e
 * `AvatarDoAutor` existirem.
 *
 * ⚠ **O clamp não é zelo:** a cor vem do SERVIDOR e vai direto ao DOM por
 * `style`, onde o `pnpm contrast` não a enxerga. Sem ele volta o furo que a
 * fase 5 fechou — medido na época, 22 de 22 nomes reprovando 4,5:1 no tema
 * claro.
 */
function LinhaDeCargo({
  cargo,
  ativa,
  travado,
  contagem,
  aoEscolher,
  onKeyDown,
  aoArmarArraste,
}: {
  cargo: Cargo;
  ativa: boolean;
  /** Acima do meu cargo mais alto, ou sem `ManageRole`. */
  travado: boolean;
  contagem: number;
  aoEscolher: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  aoArmarArraste: (() => void) | undefined;
}) {
  const cor = useCorDeCargo(cargo.cor);

  return (
    <button
      type="button"
      className={cargoCss.cargo}
      aria-current={ativa}
      /*
        ⚠ **Travado NÃO é `disabled`, e a diferença é o que a linha serve
        para fazer.** Ela é o SELETOR do editor à direita: desabilitá-la
        tiraria de quem modera a capacidade de LER as permissões de um cargo
        acima do seu, que é informação legítima. O que trava é o gesto de
        MOVER e a edição no editor — e o cadeado diz qual dos dois.

        `data-travado` e `title` em vez de esconder a linha: um cargo que
        some da hierarquia faz a pessoa acreditar que ele não existe, que é
        pior que um cadeado.
      */
      data-travado={travado || undefined}
      title={travado ? MOTIVO_HIERARQUIA : undefined}
      onClick={aoEscolher}
      onKeyDown={onKeyDown}
    >
      {/*
        A alça de arraste do design.

        ⚠ **`span` e não `button`, e é regra deste repositório:** a linha
        inteira já é um `<button>`, e botão dentro de botão é HTML inválido —
        o navegador reestrutura a árvore e o clique de dentro aciona os dois.
        O gesto de teclado mora no botão da linha (`Alt` + setas), então a
        alça não precisa de foco próprio; ela só ARMA o arraste no
        `pointerdown`, sem o qual a linha inteira seria arrastável.

        Travada, ela vira cadeado — o 🔒 do design, com opacidade 0,6 no CSS.
      */}
      <span
        aria-hidden
        className={cargoCss.alca}
        data-travada={travado || undefined}
        onPointerDown={aoArmarArraste}
      >
        {travado ? <Lock aria-hidden /> : "⠿"}
      </span>
      <span
        className={cargoCss.bolinha}
        aria-hidden
        style={cor ? { background: cor } : undefined}
      />
      <span className={cargoCss.nomeDoCargo} style={cor ? { color: cor } : undefined}>
        {cargo.nome}
      </span>
      {/*
        ⚠ **O `⋯` da referência NÃO entrou, e é divergência deliberada.** Lá
        ele é um ícone solto dentro do botão, sem menu nenhum — decoração de
        mockup. Aqui um alvo que recebe foco e não faz nada é exatamente o que
        o lint de `onSelect` foi instalado para matar, e as ações que ele
        carregaria (apagar o cargo) já vivem no editor à direita.
      */}
      <span className={cargoCss.contagemDeMembros}>{contagem}</span>
    </button>
  );
}

/**
 * A seleção do `@everyone` na coluna.
 *
 * Um valor fora do espaço de IDs de cargo — eles são ULID, e `@` não é
 * caractere de ULID —, então a mesma `useState` escolhe entre "um cargo" e
 * "as permissões padrão" sem um segundo estado que precise concordar com o
 * primeiro.
 */
const EVERYONE = "@everyone";

export function Cargos({ serverId }: { serverId: string }) {
  const membrosDoServidor = useMembrosDoServidor(serverId);
  const [lista, setLista] = useState<readonly Cargo[] | undefined>(undefined);
  const [selecionado, setSelecionado] = useState<string | undefined>(undefined);
  const [novo, setNovo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  /*
    O arraste, em dois estados.

    ⚠ **A lista NÃO reordena enquanto a mão está no caminho**, ao contrário
    da enquete: lá o commit é local e de graça, aqui cada passagem por uma
    linha seria um `PATCH` da hierarquia inteira. Então `arrastando` marca o
    fantasma (60%, do design) e `destino` desenha a linha de acento onde ele
    vai cair; o commit acontece uma vez, no soltar.
  */
  const [arrastando, setArrastando] = useState<string | undefined>(undefined);
  const [destino, setDestino] = useState<string | undefined>(undefined);

  function recarregar() {
    void listarCargos(serverId).then((l) => {
      setLista(l);
      // Mantém a seleção se o cargo ainda existir; senão cai no primeiro.
      // O `@everyone` não é cargo da lista e não "deixa de existir".
      setSelecionado((s) =>
        s === EVERYONE || (s && l.some((c) => c.id === s)) ? s : l[0]?.id,
      );
    });
  }

  useEffect(() => {
    if (!serverId) return;
    let vivo = true;
    void listarCargos(serverId).then((l) => {
      if (!vivo) return;
      setLista(l);
      setSelecionado(l[0]?.id);
    });
    return () => {
      vivo = false;
    };
  }, [serverId]);

  /*
    Quantas pessoas têm cada cargo.

    ⚠ **Fica ANTES dos `return` de guarda, e o lint me pegou pondo depois.**
    Hook chamado condicionalmente muda a ordem entre renders — a regra do
    React, não estilo. Aqui o efeito seria pior que um aviso: com `serverId`
    vazio o componente sai cedo, e o `useMemo` deixaria de existir naquele
    render.

    ⚠ **Lido do SDK e não com um hook por membro.** Um `useMembro` por pessoa
    assinaria a member list inteira dentro de uma tela de configuração — num
    servidor de dez mil, dez mil subscrições para desenhar três números.

    ⚠ **Era `members.getSnapshot` e passou a ser `pessoasDoServidor`**, a mesma
    fonte da aba "Gerenciar membros". Com as duas lendo de lugares diferentes,
    o número da coluna e o do cabeçalho da aba discordavam — e o snapshot só
    existe para quem alguém assinou, então a coluna contava menos do que havia.

    ⚠ **A contagem NÃO acompanha mudança feita por OUTRA pessoa** com a tela
    aberta. As feitas daqui avisam por `versaoDeMembros`, que é o único motivo
    de ela estar entre as dependências.
  */
  /*
    ⚠ **A releitura depois de uma escrita chega como ESTADO, e não como um
    contador de versão numa dependência.** A primeira versão fazia
    `useMemo(() => pessoasDoServidor(serverId), [serverId, versao])`, e o React
    Compiler memoiza pelo que o corpo USA: `pessoasDoServidor(serverId)` com o
    mesmo `serverId` saía do cache, a versão era ignorada, e a aba adicionava
    três pessoas enquanto a coluna seguia dizendo 1. Medido no navegador.
    Função externa com os mesmos argumentos é, para o compilador, o mesmo
    resultado — a mudança precisa entrar como dado.
  */
  const [relidas, setRelidas] = useState<
    { ids: readonly string[]; pessoas: readonly PessoaParaCargo[] } | undefined
  >(undefined);
  /* A releitura vale enquanto a lista de membros for a mesma de quando ela foi
     feita; hidratar ou entrar alguém troca a lista e a leitura volta a ser a
     do render. */
  const pessoas =
    relidas?.ids === membrosDoServidor
      ? relidas.pessoas
      : pessoasDoServidor(serverId, membrosDoServidor);
  const contagens = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pessoas) {
      for (const id of p.cargosIds) {
        m.set(id, (m.get(id) ?? 0) + 1);
      }
    }
    return m;
  }, [pessoas]);
  const totalDeMembros = pessoas.length;

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  if (lista === undefined) {
    return <p className={css.recado}>Carregando…</p>;
  }

  /*
    ⚠ **`cargos` e não `lista` dentro de `mover`.** O `if` acima estreita
    `lista` para o corpo, mas não para dentro de uma função declarada aqui —
    ela poderia ser chamada depois, e o TypeScript está certo em recusar.
    Capturar o valor já estreitado numa const resolve sem asserção.
  */
  const cargos = lista;
  const cargo = cargos.find((c) => c.id === selecionado);
  const alcance = meuAlcance(serverId);

  /*
    O filtro é do CLIENTE: a lista inteira já veio numa chamada, e uma volta
    ao servidor por caractere digitado seria rede para reordenar o que está na
    tela. Mesma decisão dos filtros da auditoria.
  */
  const termo = busca.trim().toLowerCase();
  const visiveis =
    termo === "" ? cargos : cargos.filter((c) => c.nome.toLowerCase().includes(termo));

  /**
   * Move um cargo na hierarquia.
   *
   * ⚠ **Uma função para os DOIS caminhos** — hoje o teclado, amanhã o arraste.
   * É o que a enquete já provou neste projeto: com a lógica de mover separada
   * do gesto, ponteiro e teclado chegam ao mesmo lugar por construção, em vez
   * de por alguém lembrar de escrever as duas.
   *
   * ⚠ **Manda a lista COMPLETA para `reordenarCargos`.** O protocolo reordena
   * pelo array inteiro, porque rank é posição relativa: mover um cargo muda o
   * rank de todos entre a origem e o destino.
   *
   * ⚠ **Não move com filtro ativo.** Com a lista filtrada, "o vizinho de cima"
   * na tela não é o vizinho de cima na hierarquia — o gesto acertaria uma
   * posição que a pessoa não está vendo. Melhor recusar que errar em silêncio.
   *
   * ⚠ **A HIERARQUIA é conferida antes de escrever, e não depois de o servidor
   * recusar.** `reordenacaoPermitida` espelha `roles_edit_positions.rs`:
   * nenhum cargo no meu nível ou acima pode MUDAR DE POSIÇÃO. Sem isso o
   * otimismo mostrava a lista reordenada, o `PATCH` voltava `NotElevated`, e a
   * recarga a desfazia — um movimento que acontece e volta sozinho, que é
   * exatamente o "parece funcionar e não salva" que o comentário do topo
   * temia. Aqui o gesto é recusado com o motivo escrito.
   */
  function mover(id: string, destinoId: string) {
    if (termo !== "" || ocupado) return;
    const i = cargos.findIndex((c) => c.id === id);
    const j = cargos.findIndex((c) => c.id === destinoId);
    if (i < 0 || j < 0 || i === j) return;

    const nova = [...cargos];
    const [movido] = nova.splice(i, 1);
    if (!movido) return;
    nova.splice(j, 0, movido);

    const ids = nova.map((c) => c.id);
    if (!reordenacaoPermitida(cargos, ids, alcance)) {
      toast({
        tipo: "erro",
        titulo: "Não dá para mover por aí.",
        descricao:
          "Você só reordena cargos abaixo do seu mais alto — e sem deslocar os de cima.",
      });
      return;
    }

    /* Otimista: a lista reordena na hora e o servidor confirma. Sem isso,
       cada Alt+seta esperaria uma volta de rede antes de a tela responder. */
    setLista(nova);
    setOcupado(true);
    void reordenarCargos(serverId, ids)
      .then((ok) => {
        /* Falhou: o servidor é a verdade, e recarregar é mais honesto que
           tentar desfazer o splice — o estado de lá pode ter mudado por outra
           razão no meio do caminho. */
        if (!ok) recarregar();
      })
      .finally(() => setOcupado(false));
  }

  /** Uma casa acima ou abaixo — o caminho de teclado, sobre o mesmo `mover`. */
  function empurrar(id: string, passo: -1 | 1) {
    const i = cargos.findIndex((c) => c.id === id);
    const vizinho = cargos[i + passo];
    if (!vizinho) return;
    mover(id, vizinho.id);
  }

  return (
    <div className={cargoCss.tela}>
      {/*
        A coluna mestre — 300px, do design e da referência.

        ⚠ **Ela é o TERCEIRO painel das páginas de Pessoas, e o design anota
        por que existe:** ela substitui o padrão de "voltar" e mantém o
        contexto de hierarquia enquanto o editor está aberto. Sem ela, escolher
        outro cargo exigiria sair do editor.
      */}
      <div className={cargoCss.coluna}>
        <div className={cargoCss.cabecalho}>
          <div className={cargoCss.tituloDaColuna}>
            <span className={cargoCss.tituloTexto}>Cargos</span>
            <span className={cargoCss.contagem}>{lista.length}</span>
            <Botao
              variante="primario"
              onClick={() => {
                setCriando((v) => !v);
              }}
            >
              Criar cargo
            </Botao>
          </div>

          {/*
            ⚠ **`input` de verdade, e não o `button` da coluna de canais.**
            Aquele abre a paleta e por isso não pode aceitar digitação; este
            filtra uma lista que já está na tela. A armadilha registrada é
            juntar os dois num primitivo só — são coisas diferentes.
          */}
          <CampoDeBusca
            aria-label="Buscar cargo"
            placeholder="Buscar cargo"
            value={busca}
            onChange={(e) => {
              setBusca(e.currentTarget.value);
            }}
          />
        </div>

        {criando ? (
          <form
            className={cargoCss.criar}
            onSubmit={(e) => {
              e.preventDefault();
              const nome = novo.trim();
              if (!nome || ocupado) return;
              setOcupado(true);
              void criarCargo(serverId, nome)
                .then((id) => {
                  if (!id) return;
                  setNovo("");
                  setCriando(false);
                  recarregar();
                })
                .finally(() => setOcupado(false));
            }}
          >
            <Campo
              rotulo="Nome do cargo"
              autoComplete="off"
              autoFocus
              disabled={ocupado}
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
            />
            <Botao variante="neutro" type="submit" disabled={!novo.trim() || ocupado}>
              Criar
            </Botao>
          </form>
        ) : null}

        <div className={cargoCss.rolagem}>
          {/*
            `@everyone` — a base de toda a cadeia.

            ⚠ **Tracejado e fora da lista de propósito.** Ele não é um cargo
            que se arrasta nem se apaga: é o piso sobre o qual os outros
            somam. Pô-lo dentro da hierarquia daria um item que recusa metade
            dos gestos que os vizinhos aceitam — e recusar em silêncio é o
            defeito que o registro de pendências existe para evitar.
          */}
          <button
            type="button"
            className={cargoCss.everyone}
            aria-current={selecionado === EVERYONE}
            onClick={() => {
              setSelecionado(EVERYONE);
            }}
          >
            <span className={cargoCss.bolinha} aria-hidden />
            <span className={cargoCss.everyoneTextos}>
              <span className={cargoCss.everyoneNome}>Permissões padrão</span>
              <span className={cargoCss.everyoneDetalhe}>
                @everyone · base de toda a cadeia
              </span>
            </span>
            <CaretRight aria-hidden />
          </button>

          <div className={cargoCss.hierarquia}>
            <span className={cargoCss.hierarquiaRotulo}>Hierarquia</span>
            <span className={cargoCss.hierarquiaDica}>
              arraste ⠿ ou Alt + ↑ ↓ para mover
            </span>
          </div>

          {visiveis.length === 0 ? (
            <EstadoVazio
              compacto
              titulo={busca ? "Nenhum cargo com esse nome" : "Nenhum cargo"}
              detalhe={
                busca ? "Afrouxe a busca." : "Crie um para separar quem pode o quê."
              }
            />
          ) : (
            <ul className={cargoCss.cargos}>
              {visiveis.map((c) => {
                const travado = !cargoMovivel(c.rank, alcance);
                return (
                  /*
                    ⚠ **O `draggable` mora no `<li>` e não na alça.** Arrastar
                    uma alça de 14px move um fantasma de 14px; o que a pessoa
                    espera ver seguindo o ponteiro é a LINHA. É a mesma
                    divisão da enquete: a alça arma, a linha arrasta.

                    ⚠ **E nunca com filtro ativo**: com a lista filtrada, a
                    linha sob o ponteiro não é a vizinha na hierarquia, e o
                    gesto acertaria uma posição que ninguém está vendo. É a
                    mesma recusa que `mover` já fazia pelo teclado.
                  */
                  <li
                    key={c.id}
                    draggable={arrastando === c.id}
                    data-arrastando={arrastando === c.id || undefined}
                    data-destino={
                      arrastando !== undefined && destino === c.id && arrastando !== c.id
                        ? true
                        : undefined
                    }
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      /* Firefox só inicia o arraste se houver carga. */
                      e.dataTransfer.setData("text/plain", c.id);
                    }}
                    onDragOver={(e) => {
                      if (arrastando === undefined) return;
                      e.preventDefault();
                      setDestino(c.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (arrastando !== undefined) mover(arrastando, c.id);
                      setArrastando(undefined);
                      setDestino(undefined);
                    }}
                    onDragEnd={() => {
                      setArrastando(undefined);
                      setDestino(undefined);
                    }}
                  >
                    <LinhaDeCargo
                      cargo={c}
                      ativa={c.id === selecionado}
                      travado={travado}
                      contagem={contagens.get(c.id) ?? 0}
                      aoEscolher={() => {
                        setSelecionado(c.id);
                      }}
                      aoArmarArraste={
                        travado || termo !== ""
                          ? undefined
                          : () => setArrastando(c.id)
                      }
                      /*
                        ⚠ **Reordenar por TECLADO primeiro, e o arraste soma
                        depois.** É a regra que a enquete já estabeleceu neste
                        projeto: reordenar que só funciona com mouse é o
                        defeito que a auditoria apontou na paleta de comandos.
                        `Alt` e não seta pura, senão a navegação entre os
                        cargos deixaria de existir.
                      */
                      onKeyDown={(e) => {
                        if (!e.altKey) return;
                        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                        e.preventDefault();
                        empurrar(c.id, e.key === "ArrowUp" ? -1 : 1);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {/*
            O aviso de hierarquia, do design. Ele explica por que alguns cargos
            não respondem — e um item que não responde SEM explicação é o
            defeito que "acima da sua hierarquia" já registrou.
          */}
          {/*
            ⚠ **"Cargos de integração" SAIU do aviso, e isso é conserto de uma
            afirmação falsa.** O design os desenha travados com 🔒, e o texto
            aqui os prometia — mas `Role` no protocolo tem `_id`, `name`,
            `permissions`, `colour`, `hoist`, `rank`, `icon` e o `mentionable`
            do Vortex, e nada que diga "gerido por um bot". Prometer uma trava
            que nenhum servidor sabe produzir é a família do comentário que
            afirma uma medida que não existe. O cadeado que a coluna mostra é o
            de HIERARQUIA, que é real.
          */}
          <p className={cargoCss.aviso}>
            Você só pode editar e mover cargos abaixo do seu mais alto — os
            acima aparecem com cadeado.
          </p>
        </div>
      </div>

      {selecionado === EVERYONE ? (
        <EditorDePermissoesPadrao
          key={`${serverId}:everyone`}
          serverId={serverId}
          podeEditar={alcance.podeEditarPermissoes}
          total={totalDeMembros}
        />
      ) : cargo ? (
        <EditorDeCargo
          key={cargo.id}
          serverId={serverId}
          cargo={cargo}
          alcance={alcance}
          contagem={contagens.get(cargo.id) ?? 0}
          aoMudar={recarregar}
          aoMudarMembros={(novas) => {
            setRelidas({ ids: membrosDoServidor, pessoas: novas });
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * O fundo tingido da pill de cargo.
 *
 * ⚠ Função e não estilo inline repetido: os dois chips usam o mesmo cálculo, e
 * a segunda cópia é onde a divergência começa. 15% é o número do design.
 */
function propsDaPill(pintura: PinturaDeCargo | undefined): {
  "data-pintura"?: "gradiente" | "holografico";
  style?: React.CSSProperties;
} {
  if (pintura === undefined) return {};
  if (pintura.tipo === "holografico") {
    return {
      "data-pintura": "holografico",
      style: { backgroundImage: pintura.fundo, color: TINTA_HOLOGRAFICA },
    };
  }
  if (pintura.tipo === "gradiente") {
    // O texto vai para `text-1` no CSS; aqui só o dado — as paradas a 33%.
    return { "data-pintura": "gradiente", style: { backgroundImage: pintura.fundo } };
  }
  return {
    style: {
      color: pintura.cor,
      background: `color-mix(in oklab, ${pintura.cor} 15%, transparent)`,
    },
  };
}

/**
 * As seis cores de cargo do design.
 *
 * ⚠ **As três primeiras são os semânticos do app** — acento, sucesso e aviso —
 * e isso não é coincidência do mockup: um cargo colorido aparece ao lado de
 * badges e chips que já usam essa paleta, e uma sétima família brigaria com
 * eles. A última é o cinza de "sem destaque", que continua sendo uma ESCOLHA
 * visível em vez de um estado escondido atrás de uma caixa de seleção.
 *
 * Elas não passam pelo clamp aqui porque são AMOSTRAS — o que se vê é a cor
 * crua, que é o que se está escolhendo. O clamp entra na leitura, em
 * `useCorDeCargo`, que é onde o contraste importa.
 */
const AMOSTRAS = [
  "#35C2CC",
  "#46C98A",
  "#E2B15C",
  "#E8596B",
  "#8B7BE8",
  "#6E7783",
] as const;

/** As quatro vistas do editor, na ordem da referência. */
type AbaDoCargo = "exibicao" | "permissoes" | "links" | "membros";

/**
 * Os três estilos de nome que a referência desenha.
 *
 * ⚠ **Este comentário dizia que nenhum deles existia no protocolo, e estava
 * errado para o gradiente.** `Role` não tem campo de estilo — mas `colour` é
 * validado no servidor por `RE_COLOUR`, que aceita `linear-gradient(...)`
 * explicitamente. O estilo não é GUARDADO: ele é LIDO da forma de `colour`
 * (`lerGradiente`), e é por isso que abrir um cargo já salvo em gradiente abre
 * com "Gradiente" marcado sem campo nenhum a mais. O holográfico é o mesmo
 * mecanismo com as paradas fixas do design (`HOLOGRAFICO`), reconhecido na
 * leitura por `ehHolografico`.
 */
const ESTILOS = [
  { id: "solido", rotulo: "Sólido" },
  { id: "gradiente", rotulo: "Gradiente" },
  { id: "holografico", rotulo: "Holográfico" },
] as const;

type EstiloDeCargo = (typeof ESTILOS)[number]["id"];

function EditorDeCargo({
  serverId,
  cargo,
  alcance,
  contagem,
  aoMudar,
  aoMudarMembros,
}: {
  serverId: string;
  cargo: Cargo;
  alcance: Alcance;
  contagem: number;
  aoMudar: () => void;
  /** A aba de membros escreveu — a coluna recontará a partir destas. */
  aoMudarMembros: (pessoas: readonly PessoaParaCargo[]) => void;
}) {
  const [aba, setAba] = useState<AbaDoCargo>("exibicao");
  const [nome, setNome] = useState(cargo.nome);
  /*
    ⚠ **O estilo nasce da forma de `colour`, e começava sempre em "Sólido".**
    Um cargo salvo em gradiente abriria dizendo "Sólido" com o CSS cru no
    campo hex — e salvar sem mexer em nada o gravaria de volta como lixo.

    `fim` preserva a SEGUNDA parada de um gradiente feito por outro cliente: o
    editor só troca a primeira, e reescrever a segunda com o violeta do design
    mudaria um cargo que ninguém pediu para mudar. Paradas do meio e ângulo
    não sobrevivem a um salvar — a forma gravada é a do design.
  */
  const salvo = lerGradiente(cargo.cor);
  const [cor, setCor] = useState(
    salvo ? salvo.paradas[0]!.hex.toUpperCase() : (cargo.cor ?? "#bcaef2"),
  );
  const [fim] = useState(
    salvo ? salvo.paradas.at(-1)!.hex.toUpperCase() : FIM_DO_GRADIENTE,
  );
  const [colorido, setColorido] = useState(cargo.cor !== undefined);
  const [estilo, setEstilo] = useState<EstiloDeCargo>(
    ehHolografico(salvo)
      ? "holografico"
      : salvo && salvo.direcao !== ""
        ? "gradiente"
        : "solido",
  );
  const [destacado, setDestacado] = useState(cargo.destacado);
  const [mencionavel, setMencionavel] = useState(cargo.mencionavel);
  const [marcadas, setMarcadas] = useState<readonly string[]>(cargo.concedidas);
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  /*
    O que vai para o servidor, e é a MESMA string que a prévia lê — a prévia
    passa pelo caminho de leitura de verdade (`pinturaDeCargo`), então o que
    se vê aqui é o que a lista de membros vai desenhar, clamp incluído.
  */
  const bruta = colorido
    ? estilo === "holografico"
      ? HOLOGRAFICO
      : estilo === "gradiente"
        ? gradienteParaGravar(cor, fim)
        : cor
    : undefined;
  const pintura = usePinturaDeCargo(bruta);
  const corLegivel = pintura?.cor;
  // A faixa do cartão "Gradiente" mostra o gradiente da cor ATUAL mesmo com
  // "Sólido" marcado — é prévia da escolha, como a faixa do cartão sólido.
  const faixaGradiente = usePinturaDeCargo(gradienteParaGravar(cor, fim));

  /*
    ⚠ **A hierarquia trava o EDITOR inteiro, não só o ícone.** Antes só o
    `IconeDoCargo` conferia o rank; a matriz de permissões olhava apenas
    `podeEditarPermissoes`, e `permissions_set.rs` recusa com `NotElevated`
    mexer nas permissões de cargo no meu nível ou acima. O resultado era um
    editor que aceitava tudo e devolvia um toast de recusa ao salvar.
  */
  const travado = !cargoMovivel(cargo.rank, alcance);

  return (
    <div className={cargoCss.editor}>
      {/*
        O cabeçalho, do design: bolinha na cor, "Editar cargo — X" e a
        contagem em mono ao lado.

        ⚠ O nome vem do ESTADO e não do `cargo`, então o título acompanha o
        que está sendo digitado — mesmo princípio da prévia ao vivo.
      */}
      <header className={cargoCss.cabecalhoDoEditor}>
        <span
          aria-hidden
          className={cargoCss.pontoDoEditor}
          style={corLegivel ? { background: corLegivel } : undefined}
        />
        <h2 className={cargoCss.tituloDoEditor}>Editar cargo — {nome}</h2>
        <span className={cargoCss.membrosDoCargo}>
          {contagem} {contagem === 1 ? "membro" : "membros"}
        </span>
      </header>

      {/*
        O motivo, uma vez, no topo — e não repetido em cada controle cinza.
        Trinta bits desabilitados sem explicação é o defeito que
        "acima da sua hierarquia" já registrou neste projeto.
      */}
      {travado ? (
        <Banner tom="aviso">
          {MOTIVO_HIERARQUIA}. Você pode ler este cargo, mas não editá-lo nem
          movê-lo.
        </Banner>
      ) : null}

      <Abas
        rotulo="Editor de cargo"
        valor={aba}
        aoEscolher={setAba}
        itens={[
          { valor: "exibicao", rotulo: "Exibição" },
          { valor: "permissoes", rotulo: "Permissões" },
          { valor: "links", rotulo: "Links" },
          { valor: "membros", rotulo: "Gerenciar membros" },
        ]}
      />

      {aba === "exibicao" ? (
        <div className={cargoCss.duasColunas} data-bloco="editor-de-cargo">
          <div className={cargoCss.formulario}>
            <Campo
              rotulo="Nome do cargo"
              autoComplete="off"
              disabled={salvando}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />

            <div>
              <p className={cargoCss.sobrancelha}>Estilo</p>
              <div className={cargoCss.estilos} role="radiogroup" aria-label="Estilo">
                {ESTILOS.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    role="radio"
                    aria-checked={estilo === op.id}
                    className={cargoCss.estilo}
                    onClick={() => {
                      setEstilo(op.id);
                      // Gradiente e holográfico colorem o nome; escolher um
                      // deles sem cor seria escolher nada.
                      if (op.id !== "solido") setColorido(true);
                    }}
                  >
                    <span
                      aria-hidden
                      className={cn(cargoCss.faixa, cargoCss[op.id])}
                      style={
                        op.id === "solido" && corLegivel
                          ? { background: corLegivel }
                          : op.id === "gradiente" &&
                              faixaGradiente?.tipo === "gradiente"
                            ? { backgroundImage: faixaGradiente.texto }
                            : undefined
                      }
                    />
                    <span className={cargoCss.estiloRotulo}>{op.rotulo}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className={cargoCss.sobrancelha}>Cor</p>
              {/*
                A fileira de amostras da referência, e não uma caixa de seleção
                com um seletor escondido atrás.

                ⚠ **A versão anterior perguntava "colorir o nome?" antes de
                deixar escolher a cor** — dois gestos para uma decisão, e o
                primeiro deles é uma pergunta que a própria fileira responde:
                escolher uma cor É querer colorir. O cinza `#6E7783` é a última
                amostra justamente para "sem destaque" continuar sendo uma
                escolha visível em vez de um estado escondido.

                As seis cores são as do design, e as três primeiras são os
                semânticos do app — acento, sucesso e aviso — para o cargo
                colorido não brigar com a paleta que o resto da tela usa.
              */}
              <div className={cargoCss.amostras} role="radiogroup" aria-label="Cor do cargo">
                {AMOSTRAS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    role="radio"
                    aria-checked={colorido && cor.toLowerCase() === hex.toLowerCase()}
                    aria-label={`Cor ${hex}`}
                    className={cargoCss.amostra}
                    style={{ background: hex }}
                    onClick={() => {
                      setCor(hex);
                      setColorido(true);
                    }}
                  />
                ))}

                {/*
                  A cor livre continua existindo — o protocolo aceita qualquer
                  CSS válido, e reduzir a seis seria tirar o que já funcionava.

                  ⚠ **`SeletorDeCor` e não o input nativo aqui.** O lint do
                  projeto confina `input[type=color]` a `components/ui`, e a
                  razão está escrita lá: o que ele abre é o seletor do SISTEMA,
                  que nenhuma biblioteca resolve melhor — o que é nosso é só o
                  gatilho. Eu escrevi o input cru primeiro e a regra me pegou.
                */}
                <SeletorDeCor
                  id={`cor-${cargo.id}`}
                  rotulo="Cor personalizada"
                  forma="vaga"
                  valor={cor}
                  aoMudar={(hex) => {
                    setCor(hex);
                    setColorido(true);
                  }}
                />

                <span className={cargoCss.hex}>
                  {colorido ? cor.toUpperCase() : "sem cor"}
                </span>

                {colorido ? (
                  <Botao
                    variante="sutil"
                    onClick={() => {
                      setColorido(false);
                      setEstilo("solido");
                    }}
                  >
                    Remover
                  </Botao>
                ) : null}
              </div>
            </div>

            <IconeDoCargo
              serverId={serverId}
              cargo={cargo}
              podeEditar={!travado}
              aoMudar={aoMudar}
            />

            <div className={cargoCss.alternadores}>
              <LinhaDeAjuste
                titulo="Exibir membros separadamente"
                detalhe="Cria um grupo próprio na lista de membros."
              >
                <Interruptor
                  rotulo="Exibir membros separadamente"
                  ligado={destacado}
                  aoAlternar={setDestacado}
                />
              </LinhaDeAjuste>
              <LinhaDeAjuste
                titulo="Permitir menção"
                detalhe={`Qualquer membro pode usar @${nome}.`}
              >
                {/*
                  `mentionable` do servidor do Vortex. Desligado não impede
                  quem TEM "Mencionar cargos" — é a permissão que decide para
                  quem modera; isto abre a menção para todo o resto.
                */}
                <Interruptor
                  rotulo="Permitir menção"
                  ligado={mencionavel}
                  aoAlternar={setMencionavel}
                />
              </LinhaDeAjuste>
            </div>
          </div>

          {/*
            A prévia ao vivo — duas superfícies, e é o que a nota do design
            explica: gradiente e holográfico entram em pill e no nome da lista
            de membros, nunca no nome do autor da mensagem, onde o contraste
            sobre a timeline é o que importa. Mostrar as duas torna essa regra
            visível em vez de escrita.
          */}
          <aside className={cargoCss.previa}>
            <p className={cargoCss.sobrancelha}>Prévia</p>
            <div className={cargoCss.previaCaixa}>
              <div>
                <p className={cargoCss.previaRotulo}>Na lista de membros</p>
                <div className={cargoCss.previaMembro}>
                  <Avatar id="previa-cargo" sigla="M" />
                  <span className={cargoCss.previaTextos}>
                    {/* O ícone entra na prévia como entra na member list —
                        irmão do nome, pela mesma razão do recorte. */}
                    <span className={cargoCss.previaLinhaDoNome}>
                      <span
                        className={cargoCss.previaNome}
                        {...propsDoNome(pintura)}
                      >
                        Marina Alcântara
                      </span>
                      {cargo.iconeUrl ? (
                        <IconeDeCargo url={cargo.iconeUrl} nome={nome} />
                      ) : null}
                    </span>
                    <span className={cargoCss.previaRecado}>no deep work</span>
                  </span>
                </div>
              </div>

              {/* Plano, como o design: rótulo e chips são IRMÃOS do bloco de
                  cima, separados por margem e não por uma régua. */}
              <p className={cargoCss.previaRotulo}>Como pill / menção</p>
              <div className={cargoCss.previaChips}>
                  <span className={cargoCss.pill} {...propsDaPill(pintura)}>
                    {nome}
                  </span>
                  <span className={cargoCss.pill} {...propsDaPill(pintura)}>
                    @{nome}
                  </span>
                </div>
              
            </div>
            <p className={cargoCss.previaNota}>
              Gradiente e holográfico só entram em pill e no nome da lista de
              membros — nunca no nome do autor da mensagem, onde o contraste do
              texto sobre a timeline é o que importa.
            </p>
          </aside>
        </div>
      ) : aba === "permissoes" ? (
        <MatrizDePermissoes
          marcadas={marcadas}
          aoMudar={setMarcadas}
          desabilitada={salvando || travado || !alcance.podeEditarPermissoes}
        />
      ) : aba === "links" ? (
        <LinksDoCargo serverId={serverId} roleId={cargo.id} nome={nome} />
      ) : (
        <MembrosDoCargo serverId={serverId} cargo={cargo} aoMudar={aoMudarMembros} />
      )}

      <div className={css.acoes}>
        <Botao
          variante="primario"
          disabled={salvando || travado || !nome.trim()}
          onClick={() => {
            setSalvando(true);
            /*
              Duas chamadas, e a ordem importa pouco — mas as duas precisam
              acontecer: identidade e permissões são rotas diferentes no
              protocolo. Um botão só porque, para quem edita, é uma edição.
            */
            void salvarCargo(
              serverId,
              cargo.id,
              nome.trim(),
              bruta,
              destacado,
              mencionavel,
            )
              /* Sem `ManagePermissions` a matriz é só leitura, e mandá-la
                 mesmo assim trocaria um salvar bem-sucedido por um toast de
                 recusa sobre algo que a pessoa nem podia ter mudado. */
              .then((ok) =>
                ok && alcance.podeEditarPermissoes
                  ? salvarPermissoes(serverId, cargo.id, marcadas)
                  : ok,
              )
              .then((ok) => {
                if (ok) aoMudar();
              })
              .finally(() => setSalvando(false));
          }}
        >
          {salvando ? "Salvando…" : "Salvar cargo"}
        </Botao>

        {confirmando ? (
          <>
            <Botao
              variante="perigo"
              disabled={salvando}
              onClick={() => {
                void apagarCargo(serverId, cargo.id).then((ok) => {
                  if (ok) aoMudar();
                });
              }}
            >
              Apagar de vez
            </Botao>
            <Botao variante="sutil" onClick={() => setConfirmando(false)}>
              Cancelar
            </Botao>
          </>
        ) : (
          <Botao
            variante="sutil"
            disabled={salvando || travado}
            onClick={() => setConfirmando(true)}
          >
            Apagar cargo
          </Botao>
        )}
      </div>
    </div>
  );
}

/**
 * A matriz de permissões — a do cargo e a do `@everyone` são a MESMA peça.
 *
 * ⚠ **Extraída no dia em que ganhou o segundo consumidor**, e é o motivo de
 * existir: as permissões padrão reusam busca, aviso de Administrador, grupos e
 * caixas exatamente como o editor de cargo. Duas cópias divergiriam na
 * primeira permissão acrescentada a uma e esquecida na outra — as seis cópias
 * do `Avatar` já contaram essa história.
 *
 * Controlada: quem chama guarda o rascunho e decide quando gravar.
 */
function MatrizDePermissoes({
  marcadas,
  aoMudar,
  desabilitada,
}: {
  marcadas: readonly string[];
  aoMudar: (proximas: readonly string[]) => void;
  desabilitada: boolean;
}) {
  const [busca, setBusca] = useState("");

  /*
    O filtro da matriz varre rótulo E consequência: quem procura "banir" pode
    estar atrás da permissão ou do efeito dela, e olhar só o nome devolveria
    vazio para metade das buscas honestas.
  */
  const termo = busca.trim().toLowerCase();
  const gruposVisiveis = PERMISSOES.map((g) => ({
    ...g,
    itens: g.itens.filter(
      (perm) =>
        termo === "" ||
        perm.rotulo.toLowerCase().includes(termo) ||
        perm.detalhe.toLowerCase().includes(termo),
    ),
  })).filter((g) => g.itens.length > 0);

  return (
    <div className={cargoCss.permissoesAba}>
      <div className={cargoCss.barraDePermissoes}>
        <CampoDeBusca
          aria-label="Buscar permissão"
          placeholder="Buscar permissão"
          value={busca}
          onChange={(e) => {
            setBusca(e.currentTarget.value);
          }}
        />
        {/* Só com escrita: "Limpar" numa matriz de leitura é um alvo que não
            pode fazer nada. */}
        {desabilitada ? null : (
          <Botao
            variante="sutil"
            disabled={marcadas.length === 0}
            onClick={() => {
              aoMudar([]);
            }}
          >
            Limpar permissões
          </Botao>
        )}
      </div>

      {/*
        ⚠ O aviso não é decoração: Administrador IGNORA toda a cadeia de
        resolução, inclusive negações explícitas de canal. Quem marca sem
        saber acha que concedeu uma coisa e concedeu todas.
      */}
      <Banner tom="aviso" titulo="Administrador concede tudo.">
        Ativar essa permissão ignora toda a cadeia de resolução, inclusive
        negações explícitas de canal.
      </Banner>

      {gruposVisiveis.length === 0 ? (
        <EstadoVazio
          compacto
          titulo="Nenhuma permissão com esse nome"
          detalhe="Afrouxe a busca."
        />
      ) : (
        gruposVisiveis.map((grupo) => (
          <fieldset key={grupo.titulo} className={cargoCss.grupo}>
            <legend className={cargoCss.legenda}>{grupo.titulo}</legend>
            {grupo.itens.map((perm) => (
              <Caixa
                key={perm.id}
                className={cargoCss.permissao}
                marcado={marcadas.includes(perm.id)}
                disabled={desabilitada}
                aoAlternar={() => {
                  aoMudar(
                    marcadas.includes(perm.id)
                      ? marcadas.filter((x) => x !== perm.id)
                      : [...marcadas, perm.id],
                  );
                }}
              >
                <span className={cargoCss.textoDaPermissao}>
                  <span className={cargoCss.rotulo}>{perm.rotulo}</span>
                  <span className={css.detalhe}>{perm.detalhe}</span>
                </span>
              </Caixa>
            ))}
          </fieldset>
        ))
      )}
    </div>
  );
}

/**
 * As permissões padrão — o que TODO membro pode antes de qualquer cargo.
 *
 * ⚠ **Sem as abas do editor de cargo, e a ausência é o protocolo.** O
 * `@everyone` não tem nome, cor, ícone, link nem lista de membros: é o campo
 * `default_permissions` do servidor, um número só. Exibição, Links e Gerenciar
 * membros seriam três abas de controles sem destino.
 *
 * ⚠ **A referência não desenha este editor** — só o botão tracejado que o
 * abre. Cabeçalho, matriz e barra de salvar são os do editor de cargo, para o
 * mesmo gesto dar na mesma tela.
 */
function EditorDePermissoesPadrao({
  serverId,
  podeEditar,
  total,
}: {
  serverId: string;
  podeEditar: boolean;
  total: number;
}) {
  const [salvas, setSalvas] = useState(() => lerPermissoesPadrao(serverId));
  const [marcadas, setMarcadas] = useState<readonly string[]>(salvas);
  const [salvando, setSalvando] = useState(false);

  const mudou =
    marcadas.length !== salvas.length || marcadas.some((id) => !salvas.includes(id));

  return (
    <div className={cargoCss.editor}>
      <header className={cargoCss.cabecalhoDoEditor}>
        <span aria-hidden className={cargoCss.pontoDoEditor} />
        <h2 className={cargoCss.tituloDoEditor}>Permissões padrão — @everyone</h2>
        <span className={cargoCss.membrosDoCargo}>
          {total} {total === 1 ? "membro" : "membros"}
        </span>
      </header>

      <p className={css.detalhe}>
        Valem para todo mundo no servidor, antes de qualquer cargo. Um cargo só
        soma a elas; tirar algo de alguém é sobreposição de canal.
      </p>

      {podeEditar ? null : (
        <Banner tom="info">
          Você não tem permissão para mudar as permissões deste servidor. Esta
          é a lista do que todo membro pode hoje.
        </Banner>
      )}

      <MatrizDePermissoes
        marcadas={marcadas}
        aoMudar={setMarcadas}
        desabilitada={salvando || !podeEditar}
      />

      {podeEditar ? (
        <div className={css.acoes}>
          <Botao
            variante="primario"
            disabled={!mudou}
            carregando={salvando}
            rotuloCarregando="Salvando…"
            onClick={() => {
              setSalvando(true);
              void salvarPermissoesPadrao(serverId, marcadas)
                .then((ok) => {
                  if (ok) setSalvas(marcadas);
                })
                .finally(() => setSalvando(false));
            }}
          >
            Salvar permissões
          </Botao>
          {mudou ? (
            <Botao
              variante="sutil"
              disabled={salvando}
              onClick={() => {
                setMarcadas(salvas);
              }}
            >
              Descartar
            </Botao>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
