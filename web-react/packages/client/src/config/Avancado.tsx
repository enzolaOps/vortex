import { useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Interruptor } from "../components/ui/Interruptor";
import { Selo } from "../components/ui/Selo";
import { toast } from "../components/ui/toastStore";
import { aindaNao } from "../pendente/pendencias";
import { assinarDev, definirDev, lerDev } from "../store/dev";
import {
  CabecalhoDeSecao,
  classes as pg,
  GrupoDeAjustes,
  LinhaDeAjuste,
  PaginaDeAjustes,
} from "./Pagina";
import css from "./Avancado.module.css";

/** Onde o "Copiar ID" passa a aparecer. Espelha os consumidores reais. */
const MENUS = [
  "servidor",
  "categoria",
  "canal",
  "cargo",
  "membro",
  "mensagem",
] as const;

/**
 * As informações que um relato de problema precisa carregar.
 *
 * ⚠ **Nenhuma delas é inventada, e é por isso que a lista é curta.** O design
 * mostra "4.2.0 · macOS 15.4 · Electron 32 · arm64"; aqui não há casca
 * Electron nem versão de sistema legível pelo navegador — `userAgent` é o que
 * existe, e é o que vai. Escrever "Electron 32" numa build web seria dado
 * falso exatamente na superfície que existe para diagnosticar.
 */
function informacoesDoSistema(): string {
  return [
    `Vortex ${__VERSAO__}`,
    navigator.userAgent,
    `${String(screen.width)}×${String(screen.height)} @${String(devicePixelRatio)}x`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("\n");
}

/**
 * Avançado.
 *
 * ⚠ **O modo desenvolvedor funciona de verdade**, e é a exceção nesta tela:
 * ele não depende de protocolo nem de Electron — acrescenta "Copiar ID" aos
 * menus de contexto, e o ID é dado que o app já tem. O overlay de depuração
 * depende do instrumento que hoje só existe no arnês de medição.
 */
export function Avancado() {
  const d = useSyncExternalStore(assinarDev, lerDev);

  return (
    <PaginaDeAjustes>
      {/*
        ⚠ O cartão ganha borda de ACENTO quando o modo está ligado, e isso é do
        design. A razão é boa: é um modo que muda os menus do app inteiro, e
        quem o esquece ligado precisa achá-lo de relance ao voltar aqui.
      */}
      <div className={css.cartao} data-ativo={d.modoDesenvolvedor || undefined}>
        <div className={css.topo}>
          <div className={pg.texto}>
            <span className={css.tituloComSelo}>
              <span className={pg.titulo}>Modo desenvolvedor</span>
              {d.modoDesenvolvedor ? (
                <Selo forma="etiqueta" tom="acento">
                  Ativo
                </Selo>
              ) : null}
            </span>
            <p className={pg.detalhe}>
              Adiciona “Copiar ID” aos menus de contexto de servidor, canal,
              cargo, membro e mensagem.
            </p>
          </div>
          <Interruptor
            ligado={d.modoDesenvolvedor}
            rotulo="Modo desenvolvedor"
            aoAlternar={(modoDesenvolvedor) => definirDev({ modoDesenvolvedor })}
          />
        </div>

        <span className={css.sobrancelha}>Aparece nestes menus</span>
        <div className={css.chips}>
          {MENUS.map((m) => (
            <span key={m} className={css.chip}>
              {m}
            </span>
          ))}
        </div>

        {/*
          A ilustração do menu.

          ⚠ `aria-hidden` e sem um único `button`: ela é um DIAGRAMA do que o
          modo faz, não um menu. Alvos de verdade aqui receberiam foco e não
          fariam nada — o defeito que o lint de `onSelect` existe para matar.
        */}
        <div className={css.exemplo} aria-hidden>
          <span className={css.itemDeExemplo}>Marcar como lido</span>
          <span className={css.itemDeExemplo}>Editar canal</span>
          <span className={css.itemDestrutivo}>Excluir canal</span>
          <span className={css.itemDeId} data-ativo={d.modoDesenvolvedor || undefined}>
            Copiar ID
          </span>
        </div>

        <p className={pg.detalhe}>
          Sempre o último item, em mono e terciário — nunca compete com as ações
          reais do menu. Com o modo desligado, o item não existe: ele não fica
          desabilitado.
        </p>
      </div>

      <CabecalhoDeSecao titulo="Diagnóstico" />

      <GrupoDeAjustes>
        <LinhaDeAjuste
          titulo="Overlay de depuração"
          detalhe="FPS, latência e re-renders no canto da janela"
        >
          <Interruptor
            ligado={d.overlay}
            rotulo="Overlay de depuração"
            aoAlternar={(overlay) => {
              definirDev({ overlay });
              if (overlay) aindaNao("overlayDeDebug")();
            }}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Copiar informações do sistema"
          detalhe={`Vortex ${__VERSAO__} · ${navigator.userAgent.slice(0, 60)}…`}
        >
          <Botao
            tamanho="pequeno"
            onClick={() => {
              const texto = informacoesDoSistema();
              void navigator.clipboard
                .writeText(texto)
                .then(() => {
                  toast({ tipo: "info", titulo: "Informações copiadas." });
                })
                .catch(() => {
                  /* Erro NÃO expira, e aqui o motivo é literal: o toast carrega
                     o texto que a pessoa vai ter de selecionar à mão. */
                  toast({
                    tipo: "erro",
                    titulo: "Não deu para copiar.",
                    descricao: texto,
                  });
                });
            }}
          >
            Copiar
          </Botao>
        </LinhaDeAjuste>
      </GrupoDeAjustes>

      <p className={pg.recado}>
        O design lista versão do sistema, do Electron e arquitetura. Nada disso
        é legível de dentro do navegador — o que vai no texto copiado é o que
        existe de verdade, porque esta é justamente a superfície em que dado
        inventado atrapalha o diagnóstico.
      </p>
    </PaginaDeAjustes>
  );
}
