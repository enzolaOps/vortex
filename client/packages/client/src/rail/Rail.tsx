import {
  CaretDown,
  DownloadSimple,
  Envelope,
  ICONE,
  Plus,
} from "../components/ui/icones";
import { memo, useSyncExternalStore, type CSSProperties } from "react";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../components/ui/ContextMenu";
import { MenuDeContexto } from "../components/ui/MenuDeContexto";
import { ItensDoServidor } from "../menus/ItensDoServidor";
import { Tooltip } from "../components/ui/Tooltip";
import { contagem, plural, rotuloDeNaoLidas } from "../lib/plural";
import { linkDeDownload, plataformaDoNavegador } from "../lib/downloadDoDesktop";
import { assinarDesktop, lerDesktop } from "../store/desktop";
import { corDoTextoDe, gradienteDe } from "../lib/gradiente";
import {
  useLocal,
  useServer,
  useServerIds,
  useServidorAtivo,
  useSomaDeServidores,
  useCorDeCargo,
  useNaoLidasDeConversas,
} from "../store/hooks";
import { administrar } from "../store/administracao";
import {
  agrupar,
  alternarColapsoDaPasta,
  assinarPastas,
  lerPastas,
  removerPasta,
  type Pasta,
} from "../store/pastas";
import { abrirModal } from "../store/modais";
import { assinarChamadaRecebida, lerChamadaRecebida } from "../store/chamadaRecebida";
import { irParaCasa, selecionarServidor } from "../store/navegacao";
import { Selo } from "../components/ui/Selo";
import css from "./Rail.module.css";
import { ItemDeId } from "../components/ui/ItemDeId";

/**
 * Um servidor. Assina a si mesmo — a lista acima só conhece IDs.
 *
 * `memo` pela mesma razão do `MessageRow`: o rail re-renderiza quando o
 * servidor ATIVO muda, e sem isto os 40 itens remontariam a cada troca.
 * Aqui o React Compiler até compila (não há hook incompatível), mas ele
 * memoiza o corpo, não a identidade do elemento filho — quem corta a cascata
 * de re-render é `memo`.
 */
