import { useEffect, useRef, useState, type DragEvent } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { sigla } from "../lib/sigla";
import { temServidorDeMidia, tetoDeUploadTexto } from "../sdk/anexos";
import {
  lerMeuBanner,
  lerMeuPerfil,
  salvarPerfil,
  TAG_DA_IMAGEM_DO_PERFIL,
  trocarImagemDoPerfil,
} from "../sdk/perfil";
import { useImagemEnviavel } from "./useImagemEnviavel";
import css from "./Perfil.module.css";
import secao from "./Secao.module.css";

/** Os tipos que o `autumn` sabe redimensionar. Mesma lista de `Servidor.tsx`. */
const ACEITA = "image/png,image/jpeg,image/gif,image/webp";

/**
 * Nome de exibição, pronomes, bio — e, agora, avatar e banner (D-AUTH-38/39).
 *
 * Um formulário e um botão para os três campos de TEXTO, e não três — três
 * botões "salvar" fazem a pessoa salvar um campo e perder os outros dois, que
 * é o defeito mais comum de tela de perfil.
 *
 * ⚠ **As duas imagens ficam FORA da barra de salvar**, e é a mesma decisão do
 * ícone do servidor: escolher um arquivo já é a intenção inteira, e o `autumn`
 * guardou o arquivo no instante do envio — prendê-lo atrás de "Salvar"
 * acenderia "alterações não salvas" por um upload que já aconteceu.
 *
 * Nome de USUÁRIO não está aqui: ele exige senha e mora em "Conta". A
 * separação não é burocracia — nome de exibição é como você se apresenta, nome
 * de usuário é como as pessoas te acham.
 */
