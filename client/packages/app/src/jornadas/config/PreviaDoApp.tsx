import type { CSSProperties } from "react";

import { config } from "../../textos";
import { Avatar, Botao, FundoVidro, PainelVidro, Pilula } from "../../ui/ds";
import { Canal } from "../../ui/icones";
import css from "./PreviaDoApp.module.css";

const t = config.aparenciaTela;

/** Os papéis viram `--vx-*` só neste contêiner: o resto do app não muda enquanto se espia. */
export function estiloDosPapeis(papeis: Readonly<Record<string, string>>): CSSProperties {
  const estilo: Record<string, string> = {};
  for (const [papel, valor] of Object.entries(papeis)) estilo[`--vx-${papel}`] = valor;
  return estilo;
}

/**
 * Uma réplica pequena do app, desenhada com os componentes de verdade e os
 * tokens da escolha. É decoração: fica inerte (não recebe foco nem clique) e o
 * nome acessível diz de que tema ela fala.
 */
export function PreviaDoApp({ papeis, nome }: { papeis: Readonly<Record<string, string>>; nome: string }) {
  return (
    <div
      className={css.previa}
      style={estiloDosPapeis(papeis)}
      role="img"
      aria-label={t.previaDe(nome)}
      data-testid="previa-da-paleta"
    >
      <FundoVidro className={css.fundo} inert>
        <PainelVidro variante="padrao" raio="md" className={css.coluna}>
          <p className={css.titulo}>{t.previaCanais}</p>
          <span className={css.canalAtivo} data-testid="previa-canal-ativo">
            <Canal tamanho={16} />
            {t.previaCanalAtivo}
          </span>
          <span className={css.canal}>
            <Canal tamanho={16} />
            {t.previaCanalOutro}
          </span>
        </PainelVidro>
        <PainelVidro variante="leitura" raio="md" className={css.conversa}>
          <div className={css.mensagem}>
            <Avatar nome={t.previaNomeA} tamanho={28} status="online" falando />
            <div>
              <span className={css.autor}>{t.previaNomeA}</span>
              <p className={css.texto}>
                {t.previaMensagemA}
                <span className={css.mencao} data-testid="previa-mencao">
                  {t.previaMencao}
                </span>
              </p>
            </div>
          </div>
          <div className={css.mensagem}>
            <Avatar nome={t.previaNomeB} tamanho={28} status="idle" />
            <div>
              <span className={css.autor}>{t.previaNomeB}</span>
              <p className={css.texto}>{t.previaMensagemB}</p>
            </div>
          </div>
          <div className={css.rodape}>
            <Pilula tipo="aoVivo" />
            <Botao tamanho="sm" tabIndex={-1}>
              {t.previaBotao}
            </Botao>
          </div>
        </PainelVidro>
      </FundoVidro>
    </div>
  );
}