const ItemDeServidor = memo(function ItemDeServidor({
  id,
  ativo,
  naPasta = false,
}: {
  id: string;
  ativo: boolean;
  /** Dentro de pasta o ladrilho é menor — 40px contra 44, como no design. */
  naPasta?: boolean;
}) {
  const servidor = useServer(id);

  // Placeholder com a MESMA caixa do item real. `null` aqui não trava nada
  // (o rail não é virtualizado), mas encolher e crescer faria o rail pular
  // durante a hidratação — e é o mesmo princípio da linha que nunca mede 0px.
  if (!servidor) {
    return (
      <span className={css.item} data-napasta={naPasta} aria-hidden>
        <span className={css.marca} />
      </span>
    );
  }

  const temNaoLidas = servidor.naoLidas > 0;
  /*
    O ponto é "não lida SEM menção" (D-NOTIF-18). Com menção quem fala é o
    pill, e os dois juntos diriam a mesma coisa duas vezes — o design escreve
    a regra como exclusão: "Ponto branco = há mensagem não lida sem menção".
  */
  const pontoDeNaoLida = temNaoLidas && servidor.mencoes === 0;

  return (
    /*
      `fim`, não `right`.

      O Radix só fala `side` físico, e por isso este componente carregava um
      `lado="right"` com uma nota dizendo que a colisão automática cobria o
      caso real. Cobria — mas a premissa de lado ficava escrita aqui, que é o
      que a lei nº 6 proíbe. O mapeamento lógico→físico agora vive no wrapper,
      lê a direção real do documento, e o rail volta a não saber de que lado
      da tela ele está.
    */
    <MenuDeContexto
      gatilho={
        /*
          ⚠ **A ponte entre os dois `asChild`, e sem ela o menu não abre.**

          O gatilho funde os próprios handlers no filho — e o filho aqui é o
          `Tooltip`, que é um `Root` do Radix e não renderiza DOM nenhum. Os
          handlers do menu não pousavam em elemento algum: o botão direito
          simplesmente não fazia nada, sem erro.

          É a MESMA armadilha já registrada na member list, onde o gatilho
          disputava com o cartão de perfil. `display: contents` para a ponte
          não criar caixa: o rail é um flex, e um wrapper com layout próprio
          mudaria o alinhamento dos ladrilhos.
        */
        <span className={css.ponte}>
    <Tooltip texto={servidor.name} lado="fim">
      <button
        type="button"
        className={css.item}
        data-napasta={naPasta}
        aria-current={ativo}
        aria-label={servidor.name}
        data-naolidas={temNaoLidas}
        onClick={() => selecionarServidor(id)}
      >
        {/*
          O indicador é a BARRA do design, e ela substituiu a lâmina.

          A lâmina era a assinatura da identidade anterior — três espirais com
          opacidade escalonada, tirada da marca. A identidade nova marca estado
          com uma barra sólida na borda de início: 3px de largura, ALTA no
          ativo e curta na não-lida. Mesmo mecanismo, forma diferente.

          `inset-inline-start` e não `left`: o rail continua sem saber de que
          lado da tela ele está, que é a lei nº 6.
        */}
        <span
          className={css.barra}
          data-estado={ativo ? "ativa" : pontoDeNaoLida ? "atencao" : "repouso"}
          aria-hidden
        />

        <span
          className={css.marca}
          aria-hidden
          /*
            O ladrilho é PREENCHIDO com um gradiente derivado do ID.

            Era um quadrado cinza com duas iniciais, igual para todo servidor —
            e é o que mais fazia a tela parecer outro produto. O design desenha
            cada servidor com um gradiente próprio; aqui ele sai do ID, então é
            estável entre sessões e igual para todo mundo que vê o mesmo
            servidor. A luminosidade é fixa, o matiz é do ID: um teste varre os
            3.600 e prova que a inicial fica legível em qualquer um.

            `style` inline é o lugar certo: o valor vem do DADO, como a cor de
            cargo. Não é valor mágico escrito por quem programa.
          */
          style={{
            backgroundImage: gradienteDe(id),
            color: corDoTextoDe(id),
          }}
        >
          {servidor.sigla}

          {/*
            O ícone real POR CIMA do gradiente, com a mesma disciplina do
            `Avatar`: enquanto ele não chega — ou se falhar — o ladrilho
            continua sendo o gradiente do ID, que identifica. Trocar um pelo
            outro deixaria o rail piscando em cinza a cada abertura.
          */}
          {servidor.avatarUrl !== undefined ? (
            <img
              className={css.icone}
              src={servidor.avatarUrl}
              alt=""
              loading="lazy"
            />
          ) : null}

          {servidor.mencoes > 0 ? (
            <Selo
              forma="contagem"
              tom="perigo"
              className={css.contador}
            >
              {contagem(servidor.mencoes)}
            </Selo>
          ) : null}
        </span>

        <span className={css.nome}>{servidor.name}</span>

        {/*
          Não-lidas nunca só por forma.

          A pílula sozinha é invisível para leitor de tela e some para quem
          usa `prefers-reduced-motion` com transição desligada. O texto é o
          que carrega o dado; a pílula é o atalho visual.
        */}
        {temNaoLidas ? (
          <span className="sr-only">
            {rotuloDeNaoLidas(servidor.naoLidas, servidor.mencoes)}
          </span>
        ) : null}
      </button>
    </Tooltip>
        </span>
      }
    >

      {/*
        O menu do SERVIDOR, e ele é o MESMO do `▾` do cabeçalho da coluna e do
        clique direito nele.

        ⚠ **Eram dois menus sem um item em comum.** Este dava privacidade e
        pastas; o `▾` dava criar canal e as treze seções de configuração. A
        mesma entidade respondendo coisas diferentes conforme onde a mão pousa
        — ver `menus/ItensDoServidor.tsx`.
      */}
      <ItensDoServidor serverId={id} />
    </MenuDeContexto>
  );
});

/**
 * Uma pasta do rail.
 *
 * ⚠ **Pasta é conceito de CLIENTE — o protocolo não a tem.** O Stoat guarda
 * ordem de servidor em configuração de usuário e nada mais. Ver
 * `store/pastas.ts`: local, no dispositivo, sincronia listada como pendência.
 *
 * Colapsada mostra os ladrilhos empilhados e cortados; aberta, todos. O rótulo
 * fica embaixo em caixa alta minúscula — é do design, e a razão é que ele
 * precisa caber em 72px sem competir com os ladrilhos.
 */
