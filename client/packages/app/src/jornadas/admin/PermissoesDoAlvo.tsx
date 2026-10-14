import type { OverrideDeCanal } from "nucleo/sdk/canal";
import { salvarPermissaoDeCanal } from "nucleo/sdk/canal";
import {
  conjuntoDaCategoriaPorId,
  conjuntoDoCanal,
  salvarPermissoesDaCategoria,
  type ConjuntoDeSobreposicoes,
} from "nucleo/sdk/categorias";
import { bitDaPermissao, cargosDoServidor, PERMISSOES } from "nucleo/sdk/cargos";
import { pode, podeNoServidor } from "nucleo/sdk/permissoes";
import { useChannel } from "nucleo/store/hooks";
import { useState } from "react";

import { permissoesDeAlvo as t } from "../../textos";
import { toast } from "../../ui/primitivos/Avisos";
import { BarraDeSalvar } from "../config/controles";
import css from "./admin.module.css";

export type AlvoDePermissoes =
  | { readonly tipo: "canal"; readonly id: string }
  | { readonly tipo: "categoria"; readonly id: string };

type Estado = "herdar" | "permitir" | "negar";

/** A chave de @everyone no rascunho; os cargos entram pelo ID. */
const TODOS = "@todos";

const ZERO: OverrideDeCanal = { allow: 0n, deny: 0n };
const vazio = (o: OverrideDeCanal | undefined) => o === undefined || (o.allow === 0n && o.deny === 0n);
const iguais = (a: OverrideDeCanal | undefined, b: OverrideDeCanal | undefined) =>
  (vazio(a) && vazio(b)) || (a?.allow === b?.allow && a?.deny === b?.deny);

const doAlvo = (c: ConjuntoDeSobreposicoes, chave: string) => (chave === TODOS ? c.padrao : c.cargos[chave]);

function comValor(c: ConjuntoDeSobreposicoes, chave: string, o: OverrideDeCanal | undefined): ConjuntoDeSobreposicoes {
  if (chave === TODOS) return { ...c, padrao: o };
  const cargos = { ...c.cargos };
  if (o === undefined) delete cargos[chave];
  else cargos[chave] = o;
  return { ...c, cargos };
}

function estadoDe(o: OverrideDeCanal | undefined, bit: bigint): Estado {
  if (o === undefined || bit === 0n) return "herdar";
  if ((o.allow & bit) === bit) return "permitir";
  if ((o.deny & bit) === bit) return "negar";
  return "herdar";
}

/** Troca só o bit mexido: allow e deny são máscaras de 64 bits, então tudo em BigInt. */
function comEstado(o: OverrideDeCanal | undefined, bit: bigint, estado: Estado): OverrideDeCanal {
  const base = o ?? ZERO;
  const allow = estado === "permitir" ? base.allow | bit : base.allow & ~bit;
  const deny = estado === "negar" ? base.deny | bit : base.deny & ~bit;
  return { allow, deny };
}

/** Os alvos cujo par mudou, com o padrão primeiro: é nele que mora a privacidade do canal. */
function alvosMudados(inicial: ConjuntoDeSobreposicoes, rascunho: ConjuntoDeSobreposicoes): string[] {
  const chaves = new Set([...Object.keys(inicial.cargos), ...Object.keys(rascunho.cargos)]);
  const lista = [...chaves].filter((k) => !iguais(inicial.cargos[k], rascunho.cargos[k]));
  return iguais(inicial.padrao, rascunho.padrao) ? lista : [TODOS, ...lista];
}

function semZeros(c: ConjuntoDeSobreposicoes): ConjuntoDeSobreposicoes {
  return {
    padrao: vazio(c.padrao) ? undefined : c.padrao,
    cargos: Object.fromEntries(Object.entries(c.cargos).filter(([, o]) => !vazio(o))),
  };
}

const ESTADOS: readonly { readonly id: Estado; readonly rotulo: string }[] = [
  { id: "herdar", rotulo: t.herdar },
  { id: "permitir", rotulo: t.permitir },
  { id: "negar", rotulo: t.negar },
];

function TriEstado({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  valor: Estado;
  aoMudar: (e: Estado) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={css.tri}>
      {ESTADOS.map((e) => (
        <button
          key={e.id}
          type="button"
          role="radio"
          aria-checked={valor === e.id}
          aria-label={`${rotulo}: ${e.rotulo}`}
          data-estado={e.id}
          className={css.triOpcao}
          onClick={() => {
            aoMudar(e.id);
          }}
        >
          {e.rotulo}
        </button>
      ))}
    </div>
  );
}

/**
 * Permissões de um canal ou de uma categoria: lista de cargos (com "todos") e,
 * para o selecionado, cada permissão em três estados — herdar, permitir, negar.
 *
 * O rascunho vive aqui e só vai ao servidor no "Salvar". Se o servidor recusar,
 * o rascunho fica: quem mexeu em dez permissões não refaz o trabalho.
 */
