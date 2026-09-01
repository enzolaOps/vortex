import { MagnifyingGlass, X } from "../components/ui/icones";
import { useEffect, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { MarcaDeCaixa } from "../components/ui/Marcador";
import { publicarRelacoes } from "../sdk/adapter";
import { criarGrupo } from "../sdk/social";
import { abrirConversa } from "../store/navegacao";
import { usePessoa, useRelacao } from "../store/hooks";
import css from "./NovoGrupo.module.css";

/**
 * O teto do protocolo.
 *
 * ⚠ **Dez INCLUINDO você**, e é por isso que a conta na tela soma um. O Revolt
 * recusa o 11º recipiente com 400, e descobrir isso depois de escolher dez
 * pessoas é o pior momento — a tela conta para frente e trava antes.
 */
const TETO = 10;

/** Uma pessoa escolhível. Assina a si mesma, como toda linha deste app. */
function Candidata({
  id,
  marcada,
  bloqueada,
  aoAlternar,
}: {
  id: string;
  marcada: boolean;
  bloqueada: boolean;
  aoAlternar: () => void;
}) {
  const pessoa = usePessoa(id);
  if (!pessoa) return null;

  return (
    <button
      type="button"
      /*
        `checkbox` e não `option`: escolher várias é o ponto, e `option` num
        `listbox` faria o leitor de tela anunciar "selecionado 1 de 6" a cada
        clique — uma lista onde a seleção é exclusiva.
      */
      role="checkbox"
      aria-checked={marcada}
      /* ⚠ Bloqueada e não escondida: sumir com as pessoas ao atingir o teto
         faria a lista encolher debaixo do ponteiro, e quem procura alguém que
         desapareceu conclui que a busca quebrou. */
      disabled={bloqueada && !marcada}
      className={css.candidata}
      onClick={aoAlternar}
    >
      <Avatar id={id} sigla={pessoa.sigla} url={pessoa.avatarUrl} tamanho="sm" />
      <span className={css.textos}>
        <span className={css.nome}>{pessoa.displayName}</span>
        <span className={css.usuario}>{pessoa.username}</span>
      </span>
      <MarcaDeCaixa />
    </button>
  );
}

/**
 * Novo grupo.
 *
 * ⚠ **`createGroup` existia no adapter desde a etapa 3 e NUNCA tinha sido
 * chamado** — a família "construído e inalcançável" que esta tabela já
 * registrou no painel de fixadas. Este modal é o consumidor.
 *
 * A lista sai dos AMIGOS e não de todo mundo que o cliente conhece: o
 * protocolo aceita qualquer ID, mas montar um grupo com alguém que você viu
 * passar num servidor é o caminho que produz grupo indesejado. O upstream faz
 * o mesmo.
 */
export function NovoGrupo({ aoFechar }: { aoFechar: () => void }) {
  const amigos = useRelacao("amigo");
  const [escolhidos, setEscolhidos] = useState<readonly string[]>([]);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);

  /*
    ⚠ **Publica ao abrir, e sem isto o modal nasce VAZIO.**

    Agrupar as quatro relações é uma varredura sobre todo mundo que o cliente
    conhece, então ela roda quando alguém OLHA — a mesma regra que a tela de
    pessoas segue. Só que quem olha agora também é este modal, e ele não passa
    por lá: `useRelacao("amigo")` devolveria a lista vazia até a pessoa ter
    visitado Amigos alguma vez na sessão.
    
    É a mesma falha que a tela de amigos já teve uma vez — invisível lendo o
    código, porque a publicação EXISTE, só que noutro caminho.
  */
  useEffect(() => {
    publicarRelacoes();
  }, []);

  const cheio = escolhidos.length + 1 >= TETO;
  const restantes = TETO - escolhidos.length - 1;

  function alternar(id: string) {
    setEscolhidos((atual) =>
      atual.includes(id)
        ? atual.filter((x) => x !== id)
        : atual.length + 1 < TETO
          ? [...atual, id]
          : atual,
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Novo grupo"
        descricao={`${String(escolhidos.length + 1)} de ${String(TETO)} pessoas · você inclusa`}
        className={css.painel}
        rodape={
          <>
            {/*
              A contagem fica no RODAPÉ e à esquerda, como o design: ela é a
              restrição que decide se o botão vai funcionar, e lê-la só depois
              de o botão recusar é tarde.
            */}
            <span className={css.restantes}>
              {restantes === 1 ? "1 vaga restante" : `${String(restantes)} vagas restantes`}
            </span>
            <Botao
              variante="primario"
              disabled={escolhidos.length === 0}
              carregando={criando}
              rotuloCarregando="Criando…"
              onClick={() => {
                setCriando(true);
                /*
                  Sem nome no formulário: o protocolo exige um, e o design não
                  pede. O nome padrão sai dos participantes e é editável no
                  painel de gerenciar — que é onde alguém pensa nisso.
                */
                void criarGrupo("Novo grupo", escolhidos)
                  .then((id) => {
                    if (id === undefined) return;
                    /* Abrir a conversa recém-criada: criar um grupo e
                       continuar olhando a lista é o fluxo interrompido no
                       último passo. */
                    abrirConversa(id);
                    aoFechar();
                  })
                  .finally(() => setCriando(false));
              }}
            >
              Criar grupo
            </Botao>
          </>
        }
      >
        {escolhidos.length > 0 ? (
          <div className={css.fichas}>
            {escolhidos.map((id) => (
              <Ficha key={id} id={id} aoTirar={() => alternar(id)} />
            ))}
          </div>
        ) : null}

        <div className={css.campo}>
          <MagnifyingGlass size={16} aria-hidden />
          <input
            type="search"
            className={css.entrada}
            placeholder="Buscar amigos"
            aria-label="Buscar amigos"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {amigos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum amigo ainda"
            detalhe="Grupo se monta com quem já é amigo. Peça amizade primeiro."
          />
        ) : (
          <div className={css.lista} role="group" aria-label="Amigos">
            {amigos.map((id) => (
              <Filtrada key={id} id={id} busca={busca}>
                <Candidata
                  id={id}
                  marcada={escolhidos.includes(id)}
                  bloqueada={cheio}
                  aoAlternar={() => alternar(id)}
                />
              </Filtrada>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Esconde a linha que não casa com a busca.
 *
 * ⚠ Componente e não `filter` na lista de cima, e a razão é a lei nº 1: o nome
 * mora no snapshot da PESSOA, e filtrar no pai exigiria o pai assinar as
 * dezenas de amigos para ler os nomes — trocando uma subscrição por linha por
 * uma que acorda a lista inteira quando qualquer um deles muda de apelido.
 */
function Filtrada({
  id,
  busca,
  children,
}: {
  id: string;
  busca: string;
  children: React.ReactNode;
}) {
  const pessoa = usePessoa(id);
  const q = busca.trim().toLowerCase();
  if (q.length > 0 && pessoa) {
    const casa =
      pessoa.displayName.toLowerCase().includes(q) ||
      pessoa.username.toLowerCase().includes(q);
    if (!casa) return null;
  }
  return <>{children}</>;
}

/** A ficha de quem já foi escolhido. */
function Ficha({ id, aoTirar }: { id: string; aoTirar: () => void }) {
  const pessoa = usePessoa(id);
  if (!pessoa) return null;

  return (
    <span className={css.ficha}>
      <Avatar id={id} sigla={pessoa.sigla} url={pessoa.avatarUrl} tamanho="xxs" />
      {pessoa.displayName}
      <button
        type="button"
        className={css.tirar}
        aria-label={`Tirar ${pessoa.displayName} do grupo`}
        onClick={aoTirar}
      >
        <X size={11} aria-hidden />
      </button>
    </span>
  );
}
