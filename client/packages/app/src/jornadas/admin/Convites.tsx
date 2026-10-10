import { chaveDeMembro } from "nucleo/sdk/domain";
import {
  criarConvite,
  listarConvites,
  revogarConvite,
  type ConviteDoServidor,
} from "nucleo/sdk/servidores";
import { useCanaisDeTexto, useCanaisDeVoz, useChannel, useMembro } from "nucleo/store/hooks";
import { useEffect, useId, useState } from "react";

import { admin } from "../../textos";
import { Botao } from "../../ui/ds";
import { Copiar } from "../../ui/icones";
import { toast } from "../../ui/primitivos/Avisos";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import { Confirmacao } from "./Confirmacao";
import css from "./admin.module.css";
import { Carregando, Falhou, Vazio } from "./Estados";

/** O link que o convite vira: a rota `/convite/:codigo` deste app. */
export const enderecoDoConvite = (codigo: string): string => `${location.origin}/convite/${codigo}`;

type Lista = { readonly para: string; readonly revisao: number; readonly lista: readonly ConviteDoServidor[] | undefined };

function NomeDoCriador({ serverId, userId }: { serverId: string; userId: string }) {
  const membro = useMembro(chaveDeMembro(serverId, userId));
  return <>{membro?.displayName ?? admin.membrosPagina.voce}</>;
}

/** Cria um convite para um canal escolhido e mostra o link com o botão de copiar. */
function CriarConvite({
  serverId,
  aberto,
  aoMudar,
  aoCriar,
}: {
  serverId: string;
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  aoCriar: () => void;
}) {
  const texto = useCanaisDeTexto(serverId);
  const voz = useCanaisDeVoz(serverId);
  const destinos = [...texto, ...voz];
  const idDoSeletor = useId();
  const [escolhido, setEscolhido] = useState<string | undefined>();
  const [gerando, setGerando] = useState(false);
  const [link, setLink] = useState<string | undefined>();
  const [falhou, setFalhou] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const destino = escolhido !== undefined && destinos.includes(escolhido) ? escolhido : destinos[0];

  const gerar = async () => {
    if (destino === undefined) return;
    setGerando(true);
    setFalhou(false);
    const codigo = await criarConvite(destino);
    setGerando(false);
    if (codigo === undefined) {
      setFalhou(true);
      return;
    }
    setLink(enderecoDoConvite(codigo));
    aoCriar();
  };

  const copiar = () => {
    if (link === undefined) return;
    void navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
    });
  };

  const fechar = (valor: boolean) => {
    if (!valor) {
      setLink(undefined);
      setCopiado(false);
      setFalhou(false);
    }
    aoMudar(valor);
  };

  return (
    <Dialogo open={aberto} onOpenChange={fechar}>
      <ConteudoDoDialogo titulo={admin.convitesPagina.criarTitulo} descricao={admin.convitesPagina.destinoAjuda}>
        <div className={css.formulario}>
          {destinos.length === 0 ? (
            <p className={css.erro}>{admin.convitesPagina.semCanais}</p>
          ) : (
            <div className={css.campo}>
              <label className={css.rotulo} htmlFor={idDoSeletor}>
                {admin.convitesPagina.destino}
              </label>
              <select
                id={idDoSeletor}
                className={css.entrada}
                value={destino}
                disabled={link !== undefined}
                onChange={(e) => {
                  setEscolhido(e.target.value);
                }}
              >
                {destinos.map((id) => (
                  <option key={id} value={id}>
                    <NomeDoCanalNaLista id={id} />
                  </option>
                ))}
              </select>
            </div>
          )}
          {falhou && (
            <p className={css.erro} role="alert">
              {admin.canaisPagina.falhou}
            </p>
          )}
          {link !== undefined && (
            <div className={css.campo}>
              <span className={css.rotulo}>{admin.convitesPagina.link}</span>
              <div className={css.linhaDoLink}>
                <input
                  className={`${css.entrada} ${css.entradaMono}`}
                  readOnly
                  value={link}
                  aria-label={admin.convitesPagina.link}
                  data-testid="link-do-convite"
                  onFocus={(e) => {
                    e.currentTarget.select();
                  }}
                />
                <Botao icone={<Copiar />} onClick={copiar}>
                  {copiado ? admin.convitesPagina.copiado : admin.convitesPagina.copiar}
                </Botao>
              </div>
            </div>
          )}
          <div className={css.rodapeDoDialogo}>
            {link === undefined ? (
              <>
                <Botao
                  variante="fantasma"
                  onClick={() => {
                    fechar(false);
                  }}
                >
                  {admin.membrosPagina.cancelar}
                </Botao>
                <Botao
                  carregando={gerando}
                  disabled={destino === undefined}
                  onClick={() => {
                    void gerar();
                  }}
                >
                  {gerando ? admin.convitesPagina.gerando : admin.convitesPagina.gerar}
                </Botao>
              </>
            ) : (
              <Botao
                onClick={() => {
                  fechar(false);
                }}
              >
                {admin.convitesPagina.concluir}
              </Botao>
            )}
          </div>
        </div>
      </ConteudoDoDialogo>
    </Dialogo>
  );
}

