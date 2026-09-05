import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { aindaNao } from "../pendente/pendencias";
import css from "./Figurinhas.module.css";

/**
 * Figurinhas do servidor.
 *
 * ⚠ **Nem tipo, nem rota, nem evento no Stoat.** O protocolo tem EMOJI de
 * servidor (`/custom/emoji`), e figurinha é outra coisa: imagem grande com
 * nome e descrição, enviada como mensagem inteira em vez de dentro do texto.
 * A tela é 1:1 com a referência e tudo nela é pendente registrado.
 *
 * ⚠ **A lista é EXEMPLO, e o banner é o que impede a confusão.** Sem ele,
 * três figurinhas na tela de um servidor que não tem nenhuma leem como dado
 * real — o mesmo defeito que os interruptores de Acesso teriam sem o aviso.
 */

const EXEMPLOS = [
  { id: "aplausos", emoji: "👏", nome: "aplausos", descricao: "Reação de fim de sprint" },
  { id: "cafe", emoji: "☕", nome: "café", descricao: "Pausa" },
  { id: "foguete", emoji: "🚀", nome: "foguete", descricao: "Deploy" },
] as const;

/** O teto do plano na referência. Aqui é exemplo, como o resto. */
const VAGAS = 6;

export function Figurinhas({ serverId }: { serverId: string }) {
  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  return (
    <div className={css.tela}>
      <Banner
        tom="aviso"
        acoes={<Botao variante="neutro" onClick={aindaNao("figurinhas")}>O que falta</Botao>}
      >
        O protocolo do Stoat não tem figurinhas — só emoji. As três abaixo são
        exemplo; nada aqui é guardado.
      </Banner>

      <div className={css.barra}>
        <Botao variante="primario" onClick={aindaNao("figurinhas")}>
          Enviar figurinha
        </Botao>
      </div>

      <ul className={css.lista}>
        {EXEMPLOS.map((f) => (
          <li key={f.id} className={css.item}>
            {/*
              O quadro grande é o que distingue figurinha de emoji na própria
              tela: emoji vive dentro de uma linha de texto, figurinha ocupa a
              mensagem. Reproduzir isso aqui é o que faz a página explicar o
              conceito sem uma frase a mais.
            */}
            <span aria-hidden className={css.quadro}>
              {f.emoji}
            </span>
            <div className={css.textos}>
              <span className={css.nome}>{f.nome}</span>
              <span className={css.descricao}>{f.descricao}</span>
            </div>
            <div className={css.acoes}>
              <Botao variante="sutil" onClick={aindaNao("figurinhas")}>
                Editar
              </Botao>
              <Botao variante="perigoSutil" onClick={aindaNao("figurinhas")}>
                Excluir
              </Botao>
            </div>
          </li>
        ))}
      </ul>

      <p className={css.rodape}>
        {VAGAS - EXEMPLOS.length} vagas restantes
      </p>
    </div>
  );
}
