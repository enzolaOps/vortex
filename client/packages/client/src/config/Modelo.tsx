import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Selo } from "../components/ui/Selo";
import { CabecalhoDeSecao } from "./Pagina";
import { aindaNao } from "../pendente/pendencias";
import css from "./Modelo.module.css";

/**
 * Modelo do servidor — a estrutura sem o conteúdo.
 *
 * ⚠ **Nem o conceito nem a rota existem no Stoat.** Não há `template` em
 * `Server`, nem endpoint de criar/aplicar. A tela é 1:1 com a referência e
 * tudo nela é pendente registrado.
 *
 * O que o modelo levaria, e o que ele NUNCA leva, está no subtítulo da página
 * de propósito: canais, categorias, cargos e permissões vão; mensagens,
 * membros e convites não. É a mesma distinção que o schema do preset de
 * layout faz desde a fase 4 — estrutura viaja, dado de sessão não.
 */

/*
  Os quatro números do cartão.

  Tabela e não quatro `<div>` soltos no JSX: são a mesma coisa quatro vezes, e
  escrevê-los inline seria a quinta cópia do mesmo par valor/rótulo.
*/
const RESUMO = [
  { valor: "3", rotulo: "categorias" },
  { valor: "9", rotulo: "canais" },
  { valor: "6", rotulo: "cargos" },
  { valor: "14", rotulo: "exceções" },
] as const;

export function Modelo({ serverId }: { serverId: string }) {
  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  return (
    <div className={css.tela}>
      <Banner
        tom="aviso"
        acoes={<Botao variante="neutro" onClick={aindaNao("modeloDoServidor")}>O que falta</Botao>}
      >
        O protocolo do Stoat não tem modelos de servidor. Esta tela mostra a
        forma final; o modelo abaixo é um exemplo e nada aqui é guardado.
      </Banner>

      <div className={css.cartao}>
        <div className={css.titulo}>
          <span className={css.nome}>Vortex Core — base de produto</span>
          <Selo tom="sucesso">sincronizado</Selo>
        </div>
        <p className={css.meta}>Criado em 12 ago 2026 · usado 14 vezes</p>

        <div className={css.linkLinha}>
          {/*
            Caixa de leitura e não `input`: o endereço não é editável, e um
            campo que parece editável e recusa a digitação é o defeito que o
            lint de `onSelect` existe para matar, com outra forma.
          */}
          <span className={css.link}>vortex.gg/t/vx-core-base</span>
          <Botao variante="neutro" onClick={aindaNao("modeloDoServidor")}>
            Copiar
          </Botao>
        </div>

        <div className={css.resumo}>
          {RESUMO.map((r) => (
            <div key={r.rotulo} className={css.numero}>
              <div className={css.numeroValor}>{r.valor}</div>
              <div className={css.numeroRotulo}>{r.rotulo}</div>
            </div>
          ))}
        </div>

        <div className={css.acoes}>
          <Botao variante="neutro" onClick={aindaNao("modeloDoServidor")}>
            Sincronizar com o servidor atual
          </Botao>
          <Botao variante="perigoSutil" onClick={aindaNao("modeloDoServidor")}>
            Excluir modelo
          </Botao>
        </div>
      </div>

      <CabecalhoDeSecao titulo="Aplicar um modelo" />
      <Banner
        tom="info"
        acoes={<Botao variante="neutro" onClick={aindaNao("modeloDoServidor")}>Pré-visualizar</Botao>}
      >
        Aplicar em um servidor existente ACRESCENTA canais e cargos — nunca
        remove o que já existe.
      </Banner>
    </div>
  );
}
