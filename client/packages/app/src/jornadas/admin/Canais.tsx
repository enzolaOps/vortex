import { CATEGORIA_PADRAO } from "nucleo/sdk/domain";
import {
  apagarCanal,
  apagarCategoria,
  criarCanal,
  criarCategoriaEDevolverId,
  duplicarCanal,
  moverCanaisParaCategoria,
  renomearCanal,
  renomearCategoria,
} from "nucleo/sdk/servidores";
import { useCategorias, useChannel } from "nucleo/store/hooks";
import { useId, useState, type FormEvent } from "react";

import { admin, comum, salas } from "../../textos";
import { Botao } from "../../ui/ds";
import {
  Canal as IconeDeCanal,
  Copiar,
  Editar,
  Lixeira,
  Mais,
  SetaParaBaixo,
  SetaParaCima,
  Volume,
} from "../../ui/icones";
import { juntar } from "../../ui/juntar";
import { toast } from "../../ui/primitivos/Avisos";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import css from "./admin.module.css";
import { Confirmacao } from "./Confirmacao";
import { Vazio } from "./Estados";

const t = admin.canaisPagina;

type Alvo =
  | { readonly tipo: "criar"; readonly categoriaId: string | undefined }
  | { readonly tipo: "editar"; readonly canalId: string };