const PastaDoRail = memo(function PastaDoRail({
  pasta,
  ativo,
}: {
  pasta: Pasta;
  ativo: string;
}) {
  const temAtivo = pasta.servidores.includes(ativo);

  /*
    A soma dos servidores dentro — D-EVT-48.

    Colapsada, os ladrilhos deixam de existir na tela, e sem esta soma a pasta
    fechada esconderia toda não-lida que estivesse dentro dela. É a mesma razão
    pela qual o comentário antigo mantinha os ladrilhos montados e recortados;
    a soma resolve o mesmo problema mostrando o NÚMERO em vez de escondendo os
    ícones atrás de um `overflow`.
  */
  const soma = useSomaDeServidores(pasta.servidores);
  const temNaoLidas = soma.naoLidas > 0;

  /*
    A tinta da seta, passada pelo MESMO clamp de L da cor de cargo.

    O design oferece cinco hexes escolhidos e pode escrever `color: folderHex`
    cru; aqui o `＋` aceita qualquer um, e um hex escuro sobre um fundo a 20%
    dele mesmo daria uma seta que não se vê. Reusar o clamp em vez de escrever
    um segundo é o que garante que as duas superfícies envelheçam juntas.
  */
  const tinta = useCorDeCargo(pasta.cor);

  /*
    Uma declaração só, na caixa da pasta — a alça HERDA as duas.

    ⚠ **E aqui quase entrou uma correção para um defeito que não existe.**
    Medindo a troca de cor, a caixa seguia a cor nova e a alça ficava na
    anterior; reload fazia as duas concordarem, o que parecia invalidação de
    `color-mix()` com custom property herdada. Era o PAINEL DO NAVEGADOR
    ESCONDIDO: sem quadros, a `CSSTransition` da alça fica com
    `currentTime: 0` para sempre, e `getComputedStyle` devolve o valor de
    PARTIDA. Com `getAnimations().finish()` ela vai para
    `oklab(0.748 −0.137 …/0.2)`, que é a cor certa — e trocando a var só no
    ancestral a alça acompanha igual.

    Fica escrito porque a conclusão errada era a confortável, e o conserto dela
    (duplicar as duas custom properties em todo filho que compõe cor) teria
    ficado no código para sempre.
  */
  const pintura = {
    "--vx-pasta-cor": pasta.cor,
    "--vx-pasta-tinta": tinta,
  } as CSSProperties;

  return (
    <div
      className={css.pasta}
      data-colapsada={pasta.colapsada}
      /*
        A cor da pasta chega por custom property, e o CSS a compõe.

        ⚠ **Ela era GRAVADA e o rail não a usava** — o fundo era sempre
        `--vx-state-selected`, ou seja o acento, e escolher uma cor no editor
        não mudava nada na tela. `style` inline é o lugar certo pela mesma
        razão do gradiente do ladrilho: o valor vem do DADO, não de quem
        programa.

        Ela tinge o FUNDO (10%) e a alça (20%) — nunca os ícones, que precisam
        manter a identidade de cada servidor. É instrução literal do design.
      */
      style={pintura}
    >
      <MenuDeContexto
        gatilho={
          <button
            type="button"
            className={css.alcaDaPasta}
            aria-expanded={!pasta.colapsada}
            aria-label={`Pasta ${pasta.nome}`}
            onClick={() => alternarColapsoDaPasta(pasta.id)}
          >
            <CaretDown
              size={ICONE.calha}
              aria-hidden
              className={css.setaDaPasta}
              data-aberta={!pasta.colapsada}
            />
          </button>
        }
      >
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => alternarColapsoDaPasta(pasta.id)}>
            {pasta.colapsada ? "Expandir pasta" : "Recolher pasta"}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              administrar({ tipo: "editarPasta", pastaId: pasta.id })
            }
          >
            Editar pasta
          </ContextMenuItem>
          <ContextMenuSeparator />
          {/*
            "Desfazer" e não "excluir": os servidores voltam a ser soltos,
            nenhum sai. Quem apaga uma pasta espera perder o AGRUPAMENTO, e o
            rótulo precisa dizer isso antes do clique.
          */}
          <ContextMenuItem perigo onSelect={() => removerPasta(pasta.id)}>
            Desfazer pasta
          </ContextMenuItem>

          <ItemDeId id={pasta.id} />
        </ContextMenuContent>
      </MenuDeContexto>

      {/*
        ⚠ **O comentário anterior aqui dizia que os ladrilhos ficavam MONTADOS
        e recortados, para a pasta não perder o realce de não-lida ao fechar —
        e essa razão morreu.** Quem carrega a não-lida agora é a soma, que vale
        fechada e aberta; o recorte a `block-size: 0` custava quarenta nós de
        DOM invisíveis por pasta e não desenhava a prévia que o design pede.

        Colapsada: até QUATRO ladrilhos de 19px em grade 2×2 — os gradientes
        saem só do ID, então a prévia não assina servidor nenhum. Aberta: os
        ladrilhos de verdade, cada um assinando a si mesmo.
      */}
      {pasta.colapsada ? (
        <div className={css.previaDaPasta} aria-hidden>
          {pasta.servidores.slice(0, 4).map((id) => (
            <span
              key={id}
              className={css.previaDeServidor}
              style={{ backgroundImage: gradienteDe(id) }}
            />
          ))}
        </div>
      ) : (
        <div className={css.conteudoDaPasta}>
          {pasta.servidores.map((id) => (
            <ItemDeServidor key={id} id={id} ativo={id === ativo} naPasta />
          ))}
        </div>
      )}

      <span className={css.nomeDaPasta} aria-hidden>
        {pasta.nome}
      </span>

      {/*
        A soma das menções, sobre a prévia — e só com a pasta fechada.

        Aberta, cada ladrilho já mostra o próprio contador, e um total por cima
        somaria o mesmo número duas vezes na mesma caixa.
      */}
      {pasta.colapsada && soma.mencoes > 0 ? (
        <Selo forma="contagem" tom="perigo" className={css.contadorDaPasta}>
          {contagem(soma.mencoes)}
        </Selo>
      ) : null}

      {/*
        A barra: ATIVA quando o servidor aberto está dentro, ATENÇÃO quando há
        não-lida somada. Só com a pasta fechada — aberta, quem marca é a barra
        do ladrilho de dentro, e duas barras na mesma coluna diriam a mesma
        coisa duas vezes.
      */}
      {pasta.colapsada && (temAtivo || (temNaoLidas && soma.mencoes === 0)) ? (
        <span
          className={css.barra}
          data-estado={temAtivo ? "ativa" : "atencao"}
          aria-hidden
        />
      ) : null}

      {/* O dado, nunca só por forma — a mesma regra do ladrilho de servidor. */}
      {pasta.colapsada && (temNaoLidas || soma.mencoes > 0) ? (
        <span className="sr-only">
          {rotuloDeNaoLidas(soma.naoLidas, soma.mencoes)}
        </span>
      ) : null}
    </div>
  );
});

