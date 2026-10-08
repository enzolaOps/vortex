import {
  apagarCargo,
  criarCargo,
  lerPermissoesPadrao,
  listarCargos,
  meuAlcance,
  PERMISSOES,
  pessoasDoServidor,
  reordenarCargos,
  salvarCargo,
  salvarPermissoes,
  salvarPermissoesPadrao,
  type Cargo,
} from "nucleo/sdk/cargos";
import { carregarMembros } from "nucleo/sdk/servidores";
import { useMembrosDoServidor } from "nucleo/store/hooks";
import { useEffect, useId, useState } from "react";

import { admin } from "../../textos";
import { Botao } from "../../ui/ds";
import { Alerta, Lixeira, Mais, SetaParaBaixo, SetaParaCima } from "../../ui/icones";
import { toast } from "../../ui/primitivos/Avisos";
import { Interruptor, BarraDeSalvar } from "../config/controles";
import css from "./admin.module.css";
import { Confirmacao } from "./Confirmacao";
import { Carregando } from "./Estados";

const t = admin.cargosPagina;

/** Cores sugeridas. A escolha é do servidor: o app só garante o contraste na hora de desenhar. */
const CORES = ["#E5484D", "#F76B15", "#FFB224", "#30A46C", "#12A594", "#3E63DD", "#8E4EC6", "#E93D82"] as const;

const ID_DO_TODOS = "@todos";

type Carga = { readonly para: string; readonly revisao: number; readonly cargos: readonly Cargo[]; readonly padrao: readonly string[] };

