import { useEffect, useMemo, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Caixa } from "../components/ui/Marcador";
import { Campo } from "../components/ui/Campo";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { SeletorDeCor } from "../components/ui/SeletorDeCor";
import {
  apagarCargo,
  criarCargo,
  reordenarCargos,
  listarCargos,
  PERMISSOES,
  salvarCargo,
  salvarPermissoes,
  type Cargo,
} from "../sdk/cargos";
import css from "./Secao.module.css";
import cargoCss from "./Cargos.module.css";
import { CaretRight } from "../components/ui/icones";
import { CampoDeBusca } from "../components/ui/CampoDeBusca";
import { aindaNao } from "../pendente/pendencias";
import { useCorDeCargo, useMembrosDoServidor } from "../store/hooks";
import { chaveDeMembro } from "../sdk/domain";
import { members } from "../sdk/adapter";
import { CartaoDeAjustes, LinhaDeAjuste } from "./Pagina";
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
 * ⚠ **Sem arrastar para reordenar.** `DataEditRole.rank` **não tem efeito** —
 * ordenar é `setRoleOrdering` com a lista inteira, e um arrasto que parece
 * funcionar e não salva é pior que não ter arrasto. Fica como pendência dita.
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
  contagem,
  aoEscolher,
  onKeyDown,
}: {
  cargo: Cargo;
  ativa: boolean;
  contagem: number;
  aoEscolher: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const cor = useCorDeCargo(cargo.cor);

  return (
    <button
      type="button"
      className={cargoCss.cargo}
      aria-current={ativa}
      onClick={aoEscolher}
      onKeyDown={onKeyDown}
    >
      {/*
        A alça de arraste do design.

        ⚠ Ela ainda NÃO arrasta — quem move é `Alt` + setas. Ela está aqui
        porque é o que diz que a linha é movível: sem nenhum sinal, a
        ordenação por teclado seria um recurso que só existe para quem leu a
        dica. `aria-hidden` porque o botão inteiro já é o alvo, e um segundo
        nome dentro dele daria duas leituras para uma linha.
      */}
      <span aria-hidden className={cargoCss.alca}>
        ⠿
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

export function Cargos({ serverId }: { serverId: string }) {
  const membrosDoServidor = useMembrosDoServidor(serverId);
  const [lista, setLista] = useState<readonly Cargo[] | undefined>(undefined);
  const [selecionado, setSelecionado] = useState<string | undefined>(undefined);
  const [novo, setNovo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);

  function recarregar() {
    void listarCargos(serverId).then((l) => {
      setLista(l);
      // Mantém a seleção se o cargo ainda existir; senão cai no primeiro.
      setSelecionado((s) => (s && l.some((c) => c.id === s) ? s : l[0]?.id));
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

    ⚠ **Lido com `getSnapshot` e não com um hook por membro.** Um
    `useMembro` por pessoa assinaria a member list inteira dentro de uma tela
    de configuração — num servidor de dez mil, dez mil subscrições para
    desenhar três números.

    ⚠ **A consequência é dita: a contagem NÃO acompanha ao vivo.** Se alguém
    ganhar um cargo com esta tela aberta, o número só muda ao reabrir. É a
    mesma decisão de "ordenar quando é observável" — a página é aberta
    deliberadamente, e a alternativa custa a subscrição de todo mundo.
  */
  const contagens = useMemo(() => {
    const m = new Map<string, number>();
    for (const userId of membrosDoServidor) {
      const snap = members.getSnapshot(chaveDeMembro(serverId, userId));
      for (const id of snap?.cargosIds ?? []) {
        m.set(id, (m.get(id) ?? 0) + 1);
      }
    }
    return m;
  }, [membrosDoServidor, serverId]);

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
   */
  function mover(id: string, passo: -1 | 1) {
    if (termo !== "" || ocupado) return;
    const i = cargos.findIndex((c) => c.id === id);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= cargos.length) return;

    const nova = [...cargos];
    const [movido] = nova.splice(i, 1);
    if (!movido) return;
    nova.splice(j, 0, movido);

    /* Otimista: a lista reordena na hora e o servidor confirma. Sem isso,
       cada Alt+seta esperaria uma volta de rede antes de a tela responder. */
    setLista(nova);
    setOcupado(true);
    void reordenarCargos(
      serverId,
      nova.map((c) => c.id),
    )
      .then((ok) => {
        /* Falhou: o servidor é a verdade, e recarregar é mais honesto que
           tentar desfazer o splice — o estado de lá pode ter mudado por outra
           razão no meio do caminho. */
        if (!ok) recarregar();
      })
      .finally(() => setOcupado(false));
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
            onClick={aindaNao("permissoesPadrao")}
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
            <span className={cargoCss.hierarquiaDica}>Alt + ↑ ↓ para mover</span>
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
              {visiveis.map((c) => (
                <li key={c.id}>
                  <LinhaDeCargo
                    cargo={c}
                    ativa={c.id === selecionado}
                    contagem={contagens.get(c.id) ?? 0}
                    aoEscolher={() => {
                      setSelecionado(c.id);
                    }}
                    /*
                      ⚠ **Reordenar por TECLADO primeiro, e o arraste soma
                      depois.** É a regra que a enquete já estabeleceu neste
                      projeto: reordenar que só funciona com mouse é o defeito
                      que a auditoria apontou na paleta de comandos. `Alt` e
                      não seta pura, senão a navegação entre os cargos deixaria
                      de existir.
                    */
                    onKeyDown={(e) => {
                      if (!e.altKey) return;
                      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                      e.preventDefault();
                      mover(c.id, e.key === "ArrowUp" ? -1 : 1);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          {/*
            O aviso de hierarquia, do design. Ele explica por que alguns cargos
            não respondem — e um item que não responde SEM explicação é o
            defeito que "acima da sua hierarquia" já registrou.
          */}
          <p className={cargoCss.aviso}>
            Você só pode editar e mover cargos abaixo do seu mais alto. Cargos
            gerenciados por integração ficam travados.
          </p>
        </div>
      </div>

      {cargo ? (
        <EditorDeCargo
          key={cargo.id}
          serverId={serverId}
          cargo={cargo}
          contagem={contagens.get(cargo.id) ?? 0}
          aoMudar={recarregar}
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
function estiloDaPill(cor: string | undefined): React.CSSProperties | undefined {
  if (cor === undefined) return undefined;
  return {
    color: cor,
    background: `color-mix(in oklab, ${cor} 15%, transparent)`,
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
 * ⚠ **Nenhum deles existe no protocolo.** `Role` tem `_id`, `name`,
 * `permissions`, `colour`, `hoist`, `rank` e `icon` — não há campo de estilo.
 * Sólido é o que o app já faz; gradiente e holográfico são pendência.
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
  contagem,
  aoMudar,
}: {
  serverId: string;
  cargo: Cargo;
  contagem: number;
  aoMudar: () => void;
}) {
  const [aba, setAba] = useState<AbaDoCargo>("exibicao");
  const [nome, setNome] = useState(cargo.nome);
  const [cor, setCor] = useState(cargo.cor ?? "#bcaef2");
  const [colorido, setColorido] = useState(cargo.cor !== undefined);
  const [estilo, setEstilo] = useState<EstiloDeCargo>("solido");
  const [destacado, setDestacado] = useState(cargo.destacado);
  const [marcadas, setMarcadas] = useState<readonly string[]>(cargo.concedidas);
  const [buscaDePermissao, setBuscaDePermissao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const corLegivel = useCorDeCargo(colorido ? cor : undefined);

  function alternar(id: string) {
    setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  /*
    O filtro da matriz varre rótulo E consequência: quem procura "banir" pode
    estar atrás da permissão ou do efeito dela, e olhar só o nome devolveria
    vazio para metade das buscas honestas.
  */
  const termoP = buscaDePermissao.trim().toLowerCase();
  const gruposVisiveis = PERMISSOES.map((g) => ({
    ...g,
    itens: g.itens.filter(
      (perm) =>
        termoP === "" ||
        perm.rotulo.toLowerCase().includes(termoP) ||
        perm.detalhe.toLowerCase().includes(termoP),
    ),
  })).filter((g) => g.itens.length > 0);

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
        <div className={cargoCss.duasColunas}>
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
                    onClick={
                      op.id === "solido"
                        ? () => {
                            setEstilo("solido");
                          }
                        : aindaNao("estiloDeCargo")
                    }
                  >
                    <span
                      aria-hidden
                      className={cn(cargoCss.faixa, cargoCss[op.id])}
                      style={
                        op.id === "solido" && corLegivel
                          ? { background: corLegivel }
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
                    }}
                  >
                    Remover
                  </Botao>
                ) : null}
              </div>
            </div>

            <div>
              <p className={cargoCss.sobrancelha}>Ícone do cargo</p>
              <div className={cargoCss.icone}>
                <span aria-hidden className={cargoCss.iconeVazio} />
                <Botao variante="neutro" onClick={aindaNao("iconeDeCargo")}>
                  Enviar imagem
                </Botao>
                <Botao variante="sutil" onClick={aindaNao("iconeDeCargo")}>
                  Usar emoji
                </Botao>
              </div>
            </div>

            <CartaoDeAjustes>
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
                  ⚠ Pendente, e o interruptor mostra o estado VERDADEIRO: o
                  protocolo não tem `mentionable`, e hoje qualquer cargo pode
                  ser mencionado. Nascer desligado afirmaria o contrário do
                  que o servidor faz — a regra que Acesso e Segurança já
                  registram.
                */}
                <Interruptor
                  rotulo="Permitir menção"
                  ligado
                  aoAlternar={() => {
                    aindaNao("mencionarCargo")();
                  }}
                />
              </LinhaDeAjuste>
            </CartaoDeAjustes>
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
                    <span
                      className={cargoCss.previaNome}
                      style={corLegivel ? { color: corLegivel } : undefined}
                    >
                      Marina Alcântara
                    </span>
                    <span className={cargoCss.previaRecado}>no deep work</span>
                  </span>
                </div>
              </div>

              <div className={cargoCss.previaBloco}>
                <p className={cargoCss.previaRotulo}>Como pill / menção</p>
                <div className={cargoCss.previaChips}>
                  <span className={cargoCss.pill} style={estiloDaPill(corLegivel)}>
                    {nome}
                  </span>
                  <span className={cargoCss.pill} style={estiloDaPill(corLegivel)}>
                    @{nome}
                  </span>
                </div>
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
        <div className={cargoCss.permissoesAba}>
          <div className={cargoCss.barraDePermissoes}>
            <CampoDeBusca
              aria-label="Buscar permissão"
              placeholder="Buscar permissão"
              value={buscaDePermissao}
              onChange={(e) => {
                setBuscaDePermissao(e.currentTarget.value);
              }}
            />
            <Botao
              variante="sutil"
              disabled={marcadas.length === 0}
              onClick={() => {
                setMarcadas([]);
              }}
            >
              Limpar permissões
            </Botao>
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
                    disabled={salvando}
                    aoAlternar={() => {
                      alternar(perm.id);
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
      ) : aba === "links" ? (
        <div className={cargoCss.abaSimples}>
          <Banner
            tom="aviso"
            acoes={
              <Botao variante="neutro" onClick={aindaNao("linkDeCargo")}>
                O que falta
              </Botao>
            }
          >
            O protocolo do Stoat não tem link de atribuição de cargo. Esta aba
            mostra a forma final; nada aqui é guardado.
          </Banner>

          <p className={css.detalhe}>
            Quem abrir este link e entrar no servidor recebe <strong>{nome}</strong>{" "}
            automaticamente.
          </p>

          <div className={cargoCss.linkLinha}>
            <span className={cargoCss.link}>vortex.gg/r/{cargo.id.slice(0, 8)}</span>
            <Botao variante="neutro" onClick={aindaNao("linkDeCargo")}>
              Copiar
            </Botao>
            <Botao variante="perigoSutil" onClick={aindaNao("linkDeCargo")}>
              Revogar
            </Botao>
          </div>
        </div>
      ) : (
        <div className={cargoCss.abaSimples}>
          <Banner
            tom="aviso"
            acoes={
              <Botao variante="neutro" onClick={aindaNao("gerenciarMembrosDoCargo")}>
                O que falta
              </Botao>
            }
          >
            Dar e tirar este cargo de alguém já funciona, pelo menu da member
            list. O que falta é fazer o mesmo em lote a partir daqui.
          </Banner>

          <p className={css.detalhe}>
            {contagem} {contagem === 1 ? "pessoa tem" : "pessoas têm"}{" "}
            <strong>{nome}</strong>.
          </p>
        </div>
      )}

      <div className={css.acoes}>
        <Botao
          variante="primario"
          disabled={salvando || !nome.trim()}
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
              colorido ? cor : undefined,
              destacado,
            )
              .then(() => salvarPermissoes(serverId, cargo.id, marcadas))
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
            disabled={salvando}
            onClick={() => setConfirmando(true)}
          >
            Apagar cargo
          </Botao>
        )}
      </div>
    </div>
  );
}
