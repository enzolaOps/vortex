import { useSyncExternalStore } from "react";

import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Interruptor } from "../components/ui/Interruptor";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import {
  assinarNota,
  assinarSilencioDe,
  escreverNota,
  estaSilenciado,
  lerNota,
  alternarSilencioDe,
} from "../store/sobrePessoas";
import { CorpoDePerfil } from "./CartaoDePerfil";
import css from "./ModalDePerfil.module.css";

/**
 * O perfil de alguém, como MODAL.
 *
 * ⚠ **Uma superfície e não duas, e as duas pendências que ela fecha explicam
 * por quê.** `perfilCompleto` pedia "o perfil inteiro, com bio, cargos e
 * histórico" a partir do menu da timeline; `perfilNaChamada` pedia um perfil
 * na tela de assistir, com a razão escrita: *"hover card sobre vídeo em tela
 * cheia não tem onde ancorar"*. É o mesmo conteúdo em dois lugares — separadas,
 * viram dois perfis que divergem no primeiro campo novo.
 *
 * ⚠ **O corpo é COMPARTILHADO com o `HoverCard`, não copiado.** `CorpoDePerfil`
 * saiu de `CartaoDePerfil` para cá exatamente por isso: o cartão de hover
 * continua sendo o resumo rápido, o modal é o mesmo resumo com o que só cabe
 * numa superfície que fica aberta — a nota privada e o silêncio. Duas cópias
 * divergiriam no dia em que um campo novo entrasse em uma delas.
 *
 * ⚠ **Modal e não painel:** ele PRENDE foco de propósito. Diferente do painel
 * de edição de layout, que existe para mexer no que está atrás, aqui a pessoa
 * veio ler sobre alguém e voltar — e sobre um vídeo em tela cheia não há
 * "atrás" com que interagir.
 */
export function ModalDePerfil({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  if (alvo?.tipo !== "perfil") return null;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Perfil"
        tituloOculto
        className={css.painel}
      >
        <Conteudo serverId={alvo.serverId} userId={alvo.userId} />
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({
  serverId,
  userId,
}: {
  serverId: string;
  userId: string;
}) {
  const nota = useSyncExternalStore(
    (o) => assinarNota(userId, o),
    () => lerNota(userId),
  );
  const silenciado = useSyncExternalStore(
    (o) => assinarSilencioDe(userId, o),
    () => estaSilenciado(userId),
  );

  return (
    <div className={css.conteudo}>
      <CorpoDePerfil serverId={serverId} userId={userId} />

      <div className={css.secao}>
        <label className={css.rotulo} htmlFor={`nota-${userId}`}>
          Nota privada · só você vê
        </label>
        {/*
          ⚠ **Salva a cada tecla, sem botão — e o design escreve "Salva
          automaticamente" por extenso.** Um botão de salvar aqui produziria a
          nota perdida por fechar o modal, que é o modo de falha que faz
          alguém parar de usar a caixa. O store grava em `localStorage` a cada
          escrita; é texto curto, e o custo é irrelevante perto de perder o
          que a pessoa escreveu.

          `textarea` e não `input`: nota é frase, às vezes duas.
        */}
        <textarea
          id={`nota-${userId}`}
          className={css.nota}
          rows={3}
          value={nota}
          placeholder="Onde nos conhecemos, o que combinamos…"
          onChange={(e) => escreverNota(userId, e.target.value)}
        />
        <p className={css.dica}>Salva automaticamente</p>
      </div>

      <div className={css.secao}>
        {/*
          ⚠ **"só para mim" está no rótulo, e não é enfeite.** Silenciar aqui
          não conta ao servidor nem à outra pessoa — é filtro local. Sem essa
          metade da frase, alguém marcaria acreditando ter bloqueado, e a
          diferença entre esconder e bloquear é exatamente o que importa saber.
        */}
        <Interruptor
          rotulo="Silenciar só para mim"
          ligado={silenciado}
          aoAlternar={() => alternarSilencioDe(userId)}
        />
        {/* O detalhe como irmão e não como prop do `Interruptor`: aquele é
            primitivo compartilhado, e acrescentar campo a ele por causa de um
            consumidor é como um primitivo vira o formulário de alguém. */}
        <p className={css.dica}>
          As mensagens desta pessoa ficam ocultas para você. Ela não fica
          sabendo.
        </p>
      </div>
    </div>
  );
}
