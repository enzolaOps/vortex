import {
  GearSix,
  Headphones,
  Microphone,
  MicrophoneSlash,
  SpeakerSlash,
} from "../components/ui/icones";
import { useState, useSyncExternalStore } from "react";

import { Campo } from "../components/ui/Campo";
import { cn } from "../lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenu";
import { Tooltip } from "../components/ui/Tooltip";
import { abrirConfig } from "../store/config";
import { alternarMudo, alternarSurdo } from "../sdk/chamada";
import { assinarChamada, lerChamada } from "../store/chamada";
import { assinarMeuStatus, lerMeuStatus } from "../store/meuStatus";
import { assinarSessao, lerSessao } from "../store/sessao";
import { Avatar } from "../components/ui/Avatar";
import { definirPresenca, definirStatusTexto, lerMeuPerfil } from "../sdk/perfil";
import type { PresencaEscolhida } from "../sdk/domain";
import css from "./PainelDeUsuario.module.css";
import { sigla } from "../lib/sigla";

/**
 * As quatro escolhas, na ordem em que se procura por elas.
 *
 * `Record`-como-lista para que uma variante nova de `PresencaEscolhida` não
 * compile até ganhar rótulo e explicação — a mesma mecânica de
 * `NOME_DO_PAINEL` e do registro de modais.
 *
 * O `detalhe` só existe onde a escolha tem CONSEQUÊNCIA que o nome não conta.
 * "Online" não precisa de explicação; "invisível" precisa, porque a diferença
 * entre ele e fechar o app é exatamente o que a pessoa está tentando decidir.
 */
const ESCOLHAS: readonly {
  id: PresencaEscolhida;
  rotulo: string;
  detalhe?: string;
}[] = [
  { id: "online", rotulo: "Online" },
  { id: "idle", rotulo: "Ausente" },
  {
    id: "dnd",
    rotulo: "Não perturbe",
    detalhe: "Some das notificações, continua recebendo.",
  },
  {
    id: "invisivel",
    rotulo: "Invisível",
    detalhe: "Todo mundo te vê offline. Você continua lendo e respondendo.",
  },
];

const CLASSE_DO_PONTO: Record<PresencaEscolhida, string> = {
  online: css.pontoOnline!,
  idle: css.pontoIdle!,
  dnd: css.pontoDnd!,
  invisivel: css.pontoOffline!,
};

/**
 * O recado personalizado, editado no próprio menu.
 *
 * Sem modal, e é decisão: o texto é curto, o alvo é único e a pessoa já está
 * com o menu aberto. Abrir um diálogo por cima de um menu para um campo de uma
 * linha é a pilha de véus que o registro de modais existe para evitar.
 */
function Recado({ aoFechar }: { aoFechar: () => void }) {
  const status = useSyncExternalStore(assinarMeuStatus, lerMeuStatus);
  const [texto, setTexto] = useState(status.texto ?? "");

  return (
    <form
      className={css.recado}
      onSubmit={(e) => {
        e.preventDefault();
        void definirStatusTexto(texto);
        aoFechar();
      }}
    >
      <Campo
        rotulo="Recado"
        dica="Aparece embaixo do seu nome. Vazio remove."
        autoComplete="off"
        maxLength={128}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        /* `e.stopPropagation` nas setas: o menu do Radix move o foco com
           ArrowUp/ArrowDown, e sem isto digitar dentro do campo saltaria para
           o item de menu vizinho no meio da frase. */
        onKeyDown={(e) => {
          if (e.key.startsWith("Arrow")) e.stopPropagation();
        }}
      />
    </form>
  );
}

/**
 * O painel de usuário — o rodapé da coluna de canais.
 *
 * ⚠ **Não existia, e a ausência aparecia em toda tela do design.** Sem ele não
 * havia onde ver quem você é, nem como mudar o próprio status, nem como
 * silenciar o microfone fora de uma chamada. O status era uma coisa que o app
 * observava nas OUTRAS pessoas: `PresenceStatus` era lido, mapeado e pintado
 * no pontinho de todo mundo, e a pessoa dona da sessão não tinha controle
 * nenhum sobre o próprio.
 *
 * Fica no rodapé da coluna de canais e não no rail porque é o que o design
 * pede — e a razão dele é boa: o rail é uma tira de 72px onde só cabe ícone, e
 * este painel precisa mostrar NOME e RECADO, que são texto.
 *
 * Assina dois stores e nada mais: o meu status e a chamada. Nenhum dos dois é
 * de alta frequência — status muda por clique humano, e o de chamada já compara
 * campo a campo antes de publicar.
 */
