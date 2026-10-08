import { useState } from "react";

import { sessao } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import { CampoDeTexto } from "./CampoDeTexto";
import css from "./Entrada.module.css";
import { MoldeDaEntrada } from "./MoldeDaEntrada";
import { problemaDoUsuario } from "./regras";

export interface TelaDeNomeProps {
  /** Frase do último erro (o nome já existe, por exemplo), ainda na tela de nome. */
  motivo: string | undefined;
  salvando: boolean;
  aoEscolher: (nome: string) => void;
  aoCancelar: () => void;
}

/**
 * O primeiro acesso de uma conta sem nome de usuário.
 *
 * A sessão já vale (a pessoa está autenticada), mas entrar no app agora mostraria as
 * mensagens dela sem autor legível. É o único passo entre senha e shell que o
 * cadastro por outro cliente deixa para trás.
 *
 * A prévia mostra como o nome aparece numa mensagem, que é o que a pessoa está
 * decidindo. Não há selo de "disponível": nenhuma rota pergunta se um nome está
 * livre, então "já está em uso" aparece no envio, com a frase do servidor, e o campo
 * mantém o que foi digitado.
 */
export function TelaDeNome({ motivo, salvando, aoEscolher, aoCancelar }: TelaDeNomeProps) {
  const [nome, setNome] = useState("");
  const limpo = nome.trim();
  const problema = problemaDoUsuario(limpo);
  const podeEnviar = limpo.length >= 2 && problema === undefined && !salvando;

  const t = sessao.nome;
  const erroDeFormato =
    problema === "curto" ? t.curto(2 - limpo.length) : problema === "longo" ? t.longo : problema === "invalido" ? t.invalido : undefined;

  return (
    <MoldeDaEntrada titulo={t.titulo} subtitulo={t.subtitulo}>
      <form
        className={css.formulario}
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          if (podeEnviar) aoEscolher(limpo);
        }}
      >
        <CampoDeTexto
          rotulo={t.rotulo}
          prefixo="@"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder={t.exemplo}
          dica={erroDeFormato === undefined && motivo === undefined ? t.regra : undefined}
          value={nome}
          readOnly={salvando}
          erro={erroDeFormato ?? motivo}
          onChange={(e) => setNome(e.target.value.replace(/\s+/g, ""))}
        />

        <div className={css.previa} aria-label={t.previaRotulo} role="group">
          <span className={css.codigoRotulo}>{t.previaRotulo}</span>
          <div className={css.previaMensagem}>
            <Avatar nome={limpo === "" ? t.exemplo : limpo} tamanho={36} />
            <div>
              <p className={css.servidorNome}>{limpo === "" ? t.exemplo : limpo}</p>
              <p className={css.servidorMeta}>{t.previaMensagem}</p>
            </div>
          </div>
        </div>

        <Botao type="submit" className={css.largo} carregando={salvando} disabled={!podeEnviar && !salvando}>
          {salvando ? t.salvando : t.continuar}
        </Botao>
        <Botao variante="fantasma" className={css.largo} disabled={salvando} onClick={aoCancelar}>
          {t.outraConta}
        </Botao>
      </form>
    </MoldeDaEntrada>
  );
}
