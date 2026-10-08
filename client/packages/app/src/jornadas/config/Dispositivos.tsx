import {
  buscarDispositivos,
  derrubarDispositivoComMotivo,
  derrubarOutrosComMotivo,
  renomearDispositivoComMotivo,
  type Dispositivo,
  type ResultadoDeConta,
} from "nucleo/sdk/perfil";
import { useEffect, useState } from "react";

import { comum, config } from "../../textos";
import { Botao } from "../../ui/ds";
import { toast } from "../../ui/primitivos/Avisos";
import { CampoDeTexto } from "../sessao/CampoDeTexto";
import { Bloco, estilosDeConfig as ec, Pagina } from "./controles";
import { DialogoDeConta } from "./DialogoDeConta";
import css from "./Dispositivos.module.css";

const t = config.dispositivosTela;

type Lista = readonly Dispositivo[] | null | undefined;

/** `undefined` = carregando; `null` = falhou; lista vazia não existe (a sessão atual sempre está nela). */
type Pendente = { readonly tipo: "um"; readonly id: string; readonly nome: string } | { readonly tipo: "todos" };

function dataDe(ms: number | undefined): string | undefined {
  if (ms === undefined) return undefined;
  return new Date(ms).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Dispositivos (PRD 4.6): listar, renomear, derrubar e derrubar os outros.
 *
 * A senha é pedida UMA vez por abertura da tela e fica só na memória deste
 * componente: o servidor troca a senha por um bilhete de uso único a cada
 * derrubada, e pedir a senha a cada linha tornaria "derrubar tudo" mais fácil
 * que derrubar o certo. Sair da tela (ou da conta) a descarta.
 */
export function Dispositivos() {
  const [lista, setLista] = useState<Lista>(undefined);
  const [senha, setSenha] = useState<string | undefined>(undefined);
  const [pendente, setPendente] = useState<Pendente | undefined>(undefined);
  const [editando, setEditando] = useState<string | undefined>(undefined);

  async function recarregar() {
    setLista((await buscarDispositivos()) ?? null);
  }

  useEffect(() => {
    let vivo = true;
    void buscarDispositivos().then((l) => {
      if (vivo) setLista(l ?? null);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const acao = (alvo: Pendente, senhaUsada: string): Promise<ResultadoDeConta> =>
    alvo.tipo === "um"
      ? derrubarDispositivoComMotivo(alvo.id, senhaUsada)
      : derrubarOutrosComMotivo(senhaUsada);

  /** Com a senha já confirmada derruba direto; sem ela abre o pedido. */
  async function pedir(alvo: Pendente) {
    if (senha === undefined) {
      setPendente(alvo);
      return;
    }
    const r = await acao(alvo, senha);
    if (r.ok) {
      toast({ tipo: "info", titulo: alvo.tipo === "um" ? t.desconectado : t.todosDesconectados });
      await recarregar();
      return;
    }
    if (r.causa === "senhaIncorreta") {
      // A senha mudou por fora: descarta a guardada e pede de novo.
      setSenha(undefined);
      setPendente(alvo);
      return;
    }
    toast({ tipo: "erro", titulo: t.falhou });
  }

  if (lista === undefined) {
    return (
      <p className={ec.texto} role="status">
        {t.carregando}
      </p>
    );
  }
  if (lista === null) {
    return (
      <Pagina>
        <p className={ec.erro} role="alert">
          {config.naoDeuParaCarregar}
        </p>
        <div className={ec.acoes}>
          <Botao
            variante="secundario"
            onClick={() => {
              setLista(undefined);
              void recarregar();
            }}
          >
            {comum.tentarDeNovo}
          </Botao>
        </div>
      </Pagina>
    );
  }

  const atual = lista.find((d) => d.atual);
  const outros = lista.filter((d) => !d.atual);

  return (
    <Pagina>
      <Bloco>
        <p className={ec.rotuloDaSecao}>{t.esteDispositivo}</p>
        <div className={css.cartao}>
          <div className={css.cartaoTextos}>
            <span className={css.nome}>{atual?.nome || t.semNome}</span>
            {dataDe(atual?.desde) !== undefined && (
              <span className={css.detalhe}>{t.desde(dataDe(atual?.desde) ?? "")}</span>
            )}
          </div>
          <span className={css.ativo}>{t.ativoAgora}</span>
        </div>
      </Bloco>

      {outros.length === 0 ? (
        <div className={css.vazio} data-testid="dispositivos-vazio">
          <h3 className={ec.titulo}>{t.vazioTitulo}</h3>
          <p className={ec.texto}>{t.vazioTexto}</p>
        </div>
      ) : (
        <Bloco>
          <div className={css.cabecalhoDaLista}>
            <p className={ec.rotuloDaSecao}>{t.outros}</p>
            <Botao
              variante="perigo"
              tamanho="sm"
              onClick={() => {
                void pedir({ tipo: "todos" });
              }}
            >
              {t.desconectarTodos}
            </Botao>
          </div>
          <ul className={css.lista}>
            {outros.map((d) => (
              <li key={d.id} className={css.cartao}>
                {editando === d.id ? (
                  <EdicaoDoNome
                    dispositivo={d}
                    aoTerminar={(mudou) => {
                      setEditando(undefined);
                      if (mudou) void recarregar();
                    }}
                  />
                ) : (
                  <>
                    <div className={css.cartaoTextos}>
                      <span className={css.nome}>{d.nome || t.semNome}</span>
                      {dataDe(d.desde) !== undefined && (
                        <span className={css.detalhe}>{t.desde(dataDe(d.desde) ?? "")}</span>
                      )}
                    </div>
                    <div className={ec.acoes}>
                      <Botao
                        variante="fantasma"
                        tamanho="sm"
                        aria-label={t.renomearRotulo(d.nome || t.semNome)}
                        onClick={() => {
                          setEditando(d.id);
                        }}
                      >
                        {t.renomear}
                      </Botao>
                      <Botao
                        variante="secundario"
                        tamanho="sm"
                        aria-label={t.desconectarRotulo(d.nome || t.semNome)}
                        onClick={() => {
                          void pedir({ tipo: "um", id: d.id, nome: d.nome });
                        }}
                      >
                        {t.desconectar}
                      </Botao>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {pendente !== undefined && (
        <DialogoDeConta
          aberto
          aoMudar={(a) => {
            if (!a) setPendente(undefined);
          }}
          titulo={t.confirmeTitulo}
          descricao={`${pendente.tipo === "um" ? t.confirmeTextoUm : t.confirmeTextoTodos} ${t.confirmeSoUmaVez}`}
          campos={[{ chave: "senha", rotulo: t.senhaAtual, tipo: "password", autoComplete: "current-password" }]}
          confirmar={t.desconectar}
          validar={(v) => (v["senha"] ? undefined : { senha: t.senhaVazia })}
          enviar={(v) => acao(pendente, v["senha"] ?? "")}
          traduzir={(f) =>
            f.causa === "senhaIncorreta"
              ? { chave: "senha", texto: t.senhaErro }
              : { chave: "geral", texto: t.falhou }
          }
          aoConcluir={(v) => {
            setSenha(v["senha"]);
            toast({ tipo: "info", titulo: pendente.tipo === "um" ? t.desconectado : t.todosDesconectados });
            void recarregar();
          }}
        />
      )}
    </Pagina>
  );
}

function EdicaoDoNome({
  dispositivo,
  aoTerminar,
}: {
  dispositivo: Dispositivo;
  aoTerminar: (mudou: boolean) => void;
}) {
  const [nome, setNome] = useState(dispositivo.nome);
  const [salvando, setSalvando] = useState(false);
  return (
    <form
      className={css.edicao}
      onSubmit={(e) => {
        e.preventDefault();
        const limpo = nome.trim();
        if (limpo === "" || limpo === dispositivo.nome) {
          aoTerminar(false);
          return;
        }
        setSalvando(true);
        void renomearDispositivoComMotivo(dispositivo.id, limpo).then((r) => {
          setSalvando(false);
          if (!r.ok) toast({ tipo: "erro", titulo: t.falhou });
          aoTerminar(r.ok);
        });
      }}
    >
      <CampoDeTexto
        rotulo={t.nomeDoDispositivo}
        maxLength={64}
        autoFocus
        value={nome}
        readOnly={salvando}
        onChange={(e) => {
          setNome(e.target.value);
        }}
      />
      <Botao type="submit" tamanho="sm" carregando={salvando}>
        {t.salvarNome}
      </Botao>
      <Botao
        variante="fantasma"
        tamanho="sm"
        disabled={salvando}
        onClick={() => {
          aoTerminar(false);
        }}
      >
        {t.cancelar}
      </Botao>
    </form>
  );
}