export function Perfil() {
  const [inicial] = useState(() => lerMeuPerfil());
  const [nome, setNome] = useState(inicial?.displayName ?? "");
  const [pronomes, setPronomes] = useState(inicial?.pronomes ?? "");
  const [bio, setBio] = useState(inicial?.bio ?? "");
  const [salvando, setSalvando] = useState(false);

  /*
    ⚠ **O banner NÃO está no cache do usuário** — `profile.background` vem de
    `fetchProfile()`, que é uma chamada própria, pela mesma razão da bio.
    Buscá-lo aqui é o que impede a área de soltar dizer "arraste o banner" por
    cima de um banner que já existe.
  */
  const [bannerDoServidor, setBannerDoServidor] = useState<string | undefined>(
    undefined,
  );
  useEffect(() => {
    let vivo = true;
    void lerMeuBanner().then((url) => {
      if (vivo) setBannerDoServidor(url);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const avatar = useImagemEnviavel({
    tag: TAG_DA_IMAGEM_DO_PERFIL.avatar,
    nome: "avatar",
    doServidor: inicial?.avatarUrl,
    aplicar: (id) => trocarImagemDoPerfil("avatar", id),
  });
  const banner = useImagemEnviavel({
    tag: TAG_DA_IMAGEM_DO_PERFIL.banner,
    nome: "banner",
    doServidor: bannerDoServidor,
    aplicar: (id) => trocarImagemDoPerfil("banner", id),
  });

  const seletorDeAvatar = useRef<HTMLInputElement>(null);
  const seletorDeBanner = useRef<HTMLInputElement>(null);
  const [sobreOBanner, setSobreOBanner] = useState(false);
  const temMidia = temServidorDeMidia();
  const tetoDoAvatar = tetoDeUploadTexto("avatars");

  if (!inicial) {
    return (
      <p className={secao.recado}>Entre na sua conta para editar o perfil.</p>
    );
  }

  const avatarUrl = avatar.url;
  const bannerUrl = banner.url;

  function soltarBanner(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setSobreOBanner(false);
    const arquivo = e.dataTransfer.files[0];
    if (arquivo && temMidia) banner.escolher(arquivo);
  }

  return (
    <div className={secao.forma}>
      {/* ------------------------------------------------------ avatar */}
      <div>
        <p className={css.sobrancelha}>Avatar</p>
        <div className={css.avatar}>
          {/*
            O `Avatar` do projeto, e não um ladrilho próprio: aqui é uma
            PESSOA, e a escala `--vx-avatar-*` é justamente a calibrada para
            isso. O ladrilho de 64 do servidor existe porque servidor tem outro
            raio e outro peso de letra — a diferença é de forma, não de gosto.
          */}
          <Avatar
            id={inicial.username}
            sigla={sigla(nome || inicial.username)}
            url={avatarUrl}
            tamanho="lg"
          />
          <div className={css.avatarTextos}>
            <div className={css.avatarAcoes}>
              <Botao
                variante="neutro"
                disabled={!temMidia || avatar.estado === "removendo"}
                carregando={avatar.estado === "subindo"}
                rotuloCarregando="Enviando"
                onClick={() => seletorDeAvatar.current?.click()}
              >
                Enviar imagem
              </Botao>
              <Botao
                variante="perigoSutil"
                disabled={avatarUrl === undefined || avatar.estado === "subindo"}
                carregando={avatar.estado === "removendo"}
                rotuloCarregando="Removendo"
                onClick={avatar.remover}
              >
                Remover
              </Botao>
            </div>
            {/*
              ⚠ **O teto sai da CONFIGURAÇÃO da instância, nunca de um número
              escrito aqui.** O default do `autumn` para `avatars` é 4 MB, e
              uma pista que prometa outra coisa garante a recusa — o mesmo
              defeito já registrado no ícone do servidor.
            */}
            <span className={css.pista}>
              {temMidia
                ? `Recomendado 512×512 · GIF animado suportado${tetoDoAvatar ? ` · até ${tetoDoAvatar}` : ""}`
                : "Esta instância não tem onde guardar imagens."}
            </span>
          </div>
          <input
            ref={seletorDeAvatar}
            type="file"
            accept={ACEITA}
            className={css.seletor}
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (arquivo) avatar.escolher(arquivo);
            }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------ banner */}
      <div>
        <p className={css.sobrancelha}>Banner do perfil</p>
        {/*
          A área de envio mostra o banner que JÁ existe — um retângulo tracejado
          dizendo "arraste" sobre um banner posto ontem mentiria sobre ele.
        */}
        <button
          type="button"
          className={css.dropzone}
          data-sobre={sobreOBanner || undefined}
          data-com-imagem={bannerUrl !== undefined || undefined}
          aria-busy={banner.estado === "subindo" || undefined}
          disabled={!temMidia || banner.estado !== "parado"}
          onClick={() => seletorDeBanner.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setSobreOBanner(true);
          }}
          onDragLeave={() => setSobreOBanner(false)}
          onDrop={soltarBanner}
        >
          {bannerUrl !== undefined ? (
            <img className={css.imagemDoBanner} src={bannerUrl} alt="" />
          ) : null}
          <span className={css.dropzoneMedida}>
            {banner.estado === "subindo"
              ? "enviando o banner…"
              : bannerUrl !== undefined
                ? "arraste outro banner · 1200×480"
                : "arraste o banner · 1200×480"}
          </span>
          <span className={css.dropzoneGesto}>
            {temMidia
              ? "ou clique para enviar"
              : "esta instância não tem onde guardar imagens"}
          </span>
        </button>
        <input
          ref={seletorDeBanner}
          type="file"
          accept={ACEITA}
          className={css.seletor}
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (arquivo) banner.escolher(arquivo);
          }}
        />
        {bannerUrl !== undefined ? (
          <Botao
            variante="perigoSutil"
            tamanho="pequeno"
            className={css.removerBanner}
            disabled={banner.estado === "subindo"}
            carregando={banner.estado === "removendo"}
            rotuloCarregando="Removendo"
            onClick={banner.remover}
          >
            Remover banner
          </Botao>
        ) : null}
      </div>

      {/* ------------------------------------------------------- texto */}
      <form
        className={secao.forma}
        onSubmit={(e) => {
          e.preventDefault();
          setSalvando(true);
          void salvarPerfil(nome.trim(), pronomes.trim(), bio.trim()).finally(
            () => setSalvando(false),
          );
        }}
      >
        <Campo
          rotulo="Nome de exibição"
          dica="Como as pessoas te veem. Vazio volta ao nome de usuário."
          autoComplete="off"
          disabled={salvando}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <Campo
          rotulo="Pronomes"
          /* Vazio REMOVE em vez de virar string vazia — ver `salvarPerfil`. A
             diferença é a linha some do cartão de perfil, em vez de aparecer em
             branco. */
          dica="Aparecem no seu cartão de perfil. Pode ficar vazio."
          autoComplete="off"
          disabled={salvando}
          value={pronomes}
          onChange={(e) => setPronomes(e.target.value)}
        />

        <Campo
          rotulo="Sobre você"
          dica="Uma linha ou duas. Aparece quando alguém abre seu perfil."
          autoComplete="off"
          disabled={salvando}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />

        <div className={secao.acoes}>
          <Botao variante="primario" type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </div>
      </form>
    </div>
  );
}
