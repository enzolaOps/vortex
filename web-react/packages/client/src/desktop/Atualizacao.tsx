import {
  ArrowClockwise,
  DownloadSimple,
  ICONE,
  WarningOctagon,
} from "../components/ui/icones";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { ponte, type Atualizacao as Estado } from "../sdk/desktop";
import { assinarDesktop, lerDesktop } from "../store/desktop";
import css from "./Atualizacao.module.css";

const INICIAL: Estado = { estado: "em-dia", versao: undefined, progresso: 0 };

/**
 * A atualização — faixa quando está pronta, BLOQUEIO quando é obrigatória.
 *
 * ⚠ **Seis estados e só dois desenham algo.** `em-dia`, `verificando` e
 * `baixando` são silenciosos de propósito: atualização que anuncia cada passo
 * treina a pessoa a ignorar o aviso, e aí ele não serve para o caso que
 * importa. `falhou` também cala — o app tenta de novo sozinho, e um erro que
 * a pessoa não pode resolver é ruído.
 *
 * ⚠ **A obrigatória é o ÚNICO momento em que o app impede o uso**, e é o que o
 * design escreve: ela cobre a janela inteira e não tem "depois". A razão é que
 * ela não é uma escolha — a versão parou de conversar com o servidor, então
 * não há app para usar atrás do véu.
 */
export function Atualizacao() {
  const { naCasca } = useSyncExternalStore(assinarDesktop, lerDesktop);
  const [a, setA] = useState<Estado>(INICIAL);
  const [instalando, setInstalando] = useState(false);

  useEffect(() => ponte()?.assinarAtualizacao(setA), [naCasca]);

  if (!naCasca) return null;

  if (a.estado === "obrigatoria") {
    return (
      /*
        `alertdialog` e não `dialog`: ele interrompe o leitor de tela, e aqui
        isso é o correto — ao contrário da faixa de conexão, esta é a situação
        em que a pessoa PRECISA parar. É a única do app com esse papel.
      */
      <div className={css.bloqueio} role="alertdialog" aria-modal="true">
        <div className={css.cartaoDeBloqueio}>
          <WarningOctagon
            size={ICONE.ilustracao}
            weight="fill"
            className={css.glifoDeBloqueio}
            aria-hidden
          />
          <h1 className={css.tituloDeBloqueio}>Atualização necessária</h1>
          <p className={css.textoDeBloqueio}>
            Esta versão não conversa mais com o servidor. Atualize para
            continuar — leva menos de um minuto.
          </p>
          <Botao
            variante="primario"
            tamanho="grande"
            carregando={instalando}
            rotuloCarregando="Reiniciando…"
            onClick={() => {
              setInstalando(true);
              void ponte()?.instalarEReiniciar();
            }}
          >
            Atualizar e reiniciar
          </Botao>
          {/*
            ⚠ **"Ou baixar manualmente" existe porque o auto-update FALHA** —
            atrás de proxy corporativo, com o instalador em pasta somente
            leitura, com antivírus no meio. Sem esta saída, a tela de bloqueio
            vira uma parede: o app não abre e não há o que fazer.
          */}
          <button
            type="button"
            className={css.manual}
            onClick={() => void ponte()?.abrirPastaDeLogs()}
          >
            ou baixar manualmente
          </button>
        </div>
      </div>
    );
  }

  if (a.estado !== "pronta") return null;

  return (
    /*
      ⚠ **A faixa EMPURRA o conteúdo em 34px, nunca sobrepõe** — é instrução do
      design, e o contrário da faixa de conexão, que flutua. A diferença é a
      duração: a de conexão dura segundos e sumir é o normal dela; esta fica
      até alguém reiniciar, e uma barra permanente sobre o cabeçalho do canal
      cobriria as ações dele para sempre.
    */
    <div className={css.faixa} role="status">
      <DownloadSimple size={ICONE.controle} weight="fill" aria-hidden />
      <span className={css.titulo}>Atualização pronta</span>
      {a.versao !== undefined ? (
        <span className={css.versao}>{a.versao} · baixada</span>
      ) : null}
      <span className={css.espaco} />
      <span className={css.tempo}>Instala em ~8 s</span>
      <button
        type="button"
        className={css.reiniciar}
        onClick={() => void ponte()?.instalarEReiniciar()}
      >
        <ArrowClockwise size={ICONE.metadado} aria-hidden />
        Reiniciar agora
      </button>
    </div>
  );
}