/**
 * A entrada Conversas — DM, grupo e notas.
 *
 * Componente próprio para as DUAS subscrições dele não acordarem o rail
 * inteiro: o número de conversas muda a cada mensagem de DM, e o toque de
 * chamada entra e sai sozinho.
 *
 * ⚠ **O pill conta DMs e CHAMADAS, e é D-NOTIF-17.** O design escreve a regra
 * inteira — *"Pill numérico = menções diretas, DMs e chamadas. Sempre em
 * danger."* — e o rail só tinha o pill no ladrilho de servidor: uma DM nova
 * não deixava marca nenhuma na coluna que responde "para onde eu vou agora".
 * A chamada tocando soma um porque é a mais urgente das três e é a única que
 * não vira não-lida em canal nenhum.
 */
function EntradaDeConversas({ ativa }: { ativa: boolean }) {
  const naoLidas = useNaoLidasDeConversas();
  const tocando = useSyncExternalStore(assinarChamadaRecebida, lerChamadaRecebida);
  const pendentes = naoLidas + (tocando === undefined ? 0 : 1);

  return (
    <Tooltip texto="Conversas" lado="fim">
      <button
        type="button"
        className={css.item}
        aria-current={ativa}
        aria-label="Conversas"
        data-naolidas={pendentes > 0}
        onClick={irParaCasa}
      >
        <span
          className={css.barra}
          /* Sem ponto: aqui tudo que conta é pill — DM, menção e chamada. */
          data-estado={ativa ? "ativa" : "repouso"}
          aria-hidden
        />
        <span className={`${css.marca} ${css.marcaCasa}`} aria-hidden>
          {/* Envelope, e é o ícone do design — não uma casa. A entrada
              agrega DM, grupo e notas, e o desenho dela é correspondência.
              `fill` só no ativo: é a variação SEMÂNTICA do ícone. */}
          <Envelope size={ICONE.calha} weight={ativa ? "fill" : "regular"} />

          {pendentes > 0 ? (
            <Selo forma="contagem" tom="perigo" className={css.contador}>
              {contagem(pendentes)}
            </Selo>
          ) : null}
        </span>
        <span className={css.nome}>Conversas</span>

        {/* O dado, nunca só por forma — a mesma regra do ladrilho de servidor. */}
        {pendentes > 0 ? (
          <span className="sr-only">
            {plural(pendentes, "aviso de conversa", "avisos de conversa")}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}

/**
 * O rail de servidores.
 *
 * NÃO é virtualizado, e isso é decisão medida contra a lei nº 2, não
 * esquecimento: a lei existe porque retrofitar virtualização é reescrever a
 * tela. O que torna o retrofit barato aqui é a FORMA — a lista renderiza IDs e
 * cada item assina a própria entidade, que é exatamente a forma que um
 * `useVirtualizer` consome. Trocar o `.map()` por `getVirtualItems()` não toca
 * no `ItemDeServidor`.
 *
 * O gatilho para fazer a troca está escrito em `enforcement.md`: acima de ~200
 * servidores. Abaixo disso, o custo de montagem é menor que o do virtualizador.
 */
export function Rail() {
  const ids = useServerIds();
  const { naCasca } = useSyncExternalStore(assinarDesktop, lerDesktop);
  const ativo = useServidorAtivo();
  const pastas = useSyncExternalStore(assinarPastas, lerPastas);
  /*
    O agrupamento roda no RENDER e não no store.

    Ele depende de DUAS fontes — as pastas e a lista de servidores do adapter —
    e um derivado guardado no store precisaria ser invalidado quando qualquer
    uma mudasse, que é o tipo de acoplamento que produz snapshot velho. São
    dezenas de itens, e o React Compiler memoiza o corpo do componente.
  */
  const itens = agrupar(ids, pastas);
  const local = useLocal();
  const naCasa = local.tipo === "casa" || local.tipo === "amigos" || local.tipo === "dm";

  return (
    <nav className={css.rail} aria-label="Servidores">
      {/*
        A casa, e ela é a primeira coisa do rail por um motivo estrutural: sem
        este botão, DM, grupo e amigos não têm por onde ser alcançados. O rail
        listava SÓ servidores, e essa ausência derrubava quatro superfícies de
        uma vez — foi assim que o mapa de superfícies a classificou.
      */}
      <EntradaDeConversas ativa={naCasa} />

      {/*
        O divisor entre as conversas e os servidores.

        É do design, e ele carrega significado: acima da linha está o que é
        SEU — conversas diretas, grupos, notas. Abaixo, os lugares de outras
        pessoas. Sem ele o rail é uma pilha só, e a primeira entrada parece
        mais um servidor.
      */}
      <span className={css.divisor} aria-hidden />

      {ids.length === 0 ? (
        <p className={css.vazio}>sem servidores</p>
      ) : (
        <div className={css.lista}>
          {itens.map((item) =>
            item.tipo === "pasta" ? (
              <PastaDoRail key={item.pasta.id} pasta={item.pasta} ativo={ativo} />
            ) : (
              <ItemDeServidor
                key={item.id}
                id={item.id}
                ativo={item.id === ativo}
              />
            ),
          )}
        </div>
      )}

      {/*
        O `+`, e ele é o único ponto de entrada para criar OU entrar num
        servidor. Sem ele, as duas coisas não têm por onde acontecer — foi
        assim que o mapa de superfícies classificou a ausência.
      */}
      <Tooltip texto="Adicionar servidor" lado="fim">
        <button
          type="button"
          className={css.item}
          aria-label="Adicionar servidor"
          onClick={() => abrirModal("adicionarServidor")}
        >
          <span className={`${css.marca} ${css.marcaAdicionar}`} aria-hidden>
            <Plus size={ICONE.calha} />
          </span>
          <span className={css.nome}>Adicionar</span>
        </button>
      </Tooltip>

      {/*
        O rodapé do rail: baixar o app.

        É do design — um ladrilho menor, separado por régua, no fim da coluna.
        A separação diz que ele não é um lugar para onde se vai; é uma ação
        sobre o próprio cliente.

        ⚠ **Some dentro do app desktop**: oferecer o download para quem já o
        está usando seria um alvo sem propósito.
      */}
      {naCasca ? null : (
        <>
          <span className={css.divisor} aria-hidden />

          <Tooltip texto="Baixar para desktop" lado="fim">
            <button
              type="button"
              className={css.item}
              aria-label="Baixar para desktop"
              onClick={() => {
                window.open(
                  linkDeDownload(plataformaDoNavegador()),
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
            >
              <span className={`${css.marca} ${css.marcaRodape}`} aria-hidden>
                <DownloadSimple size={ICONE.calha} />
              </span>
              <span className={css.nome}>Baixar</span>
            </button>
          </Tooltip>
        </>
      )}
    </nav>
  );
}
