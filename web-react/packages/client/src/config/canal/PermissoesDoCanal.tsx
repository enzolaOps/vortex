import { Check, Minus, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { Botao } from "../../components/ui/Botao";
import {
  overrideDoCargo,
  salvarPermissaoDeCanal,
  type OverrideDeCanal,
} from "../../sdk/canal";
import {
  bitDaPermissao,
  listarCargos,
  PERMISSOES,
  type Cargo,
} from "../../sdk/cargos";
import { aindaNao } from "../../pendente/pendencias";
import { useChannel } from "../../store/hooks";
import secao from "../Secao.module.css";
import css from "./Canal.module.css";

/**
 * Permissões por canal — a matriz tri-state do design.
 *
 * ⚠ **Tri-state e não interruptor, e a diferença é o conceito inteiro.** Um
 * bit pode estar em `allow`, em `deny`, ou em NENHUM dos dois — e o terceiro
 * caso é *herdar do cargo*, que não é o mesmo que negar. Um interruptor de
 * dois estados obrigaria a escolher entre permitir e negar em todo canal, o
 * que é exatamente o que as permissões por canal existem para evitar.
 *
 * O protocolo suporta isto de verdade: `PUT /channels/{id}/permissions/{role}`
 * recebe o par. É a única tela desta seção sem nenhum controle pendente — e
 * ela era a "dívida real da etapa 5" registrada no `CLAUDE.md`.
 *
 * ⚠ **"Sincronizar com a categoria" é pendente, e não por falta de tempo:**
 * categoria não tem permissões no protocolo do Stoat — ela é um array de IDs
 * dentro de `Server`, sem campo de permissão nenhum. Sincronizar com algo que
 * não guarda estado não é implementável, é uma feature de backend.
 *
 * A escrita é POR CARGO e imediata, não um formulário com salvar: o protocolo
 * escreve um cargo por chamada, e juntar num botão só faria uma falha no meio
 * deixar metade aplicada sem ninguém saber qual metade.
 */
export function PermissoesDoCanal({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  const serverId = canal?.serverId;

  const [cargos, setCargos] = useState<readonly Cargo[]>([]);
  const [alvo, setAlvo] = useState<string>("default");
  /*
    ⚠ **A edição local é guardada COM o cargo a que pertence, e não espelhada
    por efeito.**

    A primeira versão fazia `useEffect(() => setOverride(...), [alvo])`, e o
    lint reprovou: `setState` síncrono dentro de efeito dispara uma segunda
    render em cascata. O conserto certo não é silenciar — é não espelhar. O
    valor do servidor é lido na render; o estado local só existe depois que
    alguém mexeu, e ele carrega o `alvo` junto para que trocar de cargo o
    invalide sozinho, sem efeito nenhum.
  */
  const [edicao, setEdicao] = useState<
    { readonly alvo: string; readonly o: OverrideDeCanal } | undefined
  >(undefined);
  const [salvando, setSalvando] = useState(false);

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

  const override =
    edicao?.alvo === alvo ? edicao.o : overrideDoCargo(channelId, alvo);

  const escrever = (proximo: OverrideDeCanal) => {
    setEdicao({ alvo, o: proximo });
    setSalvando(true);
    void salvarPermissaoDeCanal(channelId, alvo, proximo).finally(() =>
      setSalvando(false),
    );
  };

  return (
    <div className={`${secao.forma} ${secao.larga}`}>
      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Quem pode acessar este canal?</h2>
        <div className={css.grade}>
          {/* "Todos" é o cargo `default` do protocolo — o que vale para quem
              não tem cargo nenhum. Ele vem primeiro porque é o piso: mexer
              nele muda o acesso de mais gente que qualquer outro. */}
          {[{ id: "default", nome: "Todos" }, ...cargos].map((c) => (
            <Botao
              key={c.id}
              variante={c.id === alvo ? "primario" : "sutil"}
              onClick={() => setAlvo(c.id)}
            >
              {c.nome}
            </Botao>
          ))}
        </div>
      </section>

      <section className={secao.bloco}>
        <div className={secao.acoes}>
          <Botao variante="sutil" onClick={aindaNao("sincronizarComCategoria")}>
            Sincronizar com a categoria
          </Botao>
          <Botao
            variante="sutil"
            disabled={salvando}
            onClick={() => escrever({ allow: 0n, deny: 0n })}
          >
            Herdar tudo
          </Botao>
        </div>

        <div className={css.matriz}>
          {PERMISSOES.map((grupo) => (
            <div key={grupo.titulo}>
              <p className={css.grupoDePermissao}>{grupo.titulo}</p>
              {grupo.itens.map((p) => (
                <Linha
                  key={p.id}
                  nome={p.rotulo}
                  consequencia={p.detalhe}
                  estado={estadoDe(override, bitDaPermissao(p.id))}
                  disabled={salvando}
                  aoMudar={(e) =>
                    escrever(aplicar(override, bitDaPermissao(p.id), e))
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type Estado = "negar" | "herdar" | "permitir";

/**
 * O estado de um bit no par.
 *
 * ⚠ `deny` é conferido ANTES de `allow`, e a ordem importa: o protocolo não
 * proíbe um bit estar nos dois, e nesse caso quem ganha é a negação. Ler na
 * ordem inversa mostraria "permitido" para um bit que o servidor nega.
 */
function estadoDe(o: OverrideDeCanal, bit: bigint): Estado {
  if ((o.deny & bit) !== 0n) return "negar";
  if ((o.allow & bit) !== 0n) return "permitir";
  return "herdar";
}

/** Move um bit para o estado pedido, tirando-o do outro lado. */
function aplicar(o: OverrideDeCanal, bit: bigint, e: Estado): OverrideDeCanal {
  const allow = e === "permitir" ? o.allow | bit : o.allow & ~bit;
  const deny = e === "negar" ? o.deny | bit : o.deny & ~bit;
  return { allow, deny };
}

const OPCOES: readonly { valor: Estado; rotulo: string }[] = [
  { valor: "negar", rotulo: "Negar" },
  { valor: "herdar", rotulo: "Herdar" },
  { valor: "permitir", rotulo: "Permitir" },
];

function Linha({
  nome,
  consequencia,
  estado,
  disabled,
  aoMudar,
}: {
  nome: string;
  consequencia: string;
  estado: Estado;
  disabled: boolean;
  aoMudar: (e: Estado) => void;
}) {
  return (
    <div className={css.linhaDePermissao}>
      <span className={css.permissaoTexto}>
        <span className={css.permissaoNome}>{nome}</span>
        <span className={css.permissaoConsequencia}>{consequencia}</span>
      </span>
      {/*
        `role="radiogroup"` e não três botões soltos: os três são
        mutuamente exclusivos, e sem o grupo o leitor de tela anuncia
        "Negar, pressionado" sem dizer de que conjunto ele faz parte.
      */}
      <span className={css.triEstado} role="radiogroup" aria-label={nome}>
        {OPCOES.map((o) => (
          <button
            key={o.valor}
            type="button"
            data-valor={o.valor}
            className={css.triBotao}
            aria-pressed={estado === o.valor}
            aria-label={o.rotulo}
            disabled={disabled}
            onClick={() => aoMudar(o.valor)}
          >
            {o.valor === "negar" ? (
              <X aria-hidden />
            ) : o.valor === "herdar" ? (
              <Minus aria-hidden />
            ) : (
              <Check aria-hidden />
            )}
          </button>
        ))}
      </span>
    </div>
  );
}
