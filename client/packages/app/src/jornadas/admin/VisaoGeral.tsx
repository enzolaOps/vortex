import { temServidorDeMidia } from "nucleo/sdk/anexos";
import { salvarServidor, souDono, TAG_DA_IMAGEM, trocarImagemDoServidor } from "nucleo/sdk/servidores";
import { useServer } from "nucleo/store/hooks";
import { useRef, useState } from "react";

import { admin } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import { Camera } from "../../ui/icones";
import { toast } from "../../ui/primitivos/Avisos";
import { CampoDeTexto } from "../sessao/CampoDeTexto";
import { AreaDeTexto, BarraDeSalvar, Bloco, estilosDeConfig as ec, Pagina } from "../config/controles";
import { useImagemEnviavel } from "../config/useImagemEnviavel";
import css from "./admin.module.css";
import { SairDoServidor } from "./SairDoServidor";

const LIMITE_NOME = 32;
const LIMITE_DESCRICAO = 1024;
const ACEITA = "image/png,image/jpeg,image/gif,image/webp";

const t = admin.visaoGeral;

/** Visão geral do servidor (PRD 4.7): nome, ícone e descrição — e a saída. */
export function VisaoGeral({ serverId }: { serverId: string }) {
  const servidor = useServer(serverId);
  const [base, setBase] = useState<{ nome: string; descricao: string } | undefined>();
  const [nome, setNome] = useState<string | undefined>();
  const [descricao, setDescricao] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);
  const temMidia = temServidorDeMidia();

  const icone = useImagemEnviavel({
    tag: TAG_DA_IMAGEM.icone,
    doServidor: servidor?.avatarUrl,
    aplicar: (id) => trocarImagemDoServidor(serverId, "icone", id),
  });

  if (!servidor) return null;
  const doServidor = base ?? { nome: servidor.name, descricao: servidor.descricao };
  const nomeAtual = nome ?? doServidor.nome;
  const descricaoAtual = descricao ?? doServidor.descricao;
  const nomeLimpo = nomeAtual.trim();
  const sujo = nomeLimpo !== doServidor.nome || descricaoAtual.trim() !== doServidor.descricao;
  const dono = souDono(serverId);

  const salvar = async () => {
    if (nomeLimpo === "") return;
    setSalvando(true);
    const ok = await salvarServidor(serverId, nomeLimpo, descricaoAtual.trim());
    setSalvando(false);
    if (!ok) return;
    setBase({ nome: nomeLimpo, descricao: descricaoAtual.trim() });
    setNome(undefined);
    setDescricao(undefined);
    toast({ tipo: "info", titulo: t.salvo });
  };

  return (
    <Pagina>
      {!temMidia && <p className={ec.dica}>{t.semMidia}</p>}
      <Bloco>
        <p className={ec.rotuloDaSecao}>{t.icone}</p>
        <div className={css.linhaDoIcone}>
          <Avatar nome={servidor.name} id={serverId} tamanho={80} imagem={icone.url} />
          <div className={ec.acoes}>
            <Botao
              variante="secundario"
              tamanho="sm"
              icone={<Camera />}
              disabled={!temMidia || icone.estado === "removendo"}
              carregando={icone.estado === "subindo"}
              onClick={() => seletor.current?.click()}
            >
              {icone.estado === "subindo" ? t.enviando : t.trocarIcone}
            </Botao>
            {icone.url !== undefined && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                disabled={!temMidia || icone.estado !== "parado"}
                carregando={icone.estado === "removendo"}
                onClick={icone.remover}
              >
                {t.removerIcone}
              </Botao>
            )}
          </div>
          <input
            ref={seletor}
            data-testid="seletor-do-icone"
            type="file"
            accept={ACEITA}
            className={css.seletorOculto}
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (arquivo) icone.escolher(arquivo);
            }}
          />
        </div>
      </Bloco>

      <Bloco>
        <CampoDeTexto
          rotulo={t.nome}
          maxLength={LIMITE_NOME}
          autoComplete="off"
          value={nomeAtual}
          disabled={salvando}
          erro={nomeLimpo === "" ? t.nomeObrigatorio : undefined}
          onChange={(e) => {
            setNome(e.target.value);
          }}
        />
        <AreaDeTexto
          rotulo={t.descricao}
          rows={4}
          maxLength={LIMITE_DESCRICAO}
          placeholder={t.descricaoPlaceholder}
          value={descricaoAtual}
          disabled={salvando}
          contador={{ usados: descricaoAtual.length, maximo: LIMITE_DESCRICAO }}
          onChange={(e) => {
            setDescricao(e.target.value);
          }}
        />
      </Bloco>

      <Bloco>
        <p className={ec.rotuloDaSecao}>{t.zonaDeRisco}</p>
        <p className={ec.dica}>{dono ? t.zonaDeRiscoDono : t.zonaDeRiscoMembro}</p>
        <div>
          <Botao
            variante="perigo"
            tamanho="sm"
            onClick={() => {
              setSaindo(true);
            }}
          >
            {dono ? admin.menu.apagar : admin.menu.sair}
          </Botao>
        </div>
      </Bloco>

      {sujo && nomeLimpo !== "" && (
        <BarraDeSalvar
          salvando={salvando}
          aoDescartar={() => {
            setNome(undefined);
            setDescricao(undefined);
          }}
          aoSalvar={() => void salvar()}
        />
      )}

      <SairDoServidor serverId={serverId} aberto={saindo} aoMudar={setSaindo} />
    </Pagina>
  );
}
