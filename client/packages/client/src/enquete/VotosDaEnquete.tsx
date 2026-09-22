import { useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { plural } from "../lib/plural";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import {
  assinarEnquetes,
  lerEnqueteBruta,
  MARCAS,
  type EnqueteBruta,
} from "../store/enquetes";
import css from "./Enquete.module.css";

/**
 * "Ver votos" — quem votou em cada resposta.
 *
 * ⚠ **Ele fecha o item que passou três fases como `<span>` inerte.** O rodapé
 * da enquete desenha "Ver votos" desde que a enquete existe, e o texto não
 * abria nada: alvo que parece clicável e não faz nada é exatamente o defeito
 * que o lint de `onSelect` foi instalado para matar nos menus.
 *
 * ⚠ **O dado já existia, e é o BRUTO que o tem.** `Enquete` carrega só as
 * CONTAGENS (`opcao.votos: number`) porque é o que a linha da timeline desenha
 * — copiar os IDs de quem votou para dentro do snapshot da mensagem seria
 * alocação proporcional à contagem no componente mais quente do app, a mesma
 * decisão registrada em `ReacaoSnapshot.quem`. `EnqueteBruta.votos` é
 * `resposta → quem votou`, e quem precisa dela é esta tela, que abre uma vez.
 *
 * ⚠ **Nada aqui vale quando o resultado está escondido.** "Resultado só no
 * fim" existe para não enviesar quem ainda não votou; uma lista de nomes por
 * resposta diz a mesma coisa que a porcentagem, com mais detalhe. Quem decide
 * é o rodapé da enquete, que só mostra o gatilho quando a contagem já está
 * visível — aqui a guarda é repetida, porque o modal também abre por rota de
 * teclado e uma segunda porta para o mesmo vazamento não é hipótese.
 */
export function VotosDaEnquete({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const messageId = alvo?.tipo === "verVotos" ? alvo.messageId : "";

  /*
    `lerEnqueteBruta` devolve a REFERÊNCIA guardada — a armadilha nº 1 do
    briefing. O store troca o objeto inteiro a cada voto, então este getter é
    estável entre votos e acorda exatamente quando um chega.
  */
  const bruta = useSyncExternalStore(assinarEnquetes, () =>
    lerEnqueteBruta(messageId),
  );

  if (!bruta) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Quem votou"
        descricao={bruta.pergunta}
        fechavel
        className={css.painelDeVotos}
      >
        {bruta.esconder && bruta.encerradaEm === undefined ? (
          <EstadoVazio
            compacto
            titulo="O resultado sai no fim"
            detalhe="Quem votou em quê só aparece quando esta enquete fechar."
          />
        ) : (
          <div className={css.votos}>
            {bruta.respostas.map((r, i) => (
              <Resposta
                key={r.id}
                marca={MARCAS[i] ?? "•"}
                texto={r.texto}
                quem={quemVotou(bruta, r.id)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Os IDs de quem votou numa resposta, em ordem estável.
 *
 * `Set` preserva a ordem de inserção, que é a ordem em que os votos chegaram —
 * a mesma que o servidor mandou no `Ready` e depois por evento. Ordenar por
 * nome exigiria ler o perfil de cada pessoa aqui dentro, e um nome que ainda
 * não chegou reordenaria a lista debaixo do ponteiro.
 */
function quemVotou(b: EnqueteBruta, respostaId: string): readonly string[] {
  return [...(b.votos.get(respostaId) ?? [])];
}

function Resposta({
  marca,
  texto,
  quem,
}: {
  marca: string;
  texto: string;
  quem: readonly string[];
}) {
  return (
    <section className={css.grupoDeVotos}>
      <h3 className={css.tituloDaResposta}>
        <span className={css.opcaoMarca} aria-hidden>
          {marca}
        </span>
        <span className={css.opcaoTexto}>{texto}</span>
        <span className={css.contagemDaResposta}>
          {plural(quem.length, "voto", "votos")}
        </span>
      </h3>
      {quem.length === 0 ? (
        /* Dizer "ninguém" e não esconder a seção: uma resposta que some da
           lista é indistinguível de uma resposta que não existe, e a pergunta
           que se faz aqui é justamente qual delas ficou sem voto. */
        <p className={css.semVoto}>Ninguém votou nesta resposta</p>
      ) : (
        <ul className={css.listaDeVotos}>
          {quem.map((id) => (
            <li key={id} className={css.votante}>
              <Avatar id={id} tamanho="xs" />
              <NomeDoAutor userId={id} denso />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
