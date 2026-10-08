import { temServidorDeMidia } from "nucleo/sdk/anexos";
import {
  definirPresenca,
  definirStatusTexto,
  lerMeuPerfil,
  lerMeuPerfilCompleto,
  salvarNomeEBio,
  TAG_DA_IMAGEM_DO_PERFIL,
  trocarImagemDoPerfil,
} from "nucleo/sdk/perfil";
import type { PresencaEscolhida } from "nucleo/sdk/domain";
import { assinarMeuStatus, lerMeuStatus } from "nucleo/store/meuStatus";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { config } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import { Camera } from "../../ui/icones";
import { toast } from "../../ui/primitivos/Avisos";
import { CampoDeTexto } from "../sessao/CampoDeTexto";
import {
  AreaDeTexto,
  BarraDeSalvar,
  Bloco,
  estilosDeConfig as ec,
  GrupoDeOpcoes,
  Opcao,
  Pagina,
} from "./controles";
import { assinarPerfilMudou, avisarPerfilMudou, lerRevisaoDoPerfil } from "./perfilMudou";
import css from "./Perfil.module.css";
import { useImagemEnviavel } from "./useImagemEnviavel";

const LIMITE_NOME = 32;
const LIMITE_BIO = 190;
const LIMITE_RECADO = 60;

const PRESENCAS: readonly PresencaEscolhida[] = ["online", "idle", "dnd", "invisivel"];
const ACEITA = "image/png,image/jpeg,image/gif,image/webp";

type Carga =
  | { readonly estado: "carregando" }
  | { readonly estado: "falhou" }
  | { readonly estado: "ok"; readonly bio: string; readonly bannerUrl: string | undefined };

