import { useEffect, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Girador } from "../components/ui/Girador";
import { toast } from "../components/ui/toastStore";
import { primeiroCanalDe } from "../sdk/adapter";
import {
  criarLinkDeCargo,
  enderecoDoLink,
  listarLinksDoCargo,
  type LinkDeCargo,
} from "../sdk/linksDeCargo";
import { pode } from "../sdk/permissoes";
import { revogarConvite } from "../sdk/servidores";
import css from "./LinksDoCargo.module.css";

/**
 * Cargos · Links — o convite que dá o cargo a quem entra por ele.
 *
 * Arquivo próprio e não um bloco dentro de `Cargos.tsx`: a aba tem estado de
 * rede (listar, criar, revogar) e o editor de cargo já é a tela mais densa do
 * app. Os estilos continuam os de `Cargos.module.css`, porque o desenho é o
 * mesmo da aba que existia.
 *
 * Três estados, pela regra de "falha de rede não vira lista vazia": carregando,
 * não deu para saber, e a lista (vazia ou não).
 */
export function LinksDoCargo({
  serverId,
  roleId,
  nome,
}: {
  serverId: string;
  roleId: string;
  nome: string;
}) {
  const [resposta, setResposta] = useState<
    | { readonly para: string; readonly dados: readonly LinkDeCargo[] | undefined }
    | undefined
  >(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);

  const alvo = `${serverId}:${roleId}:${String(versao)}`;
  useEffect(() => {
    let vivo = true;
    void listarLinksDoCargo(serverId, roleId).then((dados) => {
      if (vivo) setResposta({ para: alvo, dados });
    });
    return () => {
      vivo = false;
    };
  }, [serverId, roleId, alvo]);

  /* Derivado de PARA QUEM a resposta é — trocar de cargo mostra "carregando"
     sem zerar estado dentro de um efeito. */
  const carregando = resposta?.para !== alvo;
  const links = carregando ? undefined : resposta?.dados;

  const canal = primeiroCanalDe(serverId) ?? "";
  const podeCriar = pode(canal, "atribuirCargos") && pode(canal, "criarConvite");

  const criar = () => {
    setOcupado(true);
    void criarLinkDeCargo(serverId, roleId)
      .then((codigo) => {
        if (codigo !== undefined) setVersao((v) => v + 1);
      })
      .finally(() => setOcupado(false));
  };

  return (
    <div className={css.aba}>
      <p className={css.titulo}>Link de atribuição</p>
      <p className={css.texto}>
        Quem abrir este link e entrar no servidor recebe <strong>{nome}</strong>{" "}
        automaticamente.
      </p>

      {carregando ? (
        <Girador tamanho={20} rotulo="Carregando links" />
      ) : links === undefined ? (
        <EstadoVazio
          compacto
          titulo="Não deu para ver os links"
          detalhe="A lista não carregou. Isso não quer dizer que não haja nenhum."
        />
      ) : links.length === 0 ? (
        podeCriar ? (
          <div className={css.linha}>
            <Botao variante="primario" disabled={ocupado} onClick={criar}>
              {ocupado ? "Criando…" : "Criar link"}
            </Botao>
          </div>
        ) : (
          <EstadoVazio
            compacto
            titulo="Nenhum link dá este cargo"
            detalhe="Criar um exige poder dar cargos e convidar."
          />
        )
      ) : (
        <div className={css.lista}>
          {links.map((l) => (
            <LinhaDeLink
              key={l.codigo}
              link={l}
              serverId={serverId}
              aoRevogar={() => setVersao((v) => v + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaDeLink({
  link,
  serverId,
  aoRevogar,
}: {
  link: LinkDeCargo;
  serverId: string;
  aoRevogar: () => void;
}) {
  const [revogando, setRevogando] = useState(false);
  const endereco = enderecoDoLink(link.codigo);
  return (
    <div className={css.linha}>
      <span className={css.endereco}>{endereco.replace(/^https?:\/\//, "")}</span>
      <Botao
        variante="primario"
        onClick={() => {
          void navigator.clipboard
            .writeText(endereco)
            .then(() => toast({ tipo: "info", titulo: "Link copiado." }))
            .catch(() =>
              toast({ tipo: "erro", titulo: "Não deu para copiar.", descricao: endereco }),
            );
        }}
      >
        Copiar
      </Botao>
      <Botao
        variante="perigoSutil"
        disabled={revogando}
        onClick={() => {
          setRevogando(true);
          void revogarConvite(serverId, link.codigo)
            .then((ok) => {
              if (ok) aoRevogar();
            })
            .finally(() => setRevogando(false));
        }}
      >
        Revogar
      </Botao>
    </div>
  );
}
