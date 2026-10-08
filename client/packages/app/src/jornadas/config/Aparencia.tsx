import { useSyncExternalStore } from "react";

import { config } from "../../textos";
import {
  assinarPersonalizacao,
  definirPersonalizacao,
  lerPersonalizacao,
  paletaAtual,
} from "../../tema/personalizado";
import { corDoDestaque, DESTAQUES } from "../../tema/personalizar";
import { Avatar, Botao } from "../../ui/ds";
import css from "./Aparencia.module.css";
import { Bloco, Deslizante, estilosDeConfig as ec, GrupoDeOpcoes, Opcao, Pagina } from "./controles";

const t = config.aparenciaTela;

/**
 * Aparência (PRD 4.6): o tema de fábrica e uma paleta personalizada.
 *
 * O matiz e a intensidade mudam o tom das superfícies; o destaque, a cor de
 * ação. A luminosidade de cada papel é do app, e toda combinação passa pelos
 * mesmos pares de contraste do tema de fábrica antes de valer (`tema/personalizar.ts`).
 * Por enquanto só existe o tema escuro: não há seletor claro/escuro.
 */
export function Aparencia() {
  const p = useSyncExternalStore(assinarPersonalizacao, lerPersonalizacao);
  const validada = p.ativo ? paletaAtual() : undefined;

  return (
    <Pagina>
      <Bloco>
        <h3 className={ec.titulo}>{t.tema}</h3>
        <GrupoDeOpcoes rotulo={t.tema}>
          <Opcao
            marcada={!p.ativo}
            descricao={!p.ativo ? t.emUso : t.escuroDica}
            aoEscolher={() => {
              definirPersonalizacao({ ativo: false });
            }}
          >
            {t.escuro}
          </Opcao>
          <Opcao
            marcada={p.ativo}
            descricao={p.ativo ? t.emUso : t.personalizadoDica}
            aoEscolher={() => {
              definirPersonalizacao({ ativo: true });
            }}
          >
            {t.personalizado}
          </Opcao>
        </GrupoDeOpcoes>
        <p className={ec.dica}>{t.soEscuro}</p>
      </Bloco>

      {p.ativo && (
        <Bloco>
          <Deslizante
            rotulo={t.matiz}
            valor={p.matiz}
            min={0}
            max={360}
            texto={t.valorGraus(p.matiz)}
            aoMudar={(v) => {
              definirPersonalizacao({ matiz: v });
            }}
          />
          <Deslizante
            rotulo={t.intensidade}
            valor={p.intensidade}
            min={0}
            max={100}
            texto={t.valorPorcento(p.intensidade)}
            aoMudar={(v) => {
              definirPersonalizacao({ intensidade: v });
            }}
          />
          <p className={ec.rotuloDaSecao}>{t.corDeDestaque}</p>
          <GrupoDeOpcoesDeAmostra />
          <p className={ec.dica} role="status">
            {t.ajusteAutomatico}
          </p>
          {validada === undefined && <p className={ec.erro}>{t.semPaleta}</p>}

          <p className={ec.rotuloDaSecao}>{t.previa}</p>
          <div className={css.previa} data-testid="previa-da-paleta">
            <div className={css.previaLinha}>
              <Avatar nome={t.previaNome} tamanho={36} status="online" />
              <div>
                <span className={css.previaNome}>{t.previaNome}</span>
                <p className={css.previaTexto}>{t.previaTexto}</p>
              </div>
            </div>
            <div className={ec.acoes}>
              <Botao tamanho="sm">{t.previaBotao}</Botao>
            </div>
          </div>
        </Bloco>
      )}
    </Pagina>
  );
}

function GrupoDeOpcoesDeAmostra() {
  const p = useSyncExternalStore(assinarPersonalizacao, lerPersonalizacao);
  return (
    <div className={css.amostras} role="radiogroup" aria-label={t.corDeDestaque}>
      {DESTAQUES.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={p.destaque === d}
          aria-label={t.destaques[d]}
          className={css.amostra}
          style={{ background: corDoDestaque(d) }}
          onClick={() => {
            definirPersonalizacao({ destaque: d });
          }}
        />
      ))}
    </div>
  );
}