/** Perfil (PRD 4.6): carrega o que o `Ready` não manda e então libera o formulário. */
export function Perfil() {
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });

  useEffect(() => {
    let vivo = true;
    void lerMeuPerfilCompleto().then((r) => {
      if (vivo) setCarga(r ? { estado: "ok", ...r } : { estado: "falhou" });
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (carga.estado === "carregando") {
    return (
      <p className={ec.texto} role="status">
        {config.carregando}
      </p>
    );
  }
  return (
    <Formulario
      bioInicial={carga.estado === "ok" ? carga.bio : undefined}
      bannerInicial={carga.estado === "ok" ? carga.bannerUrl : undefined}
    />
  );
}

function Formulario({
  bioInicial,
  bannerInicial,
}: {
  /** `undefined` = não deu para ler: o campo fica travado e a bio nunca é tocada. */
  bioInicial: string | undefined;
  bannerInicial: string | undefined;
}) {
  useSyncExternalStore(assinarPerfilMudou, lerRevisaoDoPerfil);
  const eu = lerMeuPerfil();
  const status = useSyncExternalStore(assinarMeuStatus, lerMeuStatus);

  const [base, setBase] = useState({
    nome: eu?.displayName === eu?.username ? "" : (eu?.displayName ?? ""),
    bio: bioInicial,
    recado: status.texto ?? "",
  });
  const [nome, setNome] = useState(base.nome);
  const [bio, setBio] = useState(base.bio ?? "");
  const [recado, setRecado] = useState(base.recado);
  const [salvando, setSalvando] = useState(false);

  const temMidia = temServidorDeMidia();
  const seletorDeFoto = useRef<HTMLInputElement>(null);
  const seletorDeBanner = useRef<HTMLInputElement>(null);

  const foto = useImagemEnviavel({
    tag: TAG_DA_IMAGEM_DO_PERFIL.avatar,
    doServidor: eu?.avatarUrl,
    aplicar: (id) => trocarImagemDoPerfil("avatar", id),
    aoMudar: avisarPerfilMudou,
  });
  const banner = useImagemEnviavel({
    tag: TAG_DA_IMAGEM_DO_PERFIL.banner,
    doServidor: bannerInicial,
    aplicar: (id) => trocarImagemDoPerfil("banner", id),
    aoMudar: avisarPerfilMudou,
  });

  if (!eu) return null;

  const nomeLimpo = nome.trim();
  const bioLimpa = bio.trim();
  const recadoLimpo = recado.trim();
  const mudouNomeOuBio =
    nomeLimpo !== base.nome || (base.bio !== undefined && bioLimpa !== base.bio);
  const mudouRecado = recadoLimpo !== base.recado;
  const sujo = mudouNomeOuBio || mudouRecado;
  const nomeExibido = nomeLimpo || eu.username;

  function descartar() {
    setNome(base.nome);
    setBio(base.bio ?? "");
    setRecado(base.recado);
  }

  async function salvar() {
    setSalvando(true);
    let ok = true;
    if (mudouNomeOuBio) ok = await salvarNomeEBio(nomeLimpo, base.bio === undefined ? undefined : bioLimpa);
    if (ok && mudouRecado) ok = await definirStatusTexto(recadoLimpo);
    setSalvando(false);
    if (!ok) return;
    setBase({ nome: nomeLimpo, bio: base.bio === undefined ? undefined : bioLimpa, recado: recadoLimpo });
    avisarPerfilMudou();
    toast({ tipo: "info", titulo: config.salvouComSucesso });
  }

  const escolherArquivo = (acao: (f: File) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (arquivo) acao(arquivo);
  };

  return (
    <Pagina>
      {!temMidia && <p className={ec.dica}>{config.perfilTela.semMidia}</p>}

      <Bloco>
        <p className={ec.rotuloDaSecao}>{config.perfilTela.banner}</p>
        <div className={css.banner} data-testid="banner-do-perfil">
          {banner.url !== undefined && <img className={css.bannerImagem} src={banner.url} alt="" />}
          <div className={css.acoesDoBanner}>
            {banner.url !== undefined && (
              <Botao
                variante="secundario"
                tamanho="sm"
                disabled={!temMidia || banner.estado !== "parado"}
                carregando={banner.estado === "removendo"}
                onClick={banner.remover}
              >
                {config.perfilTela.removerBanner}
              </Botao>
            )}
            <Botao
              variante="secundario"
              tamanho="sm"
              icone={<Camera />}
              disabled={!temMidia || banner.estado === "removendo"}
              carregando={banner.estado === "subindo"}
              onClick={() => seletorDeBanner.current?.click()}
            >
              {banner.estado === "subindo" ? config.perfilTela.enviando : config.perfilTela.trocarBanner}
            </Botao>
          </div>
          <input
            ref={seletorDeBanner}
            data-testid="seletor-de-banner"
            type="file"
            accept={ACEITA}
            className={css.seletorOculto}
            tabIndex={-1}
            aria-hidden="true"
            onChange={escolherArquivo(banner.escolher)}
          />
        </div>

        <div className={css.linhaDoAvatar}>
          <div className={css.foto} data-testid="foto-do-perfil">
            <Avatar nome={nomeExibido} id={eu.username} tamanho={80} />
            {foto.url !== undefined && <img className={css.fotoImagem} src={foto.url} alt="" />}
          </div>
          <div className={ec.acoes}>
            <Botao
              variante="secundario"
              tamanho="sm"
              disabled={!temMidia || foto.estado === "removendo"}
              carregando={foto.estado === "subindo"}
              onClick={() => seletorDeFoto.current?.click()}
            >
              {foto.estado === "subindo" ? config.perfilTela.enviando : config.perfilTela.trocarAvatar}
            </Botao>
            {foto.url !== undefined && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                disabled={!temMidia || foto.estado !== "parado"}
                carregando={foto.estado === "removendo"}
                onClick={foto.remover}
              >
                {config.perfilTela.removerAvatar}
              </Botao>
            )}
          </div>
          <input
            ref={seletorDeFoto}
            data-testid="seletor-de-foto"
            type="file"
            accept={ACEITA}
            className={css.seletorOculto}
            tabIndex={-1}
            aria-hidden="true"
            onChange={escolherArquivo(foto.escolher)}
          />
        </div>
      </Bloco>

      <Bloco>
        <CampoDeTexto
          rotulo={config.perfilTela.nomeDeExibicao}
          dica={config.perfilTela.nomeDeExibicaoDica}
          maxLength={LIMITE_NOME}
          autoComplete="off"
          value={nome}
          placeholder={eu.username}
          disabled={salvando}
          onChange={(e) => {
            setNome(e.target.value);
          }}
        />
        <AreaDeTexto
          rotulo={config.perfilTela.sobreVoce}
          rows={4}
          maxLength={LIMITE_BIO}
          placeholder={config.perfilTela.sobreVocePlaceholder}
          value={bio}
          disabled={salvando || base.bio === undefined}
          contador={{ usados: bio.length, maximo: LIMITE_BIO }}
          onChange={(e) => {
            setBio(e.target.value);
          }}
        />
        {base.bio === undefined && <p className={ec.erro}>{config.naoDeuParaCarregar}</p>}
        <CampoDeTexto
          rotulo={config.perfilTela.recado}
          maxLength={LIMITE_RECADO}
          autoComplete="off"
          placeholder={config.perfilTela.recadoPlaceholder}
          value={recado}
          disabled={salvando}
          onChange={(e) => {
            setRecado(e.target.value);
          }}
        />
      </Bloco>

      <Bloco>
        <p className={ec.rotuloDaSecao}>{config.perfilTela.presenca}</p>
        <GrupoDeOpcoes rotulo={config.perfilTela.presenca}>
          {PRESENCAS.map((p) => (
            <Opcao
              key={p}
              marcada={status.presenca === p}
              aoEscolher={() => {
                void definirPresenca(p);
              }}
            >
              {config.perfilTela.presencas[p]}
            </Opcao>
          ))}
        </GrupoDeOpcoes>
        <p className={ec.dica}>{config.perfilTela.ajudaDaPresenca[status.presenca]}</p>
      </Bloco>

      <Bloco>
        <p className={ec.rotuloDaSecao}>{config.perfilTela.previa}</p>
        <div className={css.cartao} data-testid="previa-do-cartao">
          <div className={css.cartaoBanner}>
            {banner.url !== undefined && <img className={css.cartaoBannerImagem} src={banner.url} alt="" />}
          </div>
          <div className={css.cartaoCorpo}>
            <div className={css.cartaoAvatar}>
              <Avatar nome={nomeExibido} id={eu.username} tamanho={48} />
              {foto.url !== undefined && <img className={css.fotoImagem} src={foto.url} alt="" />}
            </div>
            <p className={css.cartaoNome}>{nomeExibido}</p>
            <span className={css.cartaoUsuario}>@{eu.username}</span>
            <span className={css.cartaoPresenca}>
              {config.perfilTela.presencas[status.presenca]}
              {recadoLimpo !== "" && ` · ${recadoLimpo}`}
            </span>
            {bioLimpa !== "" && (
              <>
                <span className={ec.rotuloDaSecao}>{config.perfilTela.sobre}</span>
                <p className={css.cartaoBio}>{bioLimpa}</p>
              </>
            )}
          </div>
        </div>
        <p className={ec.dica}>{config.perfilTela.previaLegenda}</p>
      </Bloco>

      {sujo && <BarraDeSalvar salvando={salvando} aoDescartar={descartar} aoSalvar={() => void salvar()} />}
    </Pagina>
  );
}
