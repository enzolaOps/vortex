import { memo, useEffect, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { buscarConvite, entrarPorConvite, type Convite } from "../sdk/servidores";
import { selecionarServidor } from "../store/navegacao";
import { toast } from "../components/ui/toastStore";
import css from "./ConviteNaMensagem.module.css";

/**
 * O cartão de convite embaixo de uma mensagem que traz um link de convite.
 *
 * ⚠ **Quem gera este cartão é o CLIENTE, ao contrário do `Embeds`.** Aquele
 * chega resolvido no snapshot porque o servidor lê a página de destino; um
 * convite não é página, é uma rota da própria API — e o servidor não a expande
 * em `Message.embeds`. Por isso aqui existe estado de carregamento, que o
 * cartão de link não tem.
 *
 * ⚠ **Cache module-level por CÓDIGO, e ele não é otimização preventiva.** A
 * linha de mensagem monta e desmonta na velocidade da rolagem: sem cache, cada
 * passagem por uma mensagem com convite dispararia um `GET /invites/{code}`, e
 * um canal onde alguém colou o link do servidor três vezes faria três
 * requisições por tela. O mapa guarda também a FALHA, senão o convite morto
 * seria pedido de novo a cada quadro.
 */
type Entrada = Convite | "falhou";

const cache = new Map<string, Entrada>();
const emVoo = new Map<string, Promise<void>>();

/*
  Teto pelo mesmo motivo do mapa de `sdk/servidores.ts`: uma sessão de oito
  horas percorrendo canais acumularia uma entrada por convite visto. O mais
  antigo sai — o erro nº 5 do briefing com outra roupa.
*/
const TETO = 64;

function guardar(codigo: string, valor: Entrada): void {
  if (cache.size >= TETO) {
    const maisAntigo = cache.keys().next().value;
    if (maisAntigo !== undefined) cache.delete(maisAntigo);
  }
  cache.set(codigo, valor);
}

function carregar(codigo: string): Promise<void> {
  const jaVoando = emVoo.get(codigo);
  if (jaVoando) return jaVoando;

  const p = buscarConvite(codigo)
    .then((r) => {
      guardar(codigo, "erro" in r ? "falhou" : r);
    })
    .finally(() => emVoo.delete(codigo));

  emVoo.set(codigo, p);
  return p;
}

/** O desfecho de "Entrar", quando ele deixa de ser um botão. */
type Desfecho = "pedido" | "banido";

/**
 * `memo` porque ela pende da linha mais quente do app, e o `codigo` é uma
 * string estável — a mensagem só troca de convite se o texto dela mudar.
 */
export const ConviteNaMensagem = memo(function ConviteNaMensagem({
  codigo,
}: {
  codigo: string;
}) {
  const [entrada, setEntrada] = useState<Entrada | undefined>(() =>
    cache.get(codigo),
  );
  const [entrando, setEntrando] = useState(false);
  const [desfecho, setDesfecho] = useState<Desfecho | undefined>(undefined);

  useEffect(() => {
    const doCache = cache.get(codigo);
    if (doCache !== undefined) {
      setEntrada(doCache);
      return;
    }
    let vivo = true;
    void carregar(codigo).then(() => {
      if (vivo) setEntrada(cache.get(codigo));
    });
    return () => {
      vivo = false;
    };
  }, [codigo]);

  /*
    Convite que não resolve NÃO vira cartão de erro.

    O link continua escrito na mensagem, clicável, e a rota `/convite/:codigo`
    já tem a tela que explica o que houve. Um retângulo vermelho embaixo da
    fala de alguém dizendo "este convite não vale" é ruído permanente numa
    superfície que ninguém pode consertar daqui — e ele mudaria a altura da
    linha por causa de um link quebrado.
  */
  if (entrada === "falhou") return null;

  /*
    Enquanto carrega, uma caixa da MESMA altura do cartão.

    Sem ela a linha cresceria quando a resposta chegasse, e altura mudando
    debaixo do virtualizador desloca a âncora — a mesma regra da reserva de
    espaço do anexo e da miniatura do embed.
  */
  if (entrada === undefined) {
    return <div className={css.esqueleto} aria-hidden />;
  }

  const convite = entrada;

  return (
    <div className={css.cartao}>
      <Avatar
        id={convite.serverId}
        sigla={convite.sigla}
        url={convite.iconeUrl}
        tamanho="md"
        className={css.marca}
      />

      <div className={css.textos}>
        <span className={css.sobrancelha}>Convite para servidor</span>
        <span className={css.nome}>{convite.nomeDoServidor}</span>
        {/*
          ⚠ **O design escreve "142 online · 1.204 membros" e o "online" NÃO
          existe no fio.** `InviteResponse` carrega `member_count` e nada mais
          sobre presença; derivá-lo de quem está online entre os servidores em
          comum daria um número que não é o que a frase promete. Contagem de
          online na prévia do convite é item de back-end novo.
        */}
        <span className={css.detalhe}>
          {convite.membros.toLocaleString("pt-BR")}{" "}
          {convite.membros === 1 ? "membro" : "membros"}
        </span>
      </div>

      {desfecho !== undefined ? (
        <span
          className={css.desfecho}
          data-tom={desfecho === "banido" ? "perigo" : "aviso"}
          role="status"
        >
          {desfecho === "banido" ? "Você foi banida daqui" : "Pedido enviado"}
        </span>
      ) : (
        <Botao
          variante="primario"
          tamanho="pequeno"
          className={css.acao}
          disabled={entrando}
          onClick={() => {
            /* Já sou membro: abre em vez de entrar — o botão dizendo "Entrar"
               para quem já está dentro é a interface mentindo. */
            if (convite.jaSouMembro) {
              selecionarServidor(convite.serverId);
              return;
            }
            setEntrando(true);
            void entrarPorConvite(convite.codigo)
              .then((r) => {
                if (r.tipo === "entrou") {
                  selecionarServidor(r.serverId);
                  return;
                }
                if (r.tipo === "pedido" || r.tipo === "banido") {
                  setDesfecho(r.tipo);
                  return;
                }
                /*
                  Falha de verdade vira TOAST e o cartão fica como está.

                  Trocar o cartão por um estado de erro apagaria da tela o
                  nome do servidor que a pessoa acabou de ler — e a falha aqui
                  é quase sempre transitória (rede, limite de taxa), ou seja,
                  o botão continua sendo a ação certa.
                */
                toast({
                  tipo: "erro",
                  titulo: "Não deu para entrar.",
                  descricao: r.motivo,
                });
              })
              .finally(() => setEntrando(false));
          }}
        >
          {convite.jaSouMembro ? "Abrir" : entrando ? "Entrando…" : "Entrar"}
        </Botao>
      )}
    </div>
  );
});
