import { useEffect, useState } from "react";

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
export function Cargos({ serverId }: { serverId: string }) {
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
                  <button
                    type="button"
                    className={cargoCss.cargo}
                    aria-current={c.id === selecionado}
                    onClick={() => {
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
                  >
                    <span
                      className={cargoCss.bolinha}
                      aria-hidden
                      style={c.cor ? { background: c.cor } : undefined}
                    />
                    <span className={cargoCss.nomeDoCargo}>{c.nome}</span>
                  </button>
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
          aoMudar={recarregar}
        />
      ) : null}
    </div>
  );
}

function EditorDeCargo({
  serverId,
  cargo,
  aoMudar,
}: {
  serverId: string;
  cargo: Cargo;
  aoMudar: () => void;
}) {
  const [nome, setNome] = useState(cargo.nome);
  const [cor, setCor] = useState(cargo.cor ?? "#bcaef2");
  const [colorido, setColorido] = useState(cargo.cor !== undefined);
  const [destacado, setDestacado] = useState(cargo.destacado);
  const [marcadas, setMarcadas] = useState<readonly string[]>(cargo.concedidas);
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  function alternar(id: string) {
    setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  return (
    <div className={cargoCss.editor}>
      <div className={css.bloco}>
        <Campo
          rotulo="Nome do cargo"
          autoComplete="off"
          disabled={salvando}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <Caixa
          className={cargoCss.opcao}
          marcado={colorido}
          disabled={salvando}
          aoAlternar={setColorido}
        >
          Colorir o nome de quem tem este cargo
        </Caixa>

        {/*
          A cor passa pelo mesmo clamp de luminosidade das cores de cargo na
          linha de mensagem: matiz e croma são de quem escolhe, o L é do app.
          É o que impede um cargo amarelo de ficar ilegível no tema claro.
        */}
        {colorido ? (
          <SeletorDeCor
            id={`cor-${cargo.id}`}
            rotulo="Cor do cargo"
            valor={cor}
            aoMudar={setCor}
          />
        ) : null}

        <Caixa
          className={cargoCss.opcao}
          marcado={destacado}
          disabled={salvando}
          aoAlternar={setDestacado}
        >
          Mostrar em seção própria na lista de membros
        </Caixa>
      </div>

      <hr className={css.divisor} />

      {PERMISSOES.map((grupo) => (
        <fieldset key={grupo.titulo} className={cargoCss.grupo}>
          <legend className={cargoCss.legenda}>{grupo.titulo}</legend>
          {grupo.itens.map((p) => (
            <Caixa
              key={p.id}
              className={cargoCss.permissao}
              marcado={marcadas.includes(p.id)}
              disabled={salvando}
              aoAlternar={() => alternar(p.id)}
            >
              <span className={cargoCss.textoDaPermissao}>
                <span className={cargoCss.rotulo}>{p.rotulo}</span>
                {/* O detalhe diz a CONSEQUÊNCIA, não repete o rótulo — é o que
                    torna a lista decidível por quem não conhece o protocolo. */}
                <span className={css.detalhe}>{p.detalhe}</span>
              </span>
            </Caixa>
          ))}
        </fieldset>
      ))}

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