/** O nome do canal dentro de um `<option>`, que só aceita texto. */
function NomeDoCanalNaLista({ id }: { id: string }) {
  const canal = useChannel(id);
  return <>{canal?.name ?? id}</>;
}

/** Convites do servidor (PRD 4.7): listar, criar e revogar. */
export function Convites({ serverId }: { serverId: string }) {
  const [revisao, setRevisao] = useState(0);
  const [resposta, setResposta] = useState<Lista | undefined>();
  const [criando, setCriando] = useState(false);
  const [revogando, setRevogando] = useState<string | undefined>();

  useEffect(() => {
    let vivo = true;
    void listarConvites(serverId).then((lista) => {
      if (vivo) setResposta({ para: serverId, revisao, lista });
    });
    return () => {
      vivo = false;
    };
  }, [serverId, revisao]);

  // "Carregando" é derivado de para quem a resposta é, e não zerado num efeito.
  const atual = resposta?.para === serverId && resposta.revisao === revisao ? resposta : undefined;

  const revogar = async (codigo: string) => {
    const ok = await revogarConvite(serverId, codigo);
    if (ok) {
      toast({ tipo: "info", titulo: admin.convitesPagina.revogado });
      setRevisao((r) => r + 1);
    }
    return ok;
  };

  return (
    <div className={css.pagina}>
      <div className={css.barra}>
        <span />
        <Botao
          onClick={() => {
            setCriando(true);
          }}
        >
          {admin.convitesPagina.criar}
        </Botao>
      </div>

      {atual === undefined ? (
        <Carregando texto={admin.convitesPagina.carregando} />
      ) : atual.lista === undefined ? (
        <Falhou
          texto={admin.convitesPagina.erro}
          aoTentar={() => {
            setRevisao((r) => r + 1);
          }}
        />
      ) : atual.lista.length === 0 ? (
        <Vazio titulo={admin.convitesPagina.vazio} />
      ) : (
        <ul
          className={css.tabela}
          aria-label={admin.navegacao.convites}
          style={{ ["--colunas" as string]: "minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr) auto" }}
        >
          <li className={css.cabecalhoDaTabela} aria-hidden="true">
            <span>{admin.convitesPagina.codigo}</span>
            <span>{admin.convitesPagina.criadoPor}</span>
            <span>{admin.convitesPagina.canal}</span>
            <span />
          </li>
          {atual.lista.map((c) => (
            <li key={c.codigo} className={css.linha} data-testid="linha-de-convite" data-codigo={c.codigo}>
              <span className={`${css.celula} ${css.mono}`}>{c.codigo}</span>
              <span className={css.celula}>
                <NomeDoCriador serverId={serverId} userId={c.porId} />
              </span>
              <span className={`${css.celula} ${css.meta}`}>
                {c.canal}
              </span>
              <span className={css.acoesDaLinha}>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  aria-label={admin.convitesPagina.revogarConvite(c.codigo)}
                  onClick={() => {
                    setRevogando(c.codigo);
                  }}
                >
                  {admin.convitesPagina.revogar}
                </Botao>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Confirmacao
        aberto={revogando !== undefined}
        aoMudar={(a) => {
          if (!a) setRevogando(undefined);
        }}
        titulo={admin.convitesPagina.revogarTitulo(revogando ?? "")}
        texto={admin.convitesPagina.revogarTexto}
        confirmar={admin.convitesPagina.revogar}
        aoConfirmar={() => (revogando === undefined ? Promise.resolve(false) : revogar(revogando))}
      />

      <CriarConvite
        serverId={serverId}
        aberto={criando}
        aoMudar={setCriando}
        aoCriar={() => {
          setRevisao((r) => r + 1);
        }}
      />
    </div>
  );
}
