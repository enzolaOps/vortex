import { useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Segmentado } from "../components/ui/Segmentado";
import {
  assinarDensidade,
  definirDensidade,
  lerDensidade,
} from "../store/densidade";
import { PickerDePaleta } from "../layout/PickerDePaleta";
import { fecharConfig } from "../store/config";
import { entrar } from "../store/edicao";
import css from "./Secao.module.css";

/**
 * Paleta e layout.
 *
 * ⚠ **Esta seção quase não é trabalho novo, e isso era previsível.** O
 * `PickerDePaleta` e o modo de edição de layout foram construídos na fase 4 e
 * até agora só tinham entrada pelo cabeçalho do ARNÊS — o comentário lá dizia
 * "no cliente de verdade é de lá que ela sai", e este é o "lá".
 *
 * É o que o plano de paridade antecipou: a contagem de 42 páginas do upstream é
 * maior que o trabalho real, porque parte delas já existe sem casa.
 */
/** Fora do componente: constante, não estado. */
const OPCOES_DE_DENSIDADE = [
  { id: "confortavel", rotulo: "Confortável" },
  { id: "compacto", rotulo: "Compacto" },
] as const;

export function Aparencia() {
  const densidade = useSyncExternalStore(assinarDensidade, lerDensidade);

  return (
    <div className={css.forma}>
      {/*
        Densidade PRIMEIRO, e a ordem não é arbitrária.

        Ela muda a forma de toda linha da timeline — é o ajuste com o maior
        efeito visível desta tela, e o que alguém vem procurar aqui na primeira
        semana de uso. Paleta e layout são refinamento; densidade é conforto de
        leitura numa jornada de oito horas.
      */}
      <section className={css.bloco}>
        <h2 className={css.subtitulo}>Densidade</h2>
        <p className={css.recado}>
          Compacto não é o confortável apertado: ele troca o avatar por uma
          coluna de hora e deixa de agrupar mensagens do mesmo autor, então
          cada linha vira um endereço. Cabe mais conversa na tela; identifica-se
          quem falou com menos relance.
        </p>
        <Segmentado
          rotulo="Densidade da timeline"
          valor={densidade}
          opcoes={OPCOES_DE_DENSIDADE}
          aoEscolher={definirDensidade}
        />
      </section>

      <hr className={css.divisor} />

      <section className={css.bloco}>
        <h2 className={css.subtitulo}>Paleta</h2>
        <p className={css.recado}>
          Você escolhe matiz, saturação e a cor de ação; o app decide toda a
          luminosidade. É o que garante contraste em qualquer combinação — não
          há como escolher uma paleta ilegível aqui.
        </p>
        <PickerDePaleta />
      </section>

      <hr className={css.divisor} />

      <section className={css.bloco}>
        <h2 className={css.subtitulo}>Layout</h2>
        <p className={css.recado}>
          Reordene as colunas, esconda as que não usa e ajuste a largura de
          cada uma. Tudo vale enquanto você mexe; sair sem salvar desfaz.
        </p>
        <div className={css.acoes}>
          <Botao
            variante="neutro"
            onClick={() => {
              /*
                Fecha as configurações ANTES de entrar no modo edição.

                O modo edição mexe nas colunas do shell, e o shell está atrás
                desta tela — editar com ela aberta seria arrastar bordas que
                ninguém consegue ver.
              */
              fecharConfig();
              entrar();
            }}
          >
            Editar layout
          </Botao>
        </div>
      </section>
    </div>
  );
}
