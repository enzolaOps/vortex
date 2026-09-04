import {
  CaretDown,
  DownloadSimple,
  Envelope,
  FolderSimplePlus,
  ICONE,
  Plus,
  ShieldCheck,
} from "../components/ui/icones";
import { memo, useSyncExternalStore } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/ui/ContextMenu";
import { Tooltip } from "../components/ui/Tooltip";
import { contagem, rotuloDeNaoLidas } from "../lib/plural";
import { aindaNao } from "../pendente/pendencias";
import { corDoTextoDe, gradienteDe } from "../lib/gradiente";
import {
  useLocal,
  useServer,
  useServerIds,
  useServidorAtivo,
} from "../store/hooks";
import { administrar } from "../store/administracao";
import {
  agrupar,
  alternarColapsoDaPasta,
  assinarPastas,
  lerPastas,
  moverParaPasta,
  removerPasta,
  type Pasta,
} from "../store/pastas";
import { abrirModal } from "../store/modais";
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
  const pastas = useSyncExternalStore(assinarPastas, lerPastas);

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
    <ContextMenu>
      {/*
        ⚠ **A ponte entre os dois `asChild`, e sem ela o menu não abre.**

        `ContextMenuTrigger asChild` funde os próprios handlers no filho — e o
        filho aqui é o `Tooltip`, que é um `Root` do Radix e não renderiza DOM
        nenhum. Os handlers do menu não pousavam em elemento algum: o botão
        direito simplesmente não fazia nada, sem erro.

        É a MESMA armadilha já registrada na member list, onde o gatilho
        disputava com o cartão de perfil. `display: contents` para a ponte não
        criar caixa: o rail é um flex, e um wrapper com layout próprio mudaria
        o alinhamento dos ladrilhos.
      */}
      <ContextMenuTrigger asChild>
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
          data-estado={ativo ? "ativa" : temNaoLidas ? "atencao" : "repouso"}
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
      </ContextMenuTrigger>

      {/*
        O menu que gerencia pastas.

        ⚠ **Por menu e não por ARRASTE**, e a escolha não é preguiça: o design
        mostra pastas, não o gesto que as cria. Arrastar é o caminho de todo
        cliente da categoria e vai entrar — mas ele é exclusivo de ponteiro, e
        um recurso que só existe para quem tem mouse é o mesmo defeito que a
        auditoria apontou na paleta de comandos. Menu funciona com teclado no
        primeiro dia; o arraste soma depois, listado como pendência.
      */}
      <ContextMenuContent>
        {/*
          ⚠ **Privacidade é o PRIMEIRO item, e é do design.** Ela é a única
          coisa deste menu que muda o que os OUTROS podem fazer com você;
          pasta e ordem são arrumação. Num menu curto a posição é a hierarquia.
        */}
        <ContextMenuItem
          onSelect={() =>
            administrar({ tipo: "privacidadeDoServidor", serverId: id })
          }
        >
          <ShieldCheck size={ICONE.calha} aria-hidden />
          Privacidade neste servidor
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          onSelect={() => administrar({ tipo: "criarPasta", serverId: id })}
        >
          <FolderSimplePlus size={ICONE.calha} aria-hidden />
          Nova pasta com este
        </ContextMenuItem>

        {pastas.length > 0 ? <ContextMenuSeparator /> : null}

        {pastas.map((p) =>
          p.servidores.includes(id) ? (
            <ContextMenuItem key={p.id} onSelect={() => moverParaPasta(id, null)}>
              Tirar de {p.nome}
            </ContextMenuItem>
          ) : (
            <ContextMenuItem key={p.id} onSelect={() => moverParaPasta(id, p.id)}>
              Mover para {p.nome}
            </ContextMenuItem>
          ),
        )}

        <ItemDeId id={id} />
      </ContextMenuContent>
    </ContextMenu>
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

  return (
    <div className={css.pasta} data-colapsada={pasta.colapsada}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
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
        </ContextMenuTrigger>

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
      </ContextMenu>

      {/*
        Colapsada, os ladrilhos continuam MONTADOS e o CSS os recorta.

        Desmontá-los faria a pasta perder o realce de não-lida ao ser fechada —
        e não-lida escondida é exatamente o que faz alguém parar de usar
        pastas.
      */}
      <div className={css.conteudoDaPasta}>
        {pasta.servidores.map((id) => (
          <ItemDeServidor key={id} id={id} ativo={id === ativo} naPasta />
        ))}
      </div>

      <span className={css.nomeDaPasta} aria-hidden>
        {pasta.nome}
      </span>

      {/* A barra da pasta acende quando o servidor aberto está dentro dela e
          ela está fechada — senão a pessoa perde de vista onde está. */}
      {pasta.colapsada && temAtivo ? (
        <span className={css.barra} data-estado="ativa" aria-hidden />
      ) : null}
    </div>
  );
});

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
      <Tooltip texto="Conversas" lado="fim">
        <button
          type="button"
          className={css.item}
          aria-current={naCasa}
          aria-label="Conversas"
          onClick={irParaCasa}
        >
          <span
            className={css.barra}
            data-estado={naCasa ? "ativa" : "repouso"}
            aria-hidden
          />
          <span className={`${css.marca} ${css.marcaCasa}`} aria-hidden>
            {/* Envelope, e é o ícone do design — não uma casa. A entrada
                agrega DM, grupo e notas, e o desenho dela é correspondência.
                `fill` só no ativo: é a variação SEMÂNTICA do Phosphor. */}
            <Envelope size={ICONE.calha} weight={naCasa ? "fill" : "regular"} />
          </span>
          <span className={css.nome}>Conversas</span>
        </button>
      </Tooltip>

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

        Desenhado sem implementação, registrado em `pendente/pendencias.ts`.
      */}
      <span className={css.divisor} aria-hidden />

      <Tooltip texto="Baixar para desktop" lado="fim">
        <button
          type="button"
          className={css.item}
          aria-label="Baixar para desktop"
          onClick={aindaNao("baixarApp")}
        >
          <span className={`${css.marca} ${css.marcaRodape}`} aria-hidden>
            <DownloadSimple size={ICONE.calha} />
          </span>
          <span className={css.nome}>Baixar</span>
        </button>
      </Tooltip>
    </nav>
  );
}
