import { useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { criarConta } from "../sdk/conta";
import { exigeConvite } from "../sdk/config";
import { voltarParaEntrar } from "../store/entrada";
import {
  forcaDaSenha,
  MINIMO_DA_SENHA,
  nomeDeUsuarioInvalido,
} from "./forcaDaSenha";
import { guardarEscolhaDeIdentidade } from "../store/entrada";
import css from "./TelaDeLogin.module.css";

/** As quatro barras do medidor. Constantes porque `key` nunca é índice. */
const BARRAS = ["b1", "b2", "b3", "b4"] as const;

/**
 * Criar conta — 1:1 com `Vortex Auth e Conta`.
 *
 * ⚠ **O formulário do design pede quatro coisas e o protocolo aceita duas.**
 * `POST /auth/account/create` leva `email`, `password`, `invite` e `captcha` —
 * nome de usuário e nome de exibição não passam por ali. Eles são de DEPOIS:
 * `username` vai em `/onboard/complete` e `display_name` num `PATCH
 * /users/@me`.
 *
 * A escolha aqui foi manter o formulário do design e guardar as duas respostas
 * para o onboarding aplicar, em vez de partir o cadastro em duas telas. O
 * design está certo sobre o produto — quem se cadastra decide quem é uma vez
 * só — e a divisão do protocolo é detalhe de transporte, que é exatamente o
 * que a camada anticorrupção existe para absorver.
 *
 * ⚠ **O selo de "disponível / em uso" do design NÃO entrou, e é falta de
 * rota.** O Stoat tem `/onboard/hello`, `/onboard/complete` e
 * `/users/@me/username`, e nenhuma pergunta se um nome está livre. Um selo
 * verde que não consultou nada é pior que selo nenhum: ele afirma. O que ficou
 * é a validação de FORMATO, que é local e verdadeira; a colisão aparece no
 * envio, com a frase do servidor.
 *
 * ⚠ **O campo de convite agora aparece só quando o servidor exige.** O
 * comentário antigo dizia que o cliente "ainda não fala com servidor nenhum na
 * abertura" — isso deixou de ser verdade quando o `baseURL` passou a ser
 * configurado: o SDK busca `GET {baseURL}/` no construtor, e
 * `features.invite_only` vem de lá.
 */
export function TelaDeCriarConta({ motivo }: { motivo: string | undefined }) {
  const [email, setEmail] = useState("");
  const [usuario, setUsuario] = useState("");
  const [exibicao, setExibicao] = useState("");
  const [senha, setSenha] = useState("");
  const [convite, setConvite] = useState("");
  const [enviando, setEnviando] = useState(false);

  const forca = forcaDaSenha(senha);
  const erroDoUsuario = nomeDeUsuarioInvalido(usuario.trim());
  const precisaDeConvite = exigeConvite();

  const podeEnviar =
    email.trim().length > 0 &&
    senha.length >= MINIMO_DA_SENHA &&
    usuario.trim().length >= 2 &&
    erroDoUsuario === undefined &&
    (!precisaDeConvite || convite.trim().length > 0) &&
    !enviando;

  return (
    <div className={css.tela}>
      <form
        className={css.cartaoDeCadastro}
        onSubmit={(e) => {
          e.preventDefault();
          if (!podeEnviar) return;
          setEnviando(true);
          /*
            A identidade é guardada ANTES da chamada, e não depois: quem cria a
            conta é levado direto ao onboarding, e um `then` que gravasse isso
            correria com a troca de tela.
          */
          guardarEscolhaDeIdentidade({
            usuario: usuario.trim(),
            exibicao: exibicao.trim(),
          });
          void criarConta(email.trim(), senha, convite.trim() || undefined)
            .then((ok) => {
              if (ok) voltarParaEntrar();
            })
            .finally(() => setEnviando(false));
        }}
      >
        <div className={css.sobrancelhaDoCartao}>Cadastro</div>
        <h1 className={css.saudacao}>Criar conta</h1>

        {motivo ? (
          <Banner tom="perigo" role="alert" className={css.aviso}>
            {motivo}
          </Banner>
        ) : null}

        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="username"
          autoFocus
          required
          disabled={enviando}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Campo
          rotulo="Nome de usuário"
          prefixo="@"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={enviando}
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          erro={erroDoUsuario}
          dica="Letras, números, ponto, hífen e sublinhado."
        />

        <Campo
          rotulo="Nome de exibição"
          autoComplete="name"
          disabled={enviando}
          value={exibicao}
          onChange={(e) => setExibicao(e.target.value)}
          dica="É como as outras pessoas vão te ver. Dá para mudar depois."
        />

        <div>
          <Campo
            rotulo="Senha"
            type="password"
            revelavel
            autoComplete="new-password"
            required
            disabled={enviando}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

          {/*
            O medidor, e ele é DECORATIVO para quem ouve a tela: o que importa
            já está no texto ao lado, e quatro `div` anunciadas uma a uma
            seriam ruído. Ver `forcaDaSenha` — a heurística é local e não é
            promessa de segurança.
          */}
          <div className={css.medidor} aria-hidden>
            {BARRAS.map((b, i) => (
              <span
                key={b}
                className={css.barraDeForca}
                data-acesa={i < forca.nivel || undefined}
                data-tom={forca.tom}
              />
            ))}
          </div>

          <div className={css.linhaDaForca}>
            <span className={css.rotuloDaForca} data-tom={forca.tom}>
              {forca.rotulo}
            </span>
            <span className={css.minimo}>
              mín. {MINIMO_DA_SENHA} caracteres
            </span>
          </div>
        </div>

        {precisaDeConvite ? (
          <Campo
            rotulo="Convite"
            dica="Esta instância só aceita cadastro com convite."
            autoComplete="off"
            required
            disabled={enviando}
            value={convite}
            onChange={(e) => setConvite(e.target.value)}
          />
        ) : null}

        {/*
          ⚠ **Os dois links do design NÃO apontam para lugar nenhum, e ficam
          como TEXTO.** Ele escreve "termos" e "política de privacidade" como
          `<a href="#">`; esta instância é privada e não tem nenhum dos dois
          documentos. Um link que abre nada é o defeito que o lint de
          `onSelect` existe para matar — e num texto legal ele é pior, porque
          finge que existe algo a ler antes de concordar.
        */}
        <p className={css.termos}>
          Ao criar a conta você concorda com as regras desta instância.
        </p>

        <Botao variante="primario" type="submit" disabled={!podeEnviar}>
          {enviando ? "Criando…" : "Criar conta"}
        </Botao>

        {/*
          A volta. O design não a desenha no cartão de cadastro — mas ele
          também não desenha como sair dele, e a tela de entrada tem
          "Cadastre-se" na direção oposta. Sem o par, quem clicou por engano
          fica preso.
        */}
        <p className={css.rodape}>
          Já tem conta?{" "}
          <button
            type="button"
            className={css.trocarTela}
            disabled={enviando}
            onClick={voltarParaEntrar}
          >
            Entrar
          </button>
        </p>
      </form>
    </div>
  );
}