export function PainelDeUsuario() {
  const status = useSyncExternalStore(assinarMeuStatus, lerMeuStatus);
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const [aberto, setAberto] = useState(false);

  /*
    O perfil é lido do cache do SDK a cada render, e não assinado.

    Não há store de "eu" — `lerMeuPerfil` é uma leitura direta, e o nome de
    exibição muda uma vez a cada nunca. Assinar exigiria um store novo para um
    valor que a tela de perfil já reescreve com um `submit`.
  */
  const perfil = lerMeuPerfil();
  const nome = perfil?.displayName ?? "você";
  /*
    O ID da sessão é o que dá cor ao avatar.

    Vem do store de sessão e não do cache do SDK: `lerMeuPerfil` lê
    `client.user`, que é `undefined` antes do `Ready` — e o painel desenha
    desde a abertura. Sem sessão o ID é vazio, que o gradiente aceita e resolve
    para uma cor estável e discreta.
  */
  const meuId = useSyncExternalStore(assinarSessao, lerSessao).userId ?? "";
  const usuario = perfil?.username;

  return (
    <div className={css.painel}>
      <DropdownMenu open={aberto} onOpenChange={setAberto}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={css.identidade}
            aria-label={`Você: ${nome}. Status: ${
              ESCOLHAS.find((e) => e.id === status.presenca)?.rotulo ?? ""
            }. Abrir menu de status.`}
          >
            <Avatar
              id={meuId}
              sigla={perfil ? sigla(nome) : undefined}
              url={perfil?.avatarUrl}
            >
              {/*
                O ponto NÃO é o `PontoDePresenca`, e a diferença é o ponto.

                Aquele assina o store efêmero por ID de usuário — o estado das
                MILHARES de pessoas que o firehose atualiza. O meu status vive
                num store próprio porque carrega `invisivel`, que a
                `PresenceStatus` não sabe representar, e porque ele muda por
                clique humano em vez de por rajada.

                A silhueta é a mesma: cor + forma, nunca só cor.
              */}
              <span
                className={cn(css.ponto, CLASSE_DO_PONTO[status.presenca])}
              />
            </Avatar>

            <span className={css.textos}>
              <span className={css.nome}>{nome}</span>
              {/* Recado quando há; nome de usuário quando não. A linha nunca
                  fica vazia — altura constante é o que impede o painel de
                  pular ao trocar o recado. */}
              <span className={css.segunda}>
                {status.texto ?? (usuario ? `@${usuario}` : "sem servidor")}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          {ESCOLHAS.map((escolha) => (
            <DropdownMenuItem
              key={escolha.id}
              onSelect={() => void definirPresenca(escolha.id)}
            >
              <span className={css.itemDeStatus}>
                <span
                  className={cn(css.pontoDoMenu, CLASSE_DO_PONTO[escolha.id])}
                  aria-hidden
                />
                <span className={css.itemTextos}>
                  <span className={css.itemRotulo}>
                    {escolha.rotulo}
                    {escolha.id === status.presenca ? (
                      /* Marcação por TEXTO e não só por realce: um check
                         desenhado só com cor não diz nada a quem usa leitor de
                         tela nem a quem não distingue o realce do hover. */
                      <span className="sr-only"> — escolhido agora</span>
                    ) : null}
                  </span>
                  {escolha.detalhe ? (
                    <span className={css.itemDetalhe}>{escolha.detalhe}</span>
                  ) : null}
                </span>
                {escolha.id === status.presenca ? (
                  <span className={css.marca} aria-hidden>
                    ✓
                  </span>
                ) : null}
              </span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <Recado aoFechar={() => setAberto(false)} />
        </DropdownMenuContent>
      </DropdownMenu>

      <div className={css.controles}>
        {/*
          Microfone e fone funcionam FORA da chamada — eles são PREFERÊNCIA, e
          `entrarNaChamada` os lê para decidir se abre o microfone. Ver o
          comentário em `sdk/chamada.ts`: o motor de voz não é carregado para
          virar um booleano.
        */}
        <Tooltip texto={chamada.mudo ? "Ativar microfone" : "Silenciar microfone"}>
          <button
            type="button"
            className={cn(css.controle, chamada.mudo && css.controleAtivo)}
            aria-pressed={chamada.mudo}
            /* Nome ESTÁVEL, estado no `aria-pressed`. Um rótulo que alterna
               junto do estado faz o leitor anunciar o inverso — "Silenciar
               microfone, pressionado" com o microfone aberto. A AÇÃO vai no
               tooltip, que é onde o ponteiro a procura. */
            aria-label="Microfone"
            onClick={() => void alternarMudo()}
          >
            {chamada.mudo ? (
              <MicrophoneSlash size={20} weight="fill" />
            ) : (
              <Microphone size={20} />
            )}
          </button>
        </Tooltip>

        <Tooltip texto={chamada.surdo ? "Voltar a ouvir" : "Ensurdecer"}>
          <button
            type="button"
            className={cn(css.controle, chamada.surdo && css.controleAtivo)}
            aria-pressed={chamada.surdo}
            aria-label="Áudio recebido"
            onClick={() => void alternarSurdo()}
          >
            {chamada.surdo ? (
              <SpeakerSlash size={20} weight="fill" />
            ) : (
              <Headphones size={20} />
            )}
          </button>
        </Tooltip>

        <Tooltip texto="Configurações">
          <button
            type="button"
            className={css.controle}
            aria-label="Configurações"
            onClick={() => abrirConfig("perfil")}
          >
            <GearSix size={20} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

