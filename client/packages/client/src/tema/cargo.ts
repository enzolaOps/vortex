/**
 * A cor de cargo, com a luminosidade decidida pelo APP.
 *
 * O cargo colorido vem do servidor — é escolha de quem administra, e o Vortex
 * não tem por que discutir o matiz. O que ele não pode aceitar é a
 * LUMINOSIDADE, porque é ela que decide se o nome é legível.
 *
 * O furo que isto fecha era o único da garantia de contraste do projeto. O
 * picker de paleta torna contraste ruim impossível para vinte tokens fixando a
 * rampa de L; a cor de cargo passava por fora, direto para o DOM via `style`, e
 * o `pnpm contrast` não podia vê-la justamente porque ela não é token.
 *
 * Medido antes: **22 de 22 nomes coloridos reprovavam 4,5:1 no tema claro**, do
 * pior 1,33:1 ao melhor 1,87:1 — nome de autor na mensagem, nome na member
 * list, nome na sala de voz e os cabeçalhos de seção de cargo. O arnês semeia
 * `#bcaef2`, `#9bdcb4` e `#f0cd8d`, que são valores da paleta ESCURA: no claro
 * eles viram texto quase branco sobre branco.
 *
 * O conserto é o mesmo princípio que já estava implementado em `derivar.ts`,
 * aplicado a mais uma entrada: **matiz e croma do usuário, luminosidade do
 * app**. Em OKLCH o L é perceptualmente uniforme, então um L fixo entrega o
 * mesmo contraste em qualquer matiz — e é isso que permite garantir por
 * construção em vez de validar depois.
 *
 * A prova está em `cargo.test.ts`, que varre matiz × croma × modo e exige
 * 4,5:1 contra as quatro superfícies. Avisar protegeria quem lê o aviso;
 * construir assim protege todo mundo.
 */
import { hexParaOklch, oklchParaHex } from "./cor";
import type { Modo } from "./derivar";

/**
 * O L de cada modo, copiado da rampa de `--vx-text-2`.
 *
 * `text-2` e não `text-1`: o nome de autor colorido convive com nomes NÃO
 * coloridos na mesma coluna, e igualar o L do texto primário faria o cargo
 * competir com quem não tem cargo. Um degrau abaixo mantém a hierarquia e
 * ainda passa com folga — `text-2` é um dos pares verificados.
 */
const L_DO_CARGO: Record<Modo, number> = {
  escuro: 0.792904,
  claro: 0.400967,
};

/**
 * Teto de croma, por modo.
 *
 * Os mesmos valores de `TETO_DE_CROMA` em `derivar.ts`, e pela mesma razão:
 * acima disso a cor sai do gamut sRGB e o `oklchParaHex` teria que reduzir o
 * croma sozinho — o que produz uma cor que ninguém escolheu.
 */
const TETO: Record<Modo, number> = { escuro: 0.11, claro: 0.19 };

/**
 * Traduz a cor bruta do protocolo para uma cor legível neste tema.
 *
 * `undefined` entra e sai — cargo sem cor é ausência, e o componente já trata
 * isso caindo na cor de texto normal.
 */
export function corDeCargo(
  bruta: string | undefined,
  modo: Modo,
): string | undefined {
  if (!bruta) return undefined;

  let cor;
  try {
    cor = hexParaOklch(bruta);
  } catch {
    // Cor que não é hex — o protocolo permite gradiente CSS em cargo, e um
    // dia isso vai chegar. Devolver `undefined` faz o nome usar a cor de
    // texto normal, que é legível; devolver a string crua reabriria o furo.
    return undefined;
  }

  return oklchParaHex({
    l: L_DO_CARGO[modo],
    c: Math.min(cor.c, TETO[modo]),
    h: cor.h,
  });
}
