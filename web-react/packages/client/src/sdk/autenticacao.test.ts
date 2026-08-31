import { describe, expect, it } from "vitest";

import { motivoDe } from "./autenticacao";

/**
 * A tradução do erro, que é a parte do login que se pode testar sem servidor.
 *
 * "Failed to fetch" é escrito para quem programa. Quem digitou a senha precisa
 * saber se errou a senha ou se o servidor não respondeu — são problemas
 * diferentes, com ações diferentes, e confundi-los faz a pessoa tentar a coisa
 * errada por minutos.
 *
 * Nenhuma mensagem daqui repete o texto do servidor: a resposta do protocolo é
 * em inglês, escrita para uma API, e carrega o arquivo e a linha do Rust onde
 * a falha aconteceu — passá-la adiante mostraria a plumbing para quem só quer
 * entrar no app.
 *
 * ⚠ **Este arquivo testava uma FICÇÃO, e foi por isso que o defeito
 * sobreviveu.** A versão anterior passava `{ response: { status: 401 } }` — a
 * forma do `axios`, que este projeto não usa em lugar nenhum. O `stoat-api`
 * faz `throw data` com o corpo já parseado, então o que chega é
 * `{ type: "InvalidCredentials", location: "..." }` e nunca tem `.response`.
 *
 * Os cinco testes passavam contra um objeto que o app jamais produz, enquanto
 * no navegador toda falha — senha errada, e-mail repetido, conta desativada —
 * dizia a mesma frase de rede. Teste verde sobre entrada inventada é pior que
 * teste ausente: ele afirma que o caminho foi conferido.
 *
 * As formas abaixo foram MEDIDAS contra a instância local, com `curl`.
 */
describe("motivo da falha de login", () => {
  it("credencial inválida diz que é a credencial", () => {
    // Medido: 401 `{"type":"InvalidCredentials"}` — conta que não existe.
    expect(motivoDe({ type: "InvalidCredentials" })).toContain("incorretos");
  });

  it("a falha chega como STRING, e é assim que o SDK a lança", () => {
    /*
      ⚠ O caso que de verdade acontece, e o que este arquivo inteiro deixou
      passar duas vezes. O `stoat-api` lê a resposta com `.text()` e, no
      caminho de erro, faz `throw data` — sem parsear. Objeto é a exceção;
      string é a regra.
    */
    const cru =
      '{"type":"InvalidCredentials","location":"crates/delta/src/routes/session/login.rs:120:28"}';
    expect(motivoDe(cru)).toContain("incorretos");
  });

  it("string que não é JSON cai no fallback de rede", () => {
    // Um 502 de proxy devolve HTML, não JSON.
    expect(motivoDe("<html>502 Bad Gateway</html>")).toContain("conexão");
  });

  it("senha curta na ENTRADA também é credencial, não uma dica de formato", () => {
    /*
      Medido: 400 `{"type":"ShortPassword"}` quando a senha não bate com o
      mínimo do servidor. Dizer "muito curta" a quem só errou a senha entrega
      informação sobre a senha certa e manda a pessoa para o lado errado.
    */
    expect(motivoDe({ type: "ShortPassword" })).toContain("incorretos");
  });

  it("conta desativada é estado próprio, não falha de senha", () => {
    const m = motivoDe({ type: "DisabledAccount" });
    expect(m).toContain("desativada");
    expect(m).not.toContain("incorretos");
  });

  it("bloqueio pede espera, não outra tentativa", () => {
    // Dizer "tente de novo" num bloqueio faz a pessoa cavar mais fundo o buraco.
    const m = motivoDe({ type: "LockedOut" });
    expect(m).toContain("Espere");
    expect(m).not.toContain("Tente de novo");
  });

  it("a `location` do Rust NUNCA chega à tela", () => {
    /*
      O corpo real traz `"location":"crates/delta/src/routes/session/login.rs:120:28"`.
      Ele expõe a versão do servidor e não ajuda ninguém que esteja tentando
      entrar.
    */
    const m = motivoDe({
      type: "InvalidCredentials",
      location: "crates/delta/src/routes/session/login.rs:120:28",
    });
    expect(m).not.toContain("crates");
    expect(m).not.toContain("InvalidCredentials");
  });

  it("tipo desconhecido cai no status, e o status ainda diz algo", () => {
    // Um 502 do proxy devolve HTML e não tem `type` nenhum.
    expect(motivoDe({ status: 503 })).toContain("servidor");
  });

  it("sem tipo e sem status é rede — o pedido não chegou a lugar nenhum", () => {
    expect(motivoDe(new Error("Failed to fetch"))).toContain("conexão");
  });

  it("erro de forma inesperada ainda produz frase legível", () => {
    // Nunca `undefined` na tela: uma caixa de erro vazia é pior que nenhuma.
    for (const e of [undefined, null, "texto", {}, { type: 7 }]) {
      expect(motivoDe(e).length).toBeGreaterThan(10);
    }
  });
});