/** Criar ou editar um canal: o mesmo formulário, porque os campos são os mesmos. */
function FormularioDeCanal({
  serverId,
  alvo,
  aoFechar,
}: {
  serverId: string;
  alvo: Alvo | undefined;
  aoFechar: () => void;
}) {
  const categorias = useCategorias(serverId).filter((c) => c.id !== CATEGORIA_PADRAO);
  const editando = useChannel(alvo?.tipo === "editar" ? alvo.canalId : "");
  const ids = { tipo: useId(), nome: useId(), categoria: useId(), assunto: useId() };
  const [voz, setVoz] = useState(true);
  const [nome, setNome] = useState<string | undefined>();
  const [assunto, setAssunto] = useState<string | undefined>();
  const [categoria, setCategoria] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | undefined>();

  if (alvo === undefined) return null;
  const criando = alvo.tipo === "criar";
  const nomeAtual = nome ?? (criando ? "" : (editando?.name ?? ""));
  const assuntoAtual = assunto ?? (criando ? "" : (editando?.topico ?? ""));
  // Ao editar, a categoria de partida é a que já guarda o canal (ou nenhuma, se está solto).
  const categoriaDoCanal =
    alvo.tipo === "editar" ? (categorias.find((c) => c.canais.includes(alvo.canalId))?.id ?? "") : undefined;
  const categoriaAtual =
    categoria ?? (alvo.tipo === "criar" ? alvo.categoriaId : categoriaDoCanal) ?? categorias[0]?.id ?? "";

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const limpo = nomeAtual.trim();
    if (limpo === "") {
      setErro(t.nomeObrigatorio);
      return;
    }
    setOcupado(true);
    setErro(undefined);
    let ok: boolean;
    if (alvo.tipo === "criar") {
      // Canal não nasce fora de categoria; servidor sem nenhuma ganha a primeira agora.
      const destino =
        categoriaAtual !== "" ? categoriaAtual : await criarCategoriaEDevolverId(serverId, salas.titulo);
      ok = destino !== undefined && (await criarCanal(serverId, limpo, voz, destino)) !== undefined;
    } else {
      ok = await renomearCanal(alvo.canalId, limpo, assuntoAtual.trim());
      // Mudar de categoria é uma escrita à parte: só acontece se a pessoa escolheu outra.
      if (ok && categoriaAtual !== "" && categoriaAtual !== categoriaDoCanal) {
        ok = await moverCanaisParaCategoria(serverId, categoriaAtual, [alvo.canalId]);
      }
    }
    setOcupado(false);
    if (!ok) {
      setErro(t.falhou);
      return;
    }
    toast({ tipo: "info", titulo: criando ? t.criada : comum.salvar });
    setNome(undefined);
    setAssunto(undefined);
    setCategoria(undefined);
    aoFechar();
  };

  return (
    <form
      className={css.formulario}
      onSubmit={(e) => {
        void enviar(e);
      }}
    >
      {criando && (
        <div className={css.campo}>
          <span id={ids.tipo} className={css.rotulo}>
            {t.tipo}
          </span>
          <div role="radiogroup" aria-labelledby={ids.tipo} className={css.abas}>
            {[
              { valor: true, rotulo: t.sala },
              { valor: false, rotulo: t.canal },
            ].map((o) => (
              <button
                key={String(o.valor)}
                type="button"
                role="radio"
                aria-checked={voz === o.valor}
                aria-selected={voz === o.valor}
                className={css.aba}
                onClick={() => {
                  setVoz(o.valor);
                }}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={css.campo}>
        <label className={css.rotulo} htmlFor={ids.nome}>
          {t.nome}
        </label>
        <input
          id={ids.nome}
          className={css.entrada}
          value={nomeAtual}
          maxLength={32}
          autoFocus
          aria-invalid={erro === t.nomeObrigatorio}
          onChange={(e) => {
            setNome(e.target.value);
          }}
        />
      </div>

      {categorias.length > 0 && (
        <div className={css.campo}>
          <label className={css.rotulo} htmlFor={ids.categoria}>
            {t.categoria}
          </label>
          <select
            id={ids.categoria}
            className={css.entrada}
            value={categoriaAtual}
            onChange={(e) => {
              setCategoria(e.target.value);
            }}
          >
            {categoriaAtual === "" && <option value="">{t.semCategoria}</option>}
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo ?? t.semCategoria}
              </option>
            ))}
          </select>
        </div>
      )}

      {!criando && (
        <div className={css.campo}>
          <label className={css.rotulo} htmlFor={ids.assunto}>
            {t.assunto}
          </label>
          <input
            id={ids.assunto}
            className={css.entrada}
            value={assuntoAtual}
            maxLength={1024}
            placeholder={t.assuntoPlaceholder}
            onChange={(e) => {
              setAssunto(e.target.value);
            }}
          />
        </div>
      )}

      {erro !== undefined && (
        <p className={css.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={css.rodapeDoDialogo}>
        <Botao variante="fantasma" onClick={aoFechar}>
          {comum.cancelar}
        </Botao>
        <Botao type="submit" carregando={ocupado}>
          {criando ? t.criarConfirmar : t.salvarConfirmar}
        </Botao>
      </div>
    </form>
  );
}

function LinhaDeCanal({
  canalId,
  podeSubir,
  podeDescer,
  aoSubir,
  aoDescer,
  aoEditar,
  aoDuplicar,
  aoApagar,
}: {
  canalId: string;
  podeSubir: boolean;
  podeDescer: boolean;
  aoSubir: () => void;
  aoDescer: () => void;
  aoEditar: (nome: string) => void;
  aoDuplicar: () => void;
  aoApagar: (nome: string, voz: boolean) => void;
}) {
  const canal = useChannel(canalId);
  if (!canal) return null;
  const voz = canal.tipo === "voz";
  return (
    <li className={css.canal} data-testid="linha-de-canal" data-canal={canalId} data-tipo={voz ? "voz" : "texto"}>
      <span className={css.canalIcone} aria-hidden="true">
        {voz ? <Volume tamanho={16} /> : <IconeDeCanal tamanho={16} />}
      </span>
      <span className={css.celula}>
        {canal.name} <span className={css.meta}>{voz ? t.sala : t.canal}</span>
      </span>
      <span className={juntar(css.acoesDaLinha, css.acoesNoHover)}>
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<SetaParaCima />}
          aria-label={t.subir(canal.name)}
          disabled={!podeSubir}
          onClick={aoSubir}
        />
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<SetaParaBaixo />}
          aria-label={t.descer(canal.name)}
          disabled={!podeDescer}
          onClick={aoDescer}
        />
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<Editar />}
          aria-label={t.editar(canal.name)}
          onClick={() => {
            aoEditar(canalId);
          }}
        />
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<Copiar />}
          aria-label={t.duplicar(canal.name)}
          onClick={aoDuplicar}
        />
        <Botao
          variante="fantasma"
          tamanho="sm"
          className={css.apagar}
          icone={<Lixeira />}
          aria-label={t.apagar(canal.name)}
          onClick={() => {
            aoApagar(canal.name, voz);
          }}
        />
      </span>
    </li>
  );
}