/** O editor de um cargo (ou do @todos): nome, cor, destaque e as permissões por pergunta. */
function Editor({
  serverId,
  cargo,
  padrao,
  aoSalvar,
  aoApagar,
}: {
  serverId: string;
  cargo: Cargo | undefined;
  padrao: readonly string[];
  aoSalvar: () => void;
  aoApagar: (cargo: Cargo) => void;
}) {
  const alcance = meuAlcance(serverId);
  const ehTodos = cargo === undefined;
  const acima = !ehTodos && cargo.rank <= alcance.topo;
  const podeEditarNome = !ehTodos && !acima && alcance.podeEditarCargos;
  const podeEditarPermissoes = !acima && alcance.podeEditarPermissoes;
  const inicial = {
    nome: cargo?.nome ?? "",
    cor: cargo?.cor ?? "",
    destacado: cargo?.destacado ?? false,
    permissoes: [...(cargo?.concedidas ?? padrao)].sort(),
  };
  const [nome, setNome] = useState(inicial.nome);
  const [cor, setCor] = useState(inicial.cor);
  const [destacado, setDestacado] = useState(inicial.destacado);
  const [permissoes, setPermissoes] = useState<readonly string[]>(inicial.permissoes);
  const [salvando, setSalvando] = useState(false);
  const idDoNome = useId();

  if (acima) {
    return (
      <div className={css.editor}>
        <p className={css.aviso} role="note">
          <Alerta tamanho={16} /> {t.acimaDeVoce}
        </p>
      </div>
    );
  }
  if (!podeEditarNome && !podeEditarPermissoes) {
    return (
      <div className={css.editor}>
        <p className={css.aviso} role="note">
          {t.semPermissaoDeEditar}
        </p>
      </div>
    );
  }

  const sujo =
    (podeEditarNome && (nome.trim() !== inicial.nome || cor !== inicial.cor || destacado !== inicial.destacado)) ||
    (podeEditarPermissoes && [...permissoes].sort().join("|") !== inicial.permissoes.join("|"));

  const descartar = () => {
    setNome(inicial.nome);
    setCor(inicial.cor);
    setDestacado(inicial.destacado);
    setPermissoes(inicial.permissoes);
  };

  const salvar = async () => {
    setSalvando(true);
    let ok = true;
    if (cargo === undefined) {
      ok = await salvarPermissoesPadrao(serverId, permissoes);
    } else {
      if (podeEditarNome) {
        ok = await salvarCargo(serverId, cargo.id, nome.trim() || cargo.nome, cor || undefined, destacado, cargo.mencionavel);
      }
      if (ok && podeEditarPermissoes) ok = await salvarPermissoes(serverId, cargo.id, permissoes);
    }
    setSalvando(false);
    if (!ok) return;
    toast({ tipo: "info", titulo: t.salvo });
    aoSalvar();
  };

  const alternar = (id: string, ligado: boolean) => {
    setPermissoes((atuais) => (ligado ? [...atuais.filter((p) => p !== id), id] : atuais.filter((p) => p !== id)));
  };

  return (
    <div className={css.editor} data-testid="editor-de-cargo">
      {ehTodos ? (
        <p className={css.dica}>{t.todosAjuda}</p>
      ) : (
        podeEditarNome && (
          <>
            <div className={css.campo}>
              <label className={css.rotulo} htmlFor={idDoNome}>
                {t.nome}
              </label>
              <input
                id={idDoNome}
                className={css.entrada}
                value={nome}
                maxLength={32}
                onChange={(e) => {
                  setNome(e.target.value);
                }}
              />
            </div>
            <div className={css.campo}>
              <span className={css.rotulo}>{t.cor}</span>
              <div className={css.cores} role="group" aria-label={t.cor}>
                <button
                  type="button"
                  className={`${css.cor} ${css.corSem}`}
                  aria-label={t.semCor}
                  aria-pressed={cor === ""}
                  onClick={() => {
                    setCor("");
                  }}
                >
                  –
                </button>
                {CORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={css.cor}
                    style={{ ["--cor" as string]: c }}
                    aria-label={c}
                    aria-pressed={cor === c}
                    onClick={() => {
                      setCor(c);
                    }}
                  />
                ))}
              </div>
            </div>
            <div className={css.permissao} style={{ border: 0, padding: 0 }}>
              <div className={css.permissaoTextos}>
                <span>{t.separado}</span>
                <span className={css.dica}>{t.separadoAjuda}</span>
              </div>
              <Interruptor ligado={destacado} aoMudar={setDestacado} rotulo={t.separado} />
            </div>
          </>
        )
      )}

      {podeEditarPermissoes && (
        <>
          <h3 className={css.categoriaTitulo}>{t.permissoes}</h3>
          {PERMISSOES.map((g) => (
            <section key={g.titulo} aria-label={g.titulo} className={css.grupoDePermissoes}>
              {g.itens.map((p) => (
                <div key={p.id} className={css.permissao} data-permissao={p.id}>
                  <div className={css.permissaoTextos}>
                    <span>{p.rotulo}</span>
                    <span className={css.dica}>{p.detalhe}</span>
                  </div>
                  <Interruptor
                    ligado={permissoes.includes(p.id)}
                    aoMudar={(ligado) => {
                      alternar(p.id, ligado);
                    }}
                    rotulo={p.rotulo}
                  />
                </div>
              ))}
            </section>
          ))}
        </>
      )}

      {cargo !== undefined && podeEditarNome && (
        <div>
          <Botao
            variante="perigo"
            tamanho="sm"
            icone={<Lixeira />}
            onClick={() => {
              aoApagar(cargo);
            }}
          >
            {t.apagar}
          </Botao>
        </div>
      )}

      {sujo && <BarraDeSalvar salvando={salvando} aoDescartar={descartar} aoSalvar={() => void salvar()} />}
    </div>
  );
}