export function PermissoesDoAlvo({
  serverId,
  alvo,
  aoMudarSujo,
}: {
  serverId: string;
  alvo: AlvoDePermissoes;
  /** Avisa quem hospeda o diálogo se há rascunho, para pedir confirmação ao fechar. */
  aoMudarSujo: (sujo: boolean) => void;
}) {
  const canal = useChannel(alvo.tipo === "canal" ? alvo.id : "");
  const permitido =
    alvo.tipo === "canal" ? pode(alvo.id, "gerenciarPermissoes") : podeNoServidor(serverId, "gerenciarPermissoes");
  const [inicial, setInicial] = useState<ConjuntoDeSobreposicoes | undefined>(() =>
    alvo.tipo === "canal" ? conjuntoDoCanal(alvo.id) : conjuntoDaCategoriaPorId(serverId, alvo.id),
  );
  const [rascunho, setRascunho] = useState<ConjuntoDeSobreposicoes | undefined>(inicial);
  const [escolhido, setEscolhido] = useState(TODOS);
  const [salvando, setSalvando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  if (!permitido) {
    return (
      <p className={css.aviso} role="note">
        {t.semPermissao}
      </p>
    );
  }
  if (inicial === undefined || rascunho === undefined) {
    return (
      <p className={css.erro} role="alert">
        {t.naoEncontrado}
      </p>
    );
  }

  const cargos = cargosDoServidor(serverId);
  const mudados = alvosMudados(inicial, rascunho);
  const sujo = mudados.length > 0;
  const atual = doAlvo(rascunho, escolhido);
  // Canal de texto não tem voz; sala de voz e categoria mostram as duas famílias.
  const grupos = PERMISSOES.filter(
    (g) => g.titulo === "Canais de texto" || (g.titulo === "Voz" && canal?.tipo !== "texto"),
  );

  const mudar = (id: string, estado: Estado) => {
    const bit = bitDaPermissao(id);
    if (bit === 0n) return;
    const novo = comValor(rascunho, escolhido, comEstado(atual, bit, estado));
    setRascunho(novo);
    aoMudarSujo(alvosMudados(inicial, novo).length > 0);
  };

  const descartar = () => {
    setRascunho(inicial);
    aoMudarSujo(false);
    setFalhou(false);
  };

  const salvar = async () => {
    setSalvando(true);
    setFalhou(false);
    let ok = true;
    let aplicado = inicial;
    if (alvo.tipo === "categoria") {
      ok = await salvarPermissoesDaCategoria(serverId, alvo.id, semZeros(rascunho));
      if (ok) aplicado = rascunho;
    } else {
      for (const chave of mudados) {
        const novo = doAlvo(rascunho, chave) ?? ZERO;
        ok = await salvarPermissaoDeCanal(alvo.id, chave === TODOS ? undefined : chave, novo);
        if (!ok) break;
        aplicado = comValor(aplicado, chave, doAlvo(rascunho, chave));
      }
    }
    setSalvando(false);
    setInicial(aplicado);
    aoMudarSujo(alvosMudados(aplicado, rascunho).length > 0);
    if (ok) toast({ tipo: "info", titulo: t.salvo });
    else if (alvo.tipo === "canal") setFalhou(true); // categoria: o aviso vem do toast do nucleo
  };

  const nomeDe = (chave: string) => (chave === TODOS ? t.todos : (cargos.find((c) => c.id === chave)?.nome ?? chave));

  return (
    <div className={css.permissoesAlvo} data-testid="permissoes-do-alvo">
      <p className={css.dica}>{alvo.tipo === "canal" ? t.ajudaCanal : t.ajudaCategoria}</p>
      {cargos.length === 0 && (
        <p className={css.aviso} role="note">
          {t.semCargos}
        </p>
      )}
      <div className={css.cargos}>
        <ul className={css.listaDeCargos} aria-label={t.quemLista}>
          {[TODOS, ...cargos.map((c) => c.id)].map((chave) => (
            <li key={chave} className={css.cargoLinha}>
              <button
                type="button"
                className={css.cargoItem}
                aria-current={escolhido === chave}
                onClick={() => {
                  setEscolhido(chave);
                }}
              >
                <span className={css.cargoNome}>{nomeDe(chave)}</span>
                {!vazio(doAlvo(rascunho, chave)) && <span className={css.meta}>{t.personalizado}</span>}
              </button>
              <span />
            </li>
          ))}
        </ul>

        <div className={css.editor}>
          {escolhido === TODOS && <p className={css.dica}>{t.todosAjuda}</p>}
          {grupos.map((g) => (
            <section key={g.titulo} aria-label={g.titulo} className={css.grupoDePermissoes}>
              {g.itens.map((p) => (
                <div key={p.id} className={css.permissao} data-permissao={p.id}>
                  <div className={css.permissaoTextos}>
                    <span>{p.rotulo}</span>
                    <span className={css.dica}>{p.detalhe}</span>
                  </div>
                  <TriEstado
                    rotulo={p.rotulo}
                    valor={estadoDe(atual, bitDaPermissao(p.id))}
                    aoMudar={(e) => {
                      mudar(p.id, e);
                    }}
                  />
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>

      {falhou && (
        <p className={css.erro} role="alert">
          {t.falhou}
        </p>
      )}
      {sujo && <BarraDeSalvar salvando={salvando} aoDescartar={descartar} aoSalvar={() => void salvar()} />}
    </div>
  );
}
