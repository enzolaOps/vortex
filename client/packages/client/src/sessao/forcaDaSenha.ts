/**
 * A força da senha, em quatro degraus.
 *
 * ⚠ **Heurística local, e ela NÃO é uma promessa de segurança.** O que o
 * servidor exige é comprimento; o resto é orientação para quem está
 * escolhendo. Chamá-la de "forte" não torna a senha forte — por isso o rótulo
 * do último degrau é "boa" e não "segura", e por isso nenhum degrau libera
 * nada: o botão depende do mínimo, não daqui.
 *
 * Quatro barras porque o design desenha quatro. Sem biblioteca: um medidor de
 * verdade (`zxcvbn`) são ~800 KB de dicionário para uma barrinha, e este
 * projeto já recusou dependência desse tamanho para o dataset de emoji.
 */

/** O mínimo do design. O servidor aceita menos; aqui a régua é mais alta. */
export const MINIMO_DA_SENHA = 10;

export type ForcaDaSenha = {
  /** 0 a 4 — quantas barras acendem. */
  readonly nivel: 0 | 1 | 2 | 3 | 4;
  readonly rotulo: string;
  /** O token de cor do rótulo e das barras acesas. */
  readonly tom: "danger" | "warning" | "success";
};

const VAZIA: ForcaDaSenha = { nivel: 0, rotulo: "", tom: "danger" };

export function forcaDaSenha(senha: string): ForcaDaSenha {
  if (senha.length === 0) return VAZIA;

  /*
    Os sinais: comprimento acima do mínimo, e variedade de tipo de caractere.
    Comprimento pesa duas vezes porque é o que mais importa de verdade — uma
    senha longa de letras minúsculas resiste melhor que oito caracteres com um
    símbolo, e um medidor que diga o contrário ensina a coisa errada.
  */
  let pontos = 0;
  if (senha.length >= MINIMO_DA_SENHA) pontos += 1;
  if (senha.length >= 16) pontos += 1;

  const variedade =
    Number(/[a-z]/.test(senha)) +
    Number(/[A-Z]/.test(senha)) +
    Number(/\d/.test(senha)) +
    Number(/[^\w\s]/.test(senha));
  if (variedade >= 2) pontos += 1;
  if (variedade >= 3) pontos += 1;

  /*
    Abaixo do mínimo, no máximo UMA barra — não importa quanta variedade
    tenha. Quatro barras acesas numa senha que o botão recusa seria o medidor
    contradizendo o formulário.
  */
  if (senha.length < MINIMO_DA_SENHA) {
    return { nivel: 1, rotulo: "muito curta", tom: "danger" };
  }

  const nivel = Math.max(1, Math.min(4, pontos)) as 1 | 2 | 3 | 4;
  if (nivel <= 1) return { nivel, rotulo: "fraca", tom: "danger" };
  if (nivel === 2) return { nivel, rotulo: "razoável", tom: "warning" };
  if (nivel === 3) return { nivel, rotulo: "boa", tom: "success" };
  return { nivel, rotulo: "muito boa", tom: "success" };
}

/**
 * O nome de usuário serve?
 *
 * ⚠ **A regra é a do PROTOCOLO, não a do design.** O texto desenhado diz
 * "minúsculas, números, ponto e sublinhado"; o schema do Stoat aceita
 * `^(\p{L}|[\d_.-])+$` com 2 a 32 — ou seja, qualquer letra (inclusive
 * acentuada e maiúscula) mais dígito, `_`, `.` e `-`. Repetir a frase do
 * design recusaria nomes que o servidor aceita, e a dica embaixo do campo
 * estaria mentindo sobre o que vai acontecer.
 */
export function nomeDeUsuarioInvalido(nome: string): string | undefined {
  if (nome.length === 0) return undefined;
  if (nome.length < 2) return "Pelo menos 2 caracteres.";
  if (nome.length > 32) return "No máximo 32 caracteres.";
  if (!/^(\p{L}|[\d_.-])+$/u.test(nome)) {
    return "Só letras, números, ponto, hífen e sublinhado.";
  }
  return undefined;
}