type Apagando =
  | { readonly tipo: "canal"; readonly id: string; readonly nome: string; readonly voz: boolean }
  | { readonly tipo: "categoria"; readonly id: string; readonly nome: string };

/** Salas e canais (PRD 4.7): criar, editar, duplicar, apagar e mover dentro da categoria. */
export function Canais({ serverId }: { serverId: string }) {
  const categorias = useCategorias(serverId);
  const [alvo, setAlvo] = useState<Alvo | undefined>();
  const [apagando, setApagando] = useState<Apagando | undefined>();
  const [categoriaNova, setCategoriaNova] = useState<
    { readonly tipo: "criar" } | { readonly tipo: "renomear"; readonly id: string; readonly nome: string } | undefined
  >();
  const [nomeDaCategoria, setNomeDaCategoria] = useState("");
  const total = categorias.reduce((n, c) => n + c.canais.length, 0);

  const mover = async (categoriaId: string, ordem: readonly string[]) => {
    const ok = await moverCanaisParaCategoria(serverId, categoriaId, ordem);
    if (!ok) toast({ tipo: "erro", titulo: t.falhou });
  };

  const duplicar = async (id: string) => {
    const novo = await duplicarCanal(id);
    if (novo !== undefined) toast({ tipo: "info", titulo: t.duplicada });
  };

  const trocarCategoria = async (e: FormEvent) => {
    e.preventDefault();
    const nome = nomeDaCategoria.trim();
    if (nome === "" || categoriaNova === undefined) return;
    const ok =
      categoriaNova.tipo === "criar"
        ? (await criarCategoriaEDevolverId(serverId, nome)) !== undefined
        : await renomearCategoria(serverId, categoriaNova.id, nome);
    if (ok) {
      setCategoriaNova(undefined);
      setNomeDaCategoria("");
    } else {
      toast({ tipo: "erro", titulo: t.falhou });
    }
  };

  return (
    <div className={css.pagina}>
      <div className={css.barra}>
        <span />
        <div className={css.barraEsquerda} style={{ flex: "none" }}>
          <Botao
            variante="secundario"
            onClick={() => {
              setNomeDaCategoria("");
              setCategoriaNova({ tipo: "criar" });
            }}
          >
            {t.criarCategoria}
          </Botao>
          <Botao
            icone={<Mais />}
            onClick={() => {
              setAlvo({ tipo: "criar", categoriaId: undefined });
            }}
          >
            {t.criar}
          </Botao>
        </div>
      </div>

      {total === 0 ? (
        <Vazio
          titulo={t.vazio}
          texto={t.vazioAcao}
          acao={
            <Botao
              onClick={() => {
                setAlvo({ tipo: "criar", categoriaId: undefined });
              }}
            >
              {salas.criarSala}
            </Botao>
          }
        />
      ) : (
        categorias.map((c) => {
          const nome = c.titulo ?? t.semCategoria;
          const real = c.id !== CATEGORIA_PADRAO;
          return (
            <section key={c.id} className={css.categoria} aria-label={nome} data-testid="categoria-de-canais">
              <div className={css.categoriaCabeca}>
                <h3 className={css.categoriaTitulo}>{nome}</h3>
                <span className={css.acoesDaLinha}>
                  {real && (
                    <>
                      <Botao
                        variante="fantasma"
                        tamanho="sm"
                        icone={<Editar />}
                        aria-label={t.renomearCategoria(nome)}
                        onClick={() => {
                          setNomeDaCategoria(c.titulo ?? "");
                          setCategoriaNova({ tipo: "renomear", id: c.id, nome });
                        }}
                      />
                      <Botao
                        variante="fantasma"
                        tamanho="sm"
                        icone={<Lixeira />}
                        aria-label={t.apagarCategoria(nome)}
                        onClick={() => {
                          setApagando({ tipo: "categoria", id: c.id, nome });
                        }}
                      />
                    </>
                  )}
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    icone={<Mais />}
                    aria-label={`${t.criar}: ${nome}`}
                    onClick={() => {
                      setAlvo({ tipo: "criar", categoriaId: real ? c.id : undefined });
                    }}
                  />
                </span>
              </div>
              {c.canais.length === 0 ? (
                <p className={css.dica}>{t.categoriaVazia}</p>
              ) : (
                <ul className={css.tabela}>
                  {c.canais.map((id, i) => (
                    <LinhaDeCanal
                      key={id}
                      canalId={id}
                      podeSubir={real && i > 0}
                      podeDescer={real && i < c.canais.length - 1}
                      aoSubir={() => {
                        const ordem = [...c.canais];
                        ordem.splice(i - 1, 0, ...ordem.splice(i, 1));
                        void mover(c.id, ordem);
                      }}
                      aoDescer={() => {
                        const ordem = [...c.canais];
                        ordem.splice(i + 1, 0, ...ordem.splice(i, 1));
                        void mover(c.id, ordem);
                      }}
                      aoEditar={(canalId) => {
                        setAlvo({ tipo: "editar", canalId });
                      }}
                      aoDuplicar={() => {
                        void duplicar(id);
                      }}
                      aoApagar={(nomeDoCanal, voz) => {
                        setApagando({ tipo: "canal", id, nome: nomeDoCanal, voz });
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}

      <Dialogo
        open={alvo !== undefined}
        onOpenChange={(a) => {
          if (!a) setAlvo(undefined);
        }}
      >
        <ConteudoDoDialogo titulo={alvo?.tipo === "editar" ? t.editarTitulo : t.criarTitulo}>
          <FormularioDeCanal
            serverId={serverId}
            alvo={alvo}
            aoFechar={() => {
              setAlvo(undefined);
            }}
          />
        </ConteudoDoDialogo>
      </Dialogo>

      <Dialogo
        open={categoriaNova !== undefined}
        onOpenChange={(a) => {
          if (!a) setCategoriaNova(undefined);
        }}
      >
        <ConteudoDoDialogo
          titulo={categoriaNova?.tipo === "renomear" ? t.renomearCategoria(categoriaNova.nome) : t.criarCategoria}
        >
          <form
            className={css.formulario}
            onSubmit={(e) => {
              void trocarCategoria(e);
            }}
          >
            <div className={css.campo}>
              <label className={css.rotulo} htmlFor="nome-da-categoria">
                {t.nomeDaCategoria}
              </label>
              <input
                id="nome-da-categoria"
                className={css.entrada}
                value={nomeDaCategoria}
                maxLength={32}
                autoFocus
                onChange={(e) => {
                  setNomeDaCategoria(e.target.value);
                }}
              />
            </div>
            <div className={css.rodapeDoDialogo}>
              <Botao
                variante="fantasma"
                onClick={() => {
                  setCategoriaNova(undefined);
                }}
              >
                {comum.cancelar}
              </Botao>
              <Botao type="submit" aria-disabled={nomeDaCategoria.trim() === "" || undefined}>
                {categoriaNova?.tipo === "renomear" ? t.salvarConfirmar : t.criarConfirmar}
              </Botao>
            </div>
          </form>
        </ConteudoDoDialogo>
      </Dialogo>

      <Confirmacao
        aberto={apagando !== undefined}
        aoMudar={(a) => {
          if (!a) setApagando(undefined);
        }}
        titulo={
          apagando?.tipo === "categoria"
            ? t.apagarCategoriaTitulo(apagando.nome)
            : t.apagarTitulo(apagando?.nome ?? "")
        }
        texto={
          apagando?.tipo === "categoria"
            ? t.apagarCategoriaTexto
            : apagando?.voz === true
              ? t.apagarSala
              : t.apagarCanal
        }
        confirmar={t.apagarConfirmar}
        aoConfirmar={async () => {
          if (apagando === undefined) return false;
          const ok =
            apagando.tipo === "categoria"
              ? await apagarCategoria(serverId, apagando.id)
              : await apagarCanal(apagando.id);
          if (ok) toast({ tipo: "info", titulo: t.apagada });
          return ok;
        }}
      />
    </div>
  );
}
