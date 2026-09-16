import { useEffect, useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Selo } from "../components/ui/Selo";
import { toast } from "../components/ui/toastStore";
import {
  aplicarModelo,
  buscarModelo,
  criarServidorDoModelo,
  excluirModelo,
  gerarModelo,
  linkDoModelo,
  previaDoModelo,
  sincronizarModelo,
  type ModeloDoServidor,
  type PreviaDeModelo,
  type ResumoDeEstrutura,
} from "../sdk/modeloDoServidor";
import { souDono } from "../sdk/servidores";
import { selecionarServidor } from "../store/navegacao";
import { useServer } from "../store/hooks";
import css from "./Modelo.module.css";

const DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Modelo do servidor — a estrutura sem o conteúdo.
 *
 * ⚠ **O modelo é objeto do fork do `api`**, guardado no servidor: gerar
 * captura canais, categorias, cargos e exceções de permissão; sincronizar
 * recaptura; o link reproduz a estrutura num servidor novo ou a ACRESCENTA a
 * um existente. Mensagens, membros, convites, ícones e emojis nunca entram —
 * o modelo é compartilhável por link, e dado de pessoa não pode viajar nele.
 *
 * Não confundir com os presets de "Criar servidor" (`servidores/modelos.ts`),
 * que são listas locais de canais e não carregam cargo nem permissão.
 */
export function Modelo({ serverId }: { serverId: string }) {
  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }
  return <ModeloDoServidorAtual serverId={serverId} />;
}

type Estado = ModeloDoServidor | null | "falhou";

function ModeloDoServidorAtual({ serverId }: { serverId: string }) {
  /*
    ⚠ O "carregando" é DERIVADO de para quem a resposta é, e não zerado num
    efeito — mesma mecânica de Convites: `setState` síncrono dentro de
    `useEffect` é reprovado pelo lint do projeto.
  */
  const [res, setRes] = useState<
    { readonly para: string; readonly dados: Estado } | undefined
  >(undefined);
  const estado = res?.para === serverId ? res.dados : "carregando";

  useEffect(() => {
    let vivo = true;
    void buscarModelo(serverId).then((m) => {
      if (vivo) setRes({ para: serverId, dados: m === undefined ? "falhou" : m });
    });
    return () => {
      vivo = false;
    };
  }, [serverId]);

  const definir = (dados: Estado) => setRes({ para: serverId, dados });

  return (
    <div className={css.tela}>
      {estado === "carregando" ? (
        <div className={css.cartao}>
          <p className={css.recado}>Carregando o modelo…</p>
        </div>
      ) : estado === "falhou" ? (
        <Banner tom="perigo" titulo="Não deu para ler o modelo">
          O servidor não respondeu. Abra esta página de novo em instantes.
        </Banner>
      ) : estado === null ? (
        <SemModelo serverId={serverId} aoGerar={definir} />
      ) : (
        <CartaoDoModelo serverId={serverId} modelo={estado} aoMudar={definir} />
      )}

      <AplicarModelo serverId={serverId} />
    </div>
  );
}

function SemModelo({
  serverId,
  aoGerar,
}: {
  serverId: string;
  aoGerar: (m: ModeloDoServidor) => void;
}) {
  const servidor = useServer(serverId);
  const [nome, setNome] = useState<string | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  /* O nome do servidor é o padrão, mas só até a pessoa digitar: um campo que
     se reescreve quando o servidor muda de nome apagaria o que foi digitado. */
  const valor = nome ?? servidor?.name ?? "";
  const limpo = valor.trim();

  return (
    <div className={css.cartao}>
      <p className={css.subtitulo}>Nenhum modelo gerado</p>
      <p className={css.recado}>
        Gera um link que reproduz canais, categorias, cargos e permissões — sem
        membros, mensagens ou convites.
      </p>
      <Campo
        rotulo="Nome do modelo"
        value={valor}
        maxLength={100}
        onChange={(e) => setNome(e.target.value)}
      />
      <div className={css.acoes}>
        <Botao
          variante="primario"
          disabled={limpo.length === 0}
          carregando={ocupado}
          onClick={() => {
            setOcupado(true);
            void gerarModelo(serverId, limpo).then((m) => {
              setOcupado(false);
              if (m) aoGerar(m);
            });
          }}
        >
          Gerar modelo
        </Botao>
      </div>
    </div>
  );
}

function Resumo({ resumo }: { resumo: ResumoDeEstrutura }) {
  const numeros = [
    { valor: resumo.categorias, rotulo: "categorias" },
    { valor: resumo.canais, rotulo: "canais" },
    { valor: resumo.cargos, rotulo: "cargos" },
    { valor: resumo.excecoes, rotulo: "exceções" },
  ];
  return (
    <div className={css.resumo}>
      {numeros.map((r) => (
        <div key={r.rotulo} className={css.numero}>
          <div className={css.numeroValor}>{String(r.valor)}</div>
          <div className={css.numeroRotulo}>{r.rotulo}</div>
        </div>
      ))}
    </div>
  );
}

