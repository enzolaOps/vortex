import { memo, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import type { Relacao } from "../sdk/domain";
import { Segmentado } from "../components/ui/Segmentado";
import { PontoDePresenca } from "../presenca/PontoDePresenca";
import {
  aceitarAmizade,
  abrirConversaCom,
  bloquear,
  desbloquear,
  desfazerAmizade,
  pedirAmizade,
} from "../sdk/social";
import { usePessoa, useRelacao } from "../store/hooks";
import { abrirConversa } from "../store/navegacao";
import css from "./Amigos.module.css";

/**
 * A tela de pessoas: amigos, pedidos e bloqueados.
 *
 * Quatro abas sobre quatro listas separadas no store, e não uma lista filtrada
 * no render: trocar de aba não acorda as outras três, e filtrar aqui refaria a
 * varredura a cada re-render. É a lei nº 1 numa tela que hoje é curta e que em
 * conta antiga não é.
 *
 * Ocupa a coluna de CONTEÚDO — o mesmo lugar da lista de mensagens. Não é
 * painel: não tem histórico nem composer, e gastar um dos três slots do shell
 * com ela seria caro para o que ela é.
 */

/** As abas, na ordem em que se procura por elas. */
const ABAS = [
  { id: "amigo", rotulo: "Amigos" },
  { id: "recebido", rotulo: "Pedidos" },
  { id: "enviado", rotulo: "Enviados" },
  { id: "bloqueado", rotulo: "Bloqueados" },
] as const satisfies readonly { id: Relacao; rotulo: string }[];

type Aba = (typeof ABAS)[number]["id"];

const VAZIO: Record<Aba, { titulo: string; detalhe: string }> = {
  amigo: {
    titulo: "Nenhum amigo ainda",
    detalhe: "Peça amizade pelo nome de usuário no campo acima.",
  },
  recebido: {
    titulo: "Nenhum pedido esperando",
    detalhe: "Quando alguém te adicionar, o pedido aparece aqui.",
  },
  enviado: {
    titulo: "Nenhum pedido enviado",
    detalhe: "Pedidos que você mandar ficam aqui até serem aceitos.",
  },
  bloqueado: {
    titulo: "Ninguém bloqueado",
    detalhe: "Quem você bloquear some das conversas e aparece nesta lista.",
  },
};

/** Uma pessoa. Assina a si mesma — lei nº 1. */
const Pessoa = memo(function Pessoa({
  id,
  aba,
}: {
  id: string;
  aba: Aba;
}) {
  const pessoa = usePessoa(id);
  const [ocupado, setOcupado] = useState(false);

  if (!pessoa) return null;

  /*
    As ações mudam com a aba, e o RÓTULO muda mais que a chamada: recusar,
    cancelar e desfazer são o mesmo `DELETE` no protocolo. Três verbos aqui e
    uma função lá é a divisão certa — o protocolo tem uma operação, o produto
    tem três significados.
  */
  function correr(p: Promise<unknown>) {
    setOcupado(true);
    void p.finally(() => setOcupado(false));
  }

  return (
    <li className={css.pessoa}>
      <span className={css.marca} aria-hidden>
        {pessoa.sigla}
        <PontoDePresenca userId={id} className={css.ponto} />
      </span>

      <span className={css.texto}>
        <span className={css.nome}>{pessoa.displayName}</span>
        {/* O nome de usuário é o que se digita para adicionar alguém — ele é
            dado operacional aqui, não decoração. */}
        <span className={css.usuario}>@{pessoa.username}</span>
      </span>

      <span className={css.acoes}>
        {aba === "amigo" ? (
          <>
            <Botao
              variante="neutro"
              disabled={ocupado}
              onClick={() =>
                correr(
                  abrirConversaCom(id).then((canal) => {
                    if (canal) abrirConversa(canal);
                  }),
                )
              }
            >
              Mensagem
            </Botao>
            <Botao
              variante="sutil"
              disabled={ocupado}
              onClick={() => correr(desfazerAmizade(id))}
            >
              Remover
            </Botao>
          </>
        ) : null}

        {aba === "recebido" ? (
          <>
            <Botao
              variante="primario"
              disabled={ocupado}
              onClick={() => correr(aceitarAmizade(id))}
            >
              Aceitar
            </Botao>
            <Botao
              variante="sutil"
              disabled={ocupado}
              onClick={() => correr(desfazerAmizade(id))}
            >
              Recusar
            </Botao>
          </>
        ) : null}

        {aba === "enviado" ? (
          <Botao
            variante="sutil"
            disabled={ocupado}
            onClick={() => correr(desfazerAmizade(id))}
          >
            Cancelar
          </Botao>
        ) : null}

        {aba === "bloqueado" ? (
          <Botao
            variante="neutro"
            disabled={ocupado}
            onClick={() => correr(desbloquear(id))}
          >
            Desbloquear
          </Botao>
        ) : null}

        {/*
          Bloquear existe nas três primeiras abas, e não na de bloqueados —
          onde a ação já aconteceu.

          ⚠ `sutil` e NÃO `perigo`, e isso foi corrigido olhando a tela: com a
          variante de perigo, sete botões vermelhos empilhados faziam a ação
          destrutiva ser a coisa mais chamativa de uma lista cuja função é
          conversar. Peso de destruição pertence à CONFIRMAÇÃO, não à linha —
          e aqui nem confirmação cabe, porque bloquear é reversível e o
          desfazer está na aba ao lado.
        */}
        {aba !== "bloqueado" ? (
          <Botao
            variante="sutil"
            disabled={ocupado}
            onClick={() => correr(bloquear(id))}
          >
            Bloquear
          </Botao>
        ) : null}
      </span>
    </li>
  );
});

export function Amigos() {
  const [aba, setAba] = useState<Aba>("amigo");
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  /*
    `Aba` é subconjunto de `Relacao` de propósito: `bloqueadoPor` e `nenhuma`
    existem no domínio e NÃO têm aba — quem bloqueou você não vira uma lista, e
    "nenhuma relação" é todo mundo. O tipo garante que uma aba nova precise ser
    uma relação de verdade.
  */
  const ids = useRelacao(aba);

  const limpo = nome.trim();
  const podeEnviar = limpo.length > 0 && !enviando;

  return (
    <div className={css.tela}>
      <header className={css.cabecalho}>
        <h1 className={css.titulo}>Pessoas</h1>

        <form
          className={css.adicionar}
          onSubmit={(e) => {
            e.preventDefault();
            if (!podeEnviar) return;
            setEnviando(true);
            void pedirAmizade(limpo)
              .then((ok) => {
                // Limpa só quando deu certo: apagar o que a pessoa digitou
                // depois de um erro a obriga a redigitar para tentar de novo.
                if (ok) setNome("");
              })
              .finally(() => setEnviando(false));
          }}
        >
          <Campo
            rotulo="Adicionar por nome de usuário"
            placeholder="fulano"
            autoComplete="off"
            disabled={enviando}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Botao variante="primario" type="submit" disabled={!podeEnviar}>
            {enviando ? "Enviando…" : "Pedir amizade"}
          </Botao>
        </form>

        <Segmentado
          rotulo="Filtrar pessoas"
          valor={aba}
          opcoes={ABAS.map((a) => ({ id: a.id, rotulo: a.rotulo }))}
          aoEscolher={(id) => setAba(id)}
        />
      </header>

      {/* Ver `MessageList`: rolável sem foco é inoperável por teclado. */}
      <div className={css.rolagem} tabIndex={0}>
        {ids.length === 0 ? (
          <EstadoVazio titulo={VAZIO[aba].titulo} detalhe={VAZIO[aba].detalhe} />
        ) : (
          <ul className={css.lista}>
            {ids.map((id) => (
              <Pessoa key={id} id={id} aba={aba} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
