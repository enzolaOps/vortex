import { ArrowLeft, Check, Minus, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { Botao } from "../../components/ui/Botao";
import { aindaNao } from "../../pendente/pendencias";
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
import { useChannel, useCorDeCargo } from "../../store/hooks";
import secao from "../Secao.module.css";
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
 * ⚠ **O banner de dessincronização NÃO entra.** O design o desenha em warning,
 * dizendo "este canal tem N overrides diferentes da categoria" — e categoria
 * não tem permissões no protocolo do Stoat: ela é um array de IDs dentro de
 * `Server`, sem campo de permissão nenhum. Não há com o que comparar, então o
 * banner seria um aviso permanentemente falso. É a mesma linha que o projeto
 * traçou em "Conectado · 42 ms": não inventar dado numa superfície onde a
 * pessoa decide algo.
 */
export function PermissoesDoCanal({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  const serverId = canal?.serverId;

  const [cargos, setCargos] = useState<readonly Cargo[]>([]);
  const [avancadas, setAvancadas] = useState(false);

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

  if (avancadas) {
    return (
      <Avancadas
        channelId={channelId}
        nomeDoCanal={canal.name}
        cargos={cargos}
        aoVoltar={() => setAvancadas(false)}
      />
    );
  }

  /*
    "Canal privado" é o bit `ViewChannel` negado para `default`, e isso o
    protocolo suporta de verdade. É o único interruptor desta tela.
  */
  const bitVer = bitDaPermissao("ViewChannel");
  const padrao = overrideDoCargo(channelId, "default");
  const privado = (padrao.deny & bitVer) !== 0n;

  return (
    <div className={`${secao.forma} ${secao.larga}`}>
      <p className={secao.recado}>
        Use canal privado para o caso comum. A matriz por cargo fica em
        Permissões avançadas.
      </p>

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
          aoAlternar={() => {
            void salvarPermissaoDeCanal(channelId, "default", {
              allow: padrao.allow & ~bitVer,
              deny: privado ? padrao.deny & ~bitVer : padrao.deny | bitVer,
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
            <span className={css.cartaoDetalhe}>
              {cargos.length} cargo{cargos.length === 1 ? "" : "s"} no servidor
            </span>
          </span>
          {/*
            "Adicionar" leva à matriz, e não é pendência: adicionar um alvo É
            dar-lhe um override, e o alvo já se escolhe lá. Um segundo caminho
            para a mesma escrita seria duas telas que precisam concordar.
          */}
          <Botao variante="primario" onClick={() => setAvancadas(true)}>
            Adicionar
          </Botao>
        </header>

        <LinhaDeAcesso
          cor={undefined}
          glifo="@"
          nome="@everyone"
          detalhe="Todo mundo no servidor"
          negado={privado}
        />
        {cargos.map((c) => (
          <LinhaDeAcesso
            key={c.id}
            cor={c.cor}
            glifo="◆"
            nome={c.nome}
            detalhe={`${c.concedidas.length} permissões no servidor`}
            negado={false}
          />
        ))}
      </section>

      <div className={secao.acoes}>
        <Botao variante="sutil" onClick={() => setAvancadas(true)}>
          Permissões avançadas
        </Botao>
        <Botao variante="sutil" onClick={aindaNao("sincronizarComCategoria")}>
          Sincronizar com a categoria
        </Botao>
      </div>
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
  negado,
}: {
  cor: string | undefined;
  glifo: string;
  nome: string;
  detalhe: string;
  negado: boolean;
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
        <span className={css.acessoRotulo}>{nome}</span>
        <span className={css.acessoContagem}>{detalhe}</span>
      </span>
      {negado ? (
        <span className={css.acessoNegado}>sem acesso</span>
      ) : (
        <span className={css.acessoEstado}>acesso total</span>
      )}
    </div>
  );
}

/** O interruptor do design: 38×22, pílula, bolinha de 16 em `on-accent`. */
function Interruptor({
  rotulo,
  ligado,
  aoAlternar,
}: {
  rotulo: string;
  ligado: boolean;
  aoAlternar: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      className={css.interruptor}
      onClick={aoAlternar}
    >
      <span className={css.botaoDoInterruptor} aria-hidden />
    </button>
  );
}

/* ------------------------------------------------ permissões avançadas */

type Estado = "negar" | "herdar" | "permitir";

const OPCOES: readonly { valor: Estado; rotulo: string }[] = [
  { valor: "negar", rotulo: "Negar" },
  { valor: "herdar", rotulo: "Herdar" },
  { valor: "permitir", rotulo: "Permitir" },
];

/**
 * A subpágina da matriz.
 *
 * Cabeçalho com volta e alvo, coluna de 264px com os cargos, matriz à direita
 * com filtro e "Herdar tudo". Os cabeçalhos de grupo GRUDAM — o design escreve
 * isso por extenso, e numa lista de trinta linhas em quatro famílias é o que
 * impede a pessoa de perder de qual família é a linha que está olhando.
 */
function Avancadas({
  channelId,
  nomeDoCanal,
  cargos,
  aoVoltar,
}: {
  channelId: string;
  nomeDoCanal: string;
  cargos: readonly Cargo[];
  aoVoltar: () => void;
}) {
  const [alvo, setAlvo] = useState("default");
  const [busca, setBusca] = useState("");
  const [edicao, setEdicao] = useState<
    { readonly alvo: string; readonly o: OverrideDeCanal } | undefined
  >(undefined);
  const [salvando, setSalvando] = useState(false);

  /*
    O valor do servidor é lido na render e o estado local só existe depois que
    alguém mexeu — carregando o `alvo` junto, para que trocar de cargo o
    invalide sozinho. Sem efeito espelhando estado do servidor, que é o que o
    lint das Rules of React reprovou na primeira versão desta tela.
  */
  const override =
    edicao?.alvo === alvo ? edicao.o : overrideDoCargo(channelId, alvo);

  const escrever = (proximo: OverrideDeCanal) => {
    setEdicao({ alvo, o: proximo });
    setSalvando(true);
    void salvarPermissaoDeCanal(channelId, alvo, proximo).finally(() =>
      setSalvando(false),
    );
  };

  const alvos: readonly { id: string; nome: string; cor: string | undefined }[] =
    [{ id: "default", nome: "@everyone", cor: undefined }, ...cargos];
  const atual = alvos.find((a) => a.id === alvo) ?? alvos[0]!;
  const filtro = busca.trim().toLowerCase();

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
        <Botao variante="sutil" onClick={aindaNao("sincronizarComCategoria")}>
          Sincronizar com a categoria
        </Botao>
      </header>

      <div className={css.avancadasCorpo}>
        <nav className={css.colunaDeAlvos} aria-label="Cargos">
          <p className={css.grupoDeAlvos}>Cargos — {alvos.length}</p>
          {alvos.map((a) => (
            <ItemDeAlvo
              key={a.id}
              cor={a.cor}
              nome={a.nome}
              ativo={a.id === alvo}
              aoEscolher={() => setAlvo(a.id)}
            />
          ))}
        </nav>

        <div className={css.matrizColuna}>
          <div className={css.matrizTopo}>
            <PontoDoAlvo cor={atual.cor} nome={atual.nome} />
            <span className={css.matrizContagem}>
              {contarOverrides(override)} overrides
            </span>
            <Botao
              variante="sutil"
              disabled={salvando}
              onClick={() => escrever({ allow: 0n, deny: 0n })}
            >
              Herdar tudo
            </Botao>
          </div>

          <div className={css.matrizLista}>
            {/*
              O filtro é um campo simples e não o `Campo` de formulário: aqui
              ele é busca, e o design afunda busca em `surface-0` enquanto põe
              campo de formulário em `surface-3`.
            */}
            <input
              className={css.filtro}
              type="search"
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
                        <span className={css.permissaoTexto}>
                          <span className={css.permissaoNome}>{p.rotulo}</span>
                          <span className={css.permissaoConsequencia}>
                            {p.detalhe}
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
                              data-valor={o.valor}
                              className={css.triBotao}
                              aria-pressed={estado === o.valor}
                              aria-label={o.rotulo}
                              disabled={salvando}
                              onClick={() =>
                                escrever(aplicar(override, bit, o.valor))
                              }
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

/** Um cargo na coluna de alvos, com o ponto colorido do design. */
function ItemDeAlvo({
  cor,
  nome,
  ativo,
  aoEscolher,
}: {
  cor: string | undefined;
  nome: string;
  ativo: boolean;
  aoEscolher: () => void;
}) {
  const tinta = useCorDeCargo(cor);
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
      {nome}
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

/** Quantos bits este canal DECIDE, em vez de herdar. É o número do design. */
function contarOverrides(o: OverrideDeCanal): number {
  let n = 0;
  for (const grupo of PERMISSOES) {
    for (const p of grupo.itens) {
      const bit = bitDaPermissao(p.id);
      if (bit !== 0n && ((o.allow | o.deny) & bit) !== 0n) n += 1;
    }
  }
  return n;
}
