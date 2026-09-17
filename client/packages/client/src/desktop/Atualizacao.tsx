import {
  ArrowClockwise,
  DownloadSimple,
  ICONE,
  WarningOctagon,
} from "../components/ui/icones";
import { useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import {
  assinarAtualizacao,
  baixarManualmente,
  instalarAtualizacao,
  lerAtualizacao,
  verificarAtualizacao,
} from "../store/atualizacao";
import { assinarDesktop, lerDesktop } from "../store/desktop";
import css from "./Atualizacao.module.css";

/**
 * A atualização — faixa quando está pronta ou falhou, BLOQUEIO quando é
 * obrigatória.
 *
 * ⚠ **`em-dia`, `verificando` e `baixando` não desenham faixa.** Atualização
 * que anuncia cada passo treina a pessoa a ignorar o aviso. Esses três estados
 * aparecem onde alguém foi PERGUNTAR: a linha "Versão instalada" em
 * Configurações > Desktop, e dentro do bloqueio.
 *
 * ⚠ **`falhou` vira faixa, nunca modal** — é a regra do design. Antes ele
 * calava com o argumento de que o app tenta de novo sozinho; mas a tentativa
 * seguinte é uma hora depois, e quem está numa versão com correção de
 * segurança pendente precisa saber que ela não chegou.
 *
 * ⚠ **A obrigatória é o ÚNICO momento em que o app impede o uso**: o servidor
 * exige uma versão maior que a instalada (`features.desktop_min_version`),
 * então não há app para usar atrás do véu.
 */
export function Atualizacao() {
  const { naCasca } = useSyncExternalStore(assinarDesktop, lerDesktop);
  const tela = useSyncExternalStore(assinarAtualizacao, lerAtualizacao);

  if (!naCasca) return null;

  if (tela.bloqueada) {
    const ocupada =
      tela.instalando ||
      (!tela.falhou &&
        (tela.casca.estado === "verificando" || tela.casca.estado === "baixando"));
    return (
      /*
        `alertdialog` e não `dialog`: ele interrompe o leitor de tela, e aqui
        isso é o correto — esta é a situação em que a pessoa PRECISA parar.
      */
      <div
        className={css.bloqueio}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="vx-atualizacao-titulo"
        aria-describedby="vx-atualizacao-texto"
      >
        <div className={css.cartaoDeBloqueio}>
          <WarningOctagon
            size={ICONE.ilustracao}
            className={css.glifoDeBloqueio}
            aria-hidden
          />
          <h1 id="vx-atualizacao-titulo" className={css.tituloDeBloqueio}>
            Atualização obrigatória
          </h1>
          {tela.exigida !== undefined ? (
            <p className={css.exigida}>{tela.exigida} · exigida pelo servidor</p>
          ) : null}
          <p id="vx-atualizacao-texto" className={css.textoDeBloqueio}>
            Esta versão perdeu compatibilidade com o servidor. O app fica
            bloqueado até atualizar.
          </p>
          {tela.falhou ? (
            <p className={css.erroDeBloqueio} role="alert">
              Não foi possível atualizar automaticamente. Tente de novo ou
              baixe o instalador.
            </p>
          ) : null}
          <Botao
            variante="primario"
            tamanho="grande"
            carregando={ocupada}
            rotuloCarregando={
              tela.casca.estado === "baixando" ? "Baixando…" : "Atualizando…"
            }
            onClick={instalarAtualizacao}
          >
            {tela.falhou ? "Tentar de novo" : "Atualizar e reiniciar"}
          </Botao>
          {/*
            ⚠ **"Ou baixar manualmente" existe porque o auto-update FALHA** —
            atrás de proxy corporativo, com o instalador em pasta somente
            leitura, com antivírus no meio, ou numa casca antiga que não sabe
            instalar sem ter baixado antes. Sem esta saída, a tela de bloqueio
            vira uma parede. Ela abre o INSTALADOR da plataforma; antes abria a
            pasta de logs, que não ajuda ninguém a sair dali.
          */}
          <button type="button" className={css.manual} onClick={baixarManualmente}>
            ou baixar manualmente
          </button>
        </div>
      </div>
    );
  }

  if (tela.falhou) {
    return (
      <div className={css.faixaDeFalha} role="status">
        <WarningOctagon size={ICONE.controle} aria-hidden />
        <span className={css.titulo}>Falha ao atualizar</span>
        {tela.casca.versao !== undefined ? (
          <span className={css.versao}>{tela.casca.versao}</span>
        ) : null}
        <span className={css.espaco} />
        <span className={css.tempo}>Você continua na versão atual</span>
        <button
          type="button"
          className={css.secundario}
          onClick={baixarManualmente}
        >
          Baixar manualmente
        </button>
        <button
          type="button"
          className={css.tentarDeNovo}
          onClick={verificarAtualizacao}
        >
          <ArrowClockwise size={ICONE.metadado} aria-hidden />
          Tentar de novo
        </button>
      </div>
    );
  }

  if (tela.casca.estado !== "pronta") return null;

  return (
    /*
      ⚠ **A faixa EMPURRA o conteúdo em 34px, nunca sobrepõe** — é instrução do
      design, e o contrário da faixa de conexão, que flutua. A diferença é a
      duração: a de conexão dura segundos e sumir é o normal dela; esta fica
      até alguém reiniciar, e uma barra permanente sobre o cabeçalho do canal
      cobriria as ações dele para sempre.
    */
    <div className={css.faixa} role="status">
      <DownloadSimple size={ICONE.controle} aria-hidden />
      <span className={css.titulo}>Atualização pronta</span>
      {tela.casca.versao !== undefined ? (
        <span className={css.versao}>{tela.casca.versao} · baixada</span>
      ) : null}
      <span className={css.espaco} />
      <span className={css.tempo}>Instala em ~8 s</span>
      <button type="button" className={css.reiniciar} onClick={instalarAtualizacao}>
        <ArrowClockwise size={ICONE.metadado} aria-hidden />
        Reiniciar agora
      </button>
    </div>
  );
}
