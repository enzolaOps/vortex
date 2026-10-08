import {
  buscarConvite,
  criarServidor,
  entrarPorConvite,
  type Convite,
} from "nucleo/sdk/servidores";
import { abrirServidor } from "nucleo/store/ultimoLugar";
import { useEffect, useId, useState, type FormEvent } from "react";

import { admin, comum, salas } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import { toast } from "../../ui/primitivos/Avisos";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import css from "./admin.module.css";

const t = admin.criarServidor;

type Aba = "criar" | "entrar";

/** O que o campo de convite já sabe: nada, buscando, convite válido ou o motivo de não ser. */
type Busca =
  | { readonly estado: "vazio" }
  | { readonly estado: "buscando"; readonly de: string }
  | { readonly estado: "valido"; readonly de: string; readonly convite: Convite }
  | { readonly estado: "invalido"; readonly de: string; readonly motivo: string };

function Criar({ aoConcluir }: { aoConcluir: () => void }) {
  const idDoNome = useId();
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | undefined>();

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const limpo = nome.trim();
    if (limpo === "") {
      setErro(t.nomeObrigatorio);
      return;
    }
    setOcupado(true);
    setErro(undefined);
    // O servidor nasce com a sala de voz "Geral"; o canal de texto vem do próprio servidor.
    const id = await criarServidor(limpo, salas.titulo, [{ nome: t.salaInicial, voz: true }]);
    setOcupado(false);
    if (id === undefined) {
      setErro(t.falhou);
      return;
    }
    abrirServidor(id);
    toast({ tipo: "info", titulo: t.criouEm(limpo) });
    aoConcluir();
  };

  return (
    <form
      className={css.formulario}
      onSubmit={(e) => {
        void enviar(e);
      }}
    >
      <div className={css.campo}>
        <label className={css.rotulo} htmlFor={idDoNome}>
          {t.nome}
        </label>
        <input
          id={idDoNome}
          className={css.entrada}
          value={nome}
          maxLength={32}
          autoFocus
          autoComplete="off"
          placeholder={t.nomePlaceholder}
          aria-invalid={erro === t.nomeObrigatorio}
          onChange={(e) => {
            setNome(e.target.value);
          }}
        />
        <p className={css.dica}>{t.jaVem}</p>
      </div>
      {erro !== undefined && (
        <p className={css.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={css.rodapeDoDialogo}>
        <Botao type="submit" carregando={ocupado}>
          {ocupado ? t.criando : t.criar}
        </Botao>
      </div>
    </form>
  );
}

function Entrar({ aoConcluir }: { aoConcluir: () => void }) {
  const idDoCampo = useId();
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState<Busca>({ estado: "vazio" });
  const [entrando, setEntrando] = useState(false);
  const [desfecho, setDesfecho] = useState<string | undefined>();
  const limpo = texto.trim();

  // Busca o convite enquanto a pessoa digita, com uma pausa para não chamar a cada tecla.
  useEffect(() => {
    if (limpo === "") return;
    let vivo = true;
    const espera = setTimeout(() => {
      setBusca({ estado: "buscando", de: limpo });
      void buscarConvite(limpo).then((r) => {
        if (!vivo) return;
        setBusca("erro" in r ? { estado: "invalido", de: limpo, motivo: r.erro } : { estado: "valido", de: limpo, convite: r });
      });
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [limpo]);

  const atual = limpo !== "" && busca.estado !== "vazio" && busca.de === limpo ? busca : undefined;

  const entrar = async () => {
    if (atual?.estado !== "valido") return;
    const convite = atual.convite;
    if (convite.jaSouMembro) {
      abrirServidor(convite.serverId);
      aoConcluir();
      return;
    }
    setEntrando(true);
    const r = await entrarPorConvite(convite.codigo);
    setEntrando(false);
    if (r.tipo === "entrou") {
      abrirServidor(r.serverId);
      toast({ tipo: "info", titulo: t.entrouEm(convite.nomeDoServidor) });
      aoConcluir();
    } else if (r.tipo === "pedido") {
      setDesfecho(t.pedidoEnviado);
    } else if (r.tipo === "banido") {
      setDesfecho(t.banido);
    } else {
      setDesfecho(r.motivo);
    }
  };

  return (
    <form
      className={css.formulario}
      onSubmit={(e) => {
        e.preventDefault();
        void entrar();
      }}
    >
      <div className={css.campo}>
        <label className={css.rotulo} htmlFor={idDoCampo}>
          {t.convite}
        </label>
        <input
          id={idDoCampo}
          className={css.entrada}
          value={texto}
          autoFocus
          autoComplete="off"
          placeholder={t.convitePlaceholder}
          aria-invalid={atual?.estado === "invalido"}
          onChange={(e) => {
            setTexto(e.target.value);
            setDesfecho(undefined);
          }}
        />
        <p className={css.dica}>{t.conviteAjuda}</p>
      </div>

      {atual?.estado === "buscando" && (
        <p className={css.dica} role="status">
          {t.buscando}
        </p>
      )}
      {atual?.estado === "invalido" && (
        <p className={css.erro} role="alert">
          {atual.motivo}
        </p>
      )}
      {atual?.estado === "valido" && (
        <div className={css.previa} data-testid="previa-do-convite">
          <Avatar
            nome={atual.convite.nomeDoServidor}
            id={atual.convite.serverId}
            tamanho={44}
            imagem={atual.convite.iconeUrl}
          />
          <div>
            <strong>{atual.convite.nomeDoServidor}</strong>
            <p className={css.dica}>
              {atual.convite.jaSouMembro
                ? t.jaSouMembro
                : `${t.membros(atual.convite.membros)} · ${t.conviteValido}`}
            </p>
          </div>
        </div>
      )}
      {desfecho !== undefined && (
        <p className={css.aviso} role="status">
          {desfecho}
        </p>
      )}

      <div className={css.rodapeDoDialogo}>
        <Botao
          type="submit"
          carregando={entrando}
          aria-disabled={atual?.estado !== "valido" || undefined}
        >
          {entrando ? t.entrando : atual?.estado === "valido" && atual.convite.jaSouMembro ? t.abrir : t.entrar}
        </Botao>
      </div>
    </form>
  );
}

/**
 * Criar um servidor ou entrar num por convite (PRD 4.7). Duas abas num diálogo
 * só: quem chega aqui tem uma das duas intenções, e a pergunta é qual.
 */
export function CriarServidor({
  aberto,
  aoMudar,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
}) {
  const [aba, setAba] = useState<Aba>("criar");
  const rotulo = useId();
  const abas: readonly { readonly id: Aba; readonly nome: string }[] = [
    { id: "criar", nome: t.abaCriar },
    { id: "entrar", nome: t.abaEntrar },
  ];

  return (
    <Dialogo open={aberto} onOpenChange={aoMudar}>
      <ConteudoDoDialogo titulo={t.titulo} descricao={t.descricao}>
        <div className={css.formulario}>
          <span id={rotulo} hidden>
            {t.abas}
          </span>
          <div role="tablist" aria-labelledby={rotulo} className={css.abas}>
            {abas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                className={css.aba}
                onClick={() => {
                  setAba(a.id);
                }}
              >
                {a.nome}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {aba === "criar" ? (
              <Criar
                aoConcluir={() => {
                  aoMudar(false);
                }}
              />
            ) : (
              <Entrar
                aoConcluir={() => {
                  aoMudar(false);
                }}
              />
            )}
          </div>
          <div className={css.rodapeDoDialogo}>
            <Botao
              variante="fantasma"
              onClick={() => {
                aoMudar(false);
              }}
            >
              {comum.cancelar}
            </Botao>
          </div>
        </div>
      </ConteudoDoDialogo>
    </Dialogo>
  );
}