function CartaoDoModelo({
  serverId,
  modelo,
  aoMudar,
}: {
  serverId: string;
  modelo: ModeloDoServidor;
  aoMudar: (dados: Estado) => void;
}) {
  const [ocupado, setOcupado] = useState<"sincronizar" | "excluir" | undefined>();
  /* Excluir pede um segundo clique: o link já pode ter sido compartilhado, e
     apagar o modelo o quebra para todo mundo que o tem. */
  const [confirmando, setConfirmando] = useState(false);
  const link = linkDoModelo(modelo.codigo);

  return (
    <div className={css.cartao}>
      <div className={css.cabecalho}>
        <div className={css.titulo}>
          <span className={css.nome}>{modelo.nome}</span>
          <p className={css.meta}>
            {`Criado em ${DATA.format(modelo.criadoEmMs)} · usado ${String(modelo.usos)} ${modelo.usos === 1 ? "vez" : "vezes"}`}
          </p>
        </div>
        {modelo.desatualizado ? (
          <Selo tom="aviso">desatualizado</Selo>
        ) : (
          <Selo tom="sucesso">sincronizado</Selo>
        )}
      </div>

      <div className={css.linkLinha}>
        {/*
          Caixa de leitura e não `input`: o endereço não é editável, e um
          campo que parece editável e recusa a digitação é o defeito que o
          lint de `onSelect` existe para matar, com outra forma.
        */}
        <span className={css.link}>{link}</span>
        <Botao
          variante="neutro"
          onClick={() => {
            void navigator.clipboard.writeText(link).then(
              () => toast({ tipo: "info", titulo: "Link do modelo copiado" }),
              () =>
                toast({
                  tipo: "erro",
                  titulo: "Não deu para copiar",
                  descricao: link,
                }),
            );
          }}
        >
          Copiar
        </Botao>
      </div>

      <Resumo resumo={modelo.resumo} />

      <div className={css.acoes}>
        <Botao
          variante="neutro"
          carregando={ocupado === "sincronizar"}
          disabled={ocupado !== undefined}
          onClick={() => {
            setOcupado("sincronizar");
            void sincronizarModelo(serverId).then((m) => {
              setOcupado(undefined);
              if (m) aoMudar(m);
            });
          }}
        >
          Sincronizar com o servidor atual
        </Botao>
        <Botao
          variante="perigoSutil"
          carregando={ocupado === "excluir"}
          disabled={ocupado !== undefined}
          onClick={() => {
            if (!confirmando) {
              setConfirmando(true);
              return;
            }
            setOcupado("excluir");
            void excluirModelo(serverId).then((ok) => {
              setOcupado(undefined);
              setConfirmando(false);
              if (ok) aoMudar(null);
            });
          }}
        >
          {confirmando ? "Confirmar exclusão" : "Excluir modelo"}
        </Botao>
      </div>
    </div>
  );
}

function AplicarModelo({ serverId }: { serverId: string }) {
  const [entrada, setEntrada] = useState("");
  const [previa, setPrevia] = useState<PreviaDeModelo | undefined>();
  const [erro, setErro] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState<"previa" | "aplicar" | "criar" | undefined>();
  const dono = souDono(serverId);

  return (
    <div className={css.cartao}>
      <p className={css.subtitulo}>Aplicar um modelo</p>
      <p className={css.recado}>
        Aplicar em um servidor existente ACRESCENTA canais e cargos — nunca
        remove o que já existe.
      </p>
      <Campo
        rotulo="Link ou código do modelo"
        value={entrada}
        erro={erro}
        onChange={(e) => {
          setEntrada(e.target.value);
          setErro(undefined);
          setPrevia(undefined);
        }}
      />

      {previa ? (
        <>
          <p className={css.subtitulo}>{previa.nome}</p>
          <Resumo resumo={previa.resumo} />
        </>
      ) : null}

      <div className={css.acoes}>
        {previa === undefined ? (
          <Botao
            variante="neutro"
            disabled={entrada.trim().length === 0}
            carregando={ocupado === "previa"}
            onClick={() => {
              setOcupado("previa");
              void previaDoModelo(entrada).then((r) => {
                setOcupado(undefined);
                if ("erro" in r) setErro(r.erro);
                else setPrevia(r);
              });
            }}
          >
            Pré-visualizar
          </Botao>
        ) : (
          <>
            {/* Só o dono aplica num servidor existente — a rota recusa os
                outros, e o botão não aparece para quem não pode. */}
            {dono ? (
              <Botao
                variante="primario"
                carregando={ocupado === "aplicar"}
                disabled={ocupado !== undefined}
                onClick={() => {
                  setOcupado("aplicar");
                  void aplicarModelo(previa.codigo, serverId).then((ok) => {
                    setOcupado(undefined);
                    if (!ok) return;
                    toast({
                      tipo: "info",
                      titulo: "Modelo aplicado",
                      descricao: `${String(previa.resumo.canais)} canais e ${String(previa.resumo.cargos)} cargos acrescentados.`,
                    });
                    setPrevia(undefined);
                    setEntrada("");
                  });
                }}
              >
                Aplicar neste servidor
              </Botao>
            ) : null}
            <Botao
              variante="neutro"
              carregando={ocupado === "criar"}
              disabled={ocupado !== undefined}
              onClick={() => {
                setOcupado("criar");
                void criarServidorDoModelo(
                  previa.codigo,
                  previa.nomeDoServidor.slice(0, 32),
                ).then((id) => {
                  setOcupado(undefined);
                  if (id) selecionarServidor(id);
                });
              }}
            >
              Criar servidor com este modelo
            </Botao>
          </>
        )}
      </div>
    </div>
  );
}