/** Cargos (PRD 4.7): criar, editar permissões, reordenar e apagar. Aplicar a pessoas é em Membros. */
export function Cargos({ serverId }: { serverId: string }) {
  const [revisao, setRevisao] = useState(0);
  const [carga, setCarga] = useState<Carga | undefined>();
  const [escolhido, setEscolhido] = useState<string>(ID_DO_TODOS);
  const [apagando, setApagando] = useState<Cargo | undefined>();
  const ids = useMembrosDoServidor(serverId);
  const alcance = meuAlcance(serverId);

  useEffect(() => {
    let vivo = true;
    void carregarMembros(serverId);
    void listarCargos(serverId).then((cargos) => {
      if (vivo) setCarga({ para: serverId, revisao, cargos, padrao: lerPermissoesPadrao(serverId) });
    });
    return () => {
      vivo = false;
    };
  }, [serverId, revisao]);

  const atual = carga?.para === serverId && carga.revisao === revisao ? carga : undefined;
  const pessoas = pessoasDoServidor(serverId, ids);

  const recarregar = () => {
    setRevisao((r) => r + 1);
  };

  const criar = async () => {
    const id = await criarCargo(serverId, t.novoNome);
    if (id !== undefined) {
      setEscolhido(id);
      recarregar();
    }
  };

  const mover = async (cargos: readonly Cargo[], de: number, passo: number) => {
    const ordem = cargos.map((c) => c.id);
    ordem.splice(de + passo, 0, ...ordem.splice(de, 1));
    if (await reordenarCargos(serverId, ordem)) recarregar();
  };

  if (atual === undefined) return <Carregando texto={t.carregando} />;
  const selecionado = atual.cargos.find((c) => c.id === escolhido);
  const emUso = selecionado?.id ?? ID_DO_TODOS;

  return (
    <div className={css.pagina} style={{ maxInlineSize: "none" }}>
      <div className={css.cargos}>
        <div className={css.editor}>
          <div className={css.barra}>
            <h3 className={css.categoriaTitulo}>
              {t.lista} · {atual.cargos.length}
            </h3>
            {alcance.podeEditarCargos && (
              <Botao variante="secundario" tamanho="sm" icone={<Mais />} onClick={() => void criar()}>
                {t.criar}
              </Botao>
            )}
          </div>
          <ul className={css.listaDeCargos} aria-label={t.lista}>
            {atual.cargos.map((c, i) => {
              const editavel = c.rank > alcance.topo;
              const quantas = pessoas.filter((p) => p.cargosIds.includes(c.id)).length;
              return (
                <li key={c.id} className={css.cargoLinha} data-testid="item-de-cargo" data-cargo={c.id}>
                  <button
                    type="button"
                    className={css.cargoItem}
                    aria-current={emUso === c.id}
                    onClick={() => {
                      setEscolhido(c.id);
                    }}
                  >
                    <span className={css.chipPonto} style={c.cor ? { ["--cor" as string]: c.cor } : undefined} aria-hidden="true" />
                    <span className={css.cargoNome}>{c.nome}</span>
                    <span className={css.meta}>{quantas}</span>
                  </button>
                  {alcance.podeEditarCargos && editavel ? (
                    <span className={css.acoesDaLinha}>
                      <Botao
                        variante="fantasma"
                        tamanho="sm"
                        icone={<SetaParaCima />}
                        aria-label={t.subir(c.nome)}
                        disabled={i === 0 || atual.cargos[i - 1] === undefined || atual.cargos[i - 1]!.rank <= alcance.topo}
                        onClick={() => void mover(atual.cargos, i, -1)}
                      />
                      <Botao
                        variante="fantasma"
                        tamanho="sm"
                        icone={<SetaParaBaixo />}
                        aria-label={t.descer(c.nome)}
                        disabled={i === atual.cargos.length - 1}
                        onClick={() => void mover(atual.cargos, i, 1)}
                      />
                    </span>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
            <li className={css.cargoLinha}>
              <button
                type="button"
                className={css.cargoItem}
                aria-current={emUso === ID_DO_TODOS}
                onClick={() => {
                  setEscolhido(ID_DO_TODOS);
                }}
              >
                <span className={css.cargoNome}>{t.todos}</span>
              </button>
              <span />
            </li>
          </ul>
        </div>

        <Editor
          key={`${emUso}-${String(revisao)}`}
          serverId={serverId}
          cargo={selecionado}
          padrao={atual.padrao}
          aoSalvar={recarregar}
          aoApagar={setApagando}
        />
      </div>

      <Confirmacao
        aberto={apagando !== undefined}
        aoMudar={(a) => {
          if (!a) setApagando(undefined);
        }}
        titulo={t.apagarTitulo(apagando?.nome ?? "")}
        texto={t.apagarTexto}
        confirmar={t.apagar}
        aoConfirmar={async () => {
          if (apagando === undefined) return false;
          const ok = await apagarCargo(serverId, apagando.id);
          if (ok) {
            setEscolhido(ID_DO_TODOS);
            recarregar();
          }
          return ok;
        }}
      />
    </div>
  );
}
