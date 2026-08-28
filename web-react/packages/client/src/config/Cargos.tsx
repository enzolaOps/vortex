import { useEffect, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { SeletorDeCor } from "../components/ui/SeletorDeCor";
import {
  apagarCargo,
  criarCargo,
  listarCargos,
  PERMISSOES,
  salvarCargo,
  salvarPermissoes,
  type Cargo,
} from "../sdk/cargos";
import css from "./Secao.module.css";
import cargoCss from "./Cargos.module.css";

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

  const cargo = lista.find((c) => c.id === selecionado);

  return (
    <div className={cargoCss.tela}>
      <div className={cargoCss.coluna}>
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
                recarregar();
              })
              .finally(() => setOcupado(false));
          }}
        >
          <Campo
            rotulo="Novo cargo"
            autoComplete="off"
            disabled={ocupado}
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
          />
          <Botao variante="neutro" type="submit" disabled={!novo.trim() || ocupado}>
            Criar
          </Botao>
        </form>

        {lista.length === 0 ? (
          <EstadoVazio
            compacto
            titulo="Nenhum cargo"
            detalhe="Crie um para separar quem pode o quê."
          />
        ) : (
          <ul className={cargoCss.cargos}>
            {lista.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={cargoCss.cargo}
                  aria-current={c.id === selecionado}
                  onClick={() => setSelecionado(c.id)}
                >
                  {/* A cor do cargo é dado do SERVIDOR, não token — mesma
                      regra do nome do autor na linha de mensagem. */}
                  <span
                    className={cargoCss.bolinha}
                    aria-hidden
                    style={c.cor ? { background: c.cor } : undefined}
                  />
                  {c.nome}
                </button>
              </li>
            ))}
          </ul>
        )}
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

        <label className={cargoCss.opcao}>
          <input
            type="checkbox"
            checked={colorido}
            disabled={salvando}
            onChange={(e) => setColorido(e.target.checked)}
          />
          Colorir o nome de quem tem este cargo
        </label>

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

        <label className={cargoCss.opcao}>
          <input
            type="checkbox"
            checked={destacado}
            disabled={salvando}
            onChange={(e) => setDestacado(e.target.checked)}
          />
          Mostrar em seção própria na lista de membros
        </label>
      </div>

      <hr className={css.divisor} />

      {PERMISSOES.map((grupo) => (
        <fieldset key={grupo.titulo} className={cargoCss.grupo}>
          <legend className={cargoCss.legenda}>{grupo.titulo}</legend>
          {grupo.itens.map((p) => (
            <label key={p.id} className={cargoCss.permissao}>
              <input
                type="checkbox"
                checked={marcadas.includes(p.id)}
                disabled={salvando}
                onChange={() => alternar(p.id)}
              />
              <span className={cargoCss.textoDaPermissao}>
                <span className={cargoCss.rotulo}>{p.rotulo}</span>
                {/* O detalhe diz a CONSEQUÊNCIA, não repete o rótulo — é o que
                    torna a lista decidível por quem não conhece o protocolo. */}
                <span className={css.detalhe}>{p.detalhe}</span>
              </span>
            </label>
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
