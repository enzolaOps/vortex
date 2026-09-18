import { Botao } from "../components/ui/Botao";
import { DownloadSimple } from "../components/ui/icones";
import { copiarTexto } from "../lib/copiar";
import { linkDeDownload } from "../lib/downloadDoDesktop";
import { voltarParaEntrar } from "../store/entrada";
import css from "./TelaDeDownload.module.css";

const WINDOWS = linkDeDownload("Windows");
const DEB = linkDeDownload("X11; Ubuntu; Linux x86_64");
const PACMAN = linkDeDownload("Linux");

const UBUNTU = `curl -fsSL -o Vortex.deb ${DEB}
sudo apt install ./Vortex.deb`;

const ARCH = `curl -fsSL -o Vortex.pkg.tar.zst ${PACMAN}
sudo pacman -U Vortex.pkg.tar.zst`;

/**
 * Página pública de download — `/download`.
 *
 * Windows tem botão (o instalador existe). Linux é tutorial: um `.deb` que
 * baixa sozinho no clique seria o arquivo errado no Arch, e o inverso no
 * Ubuntu. macOS não tem build.
 */
export function TelaDeDownload() {
  return (
    <main className={css.tela}>
      <div className={css.cartao}>
        <div className={css.marca}>
          <span className={css.ladrilho} aria-hidden>
            V
          </span>
          <span className={css.nome}>Vortex</span>
        </div>

        <h1 className={css.titulo}>Baixar o Vortex</h1>
        <p className={css.lead}>
          O app de desktop para Windows. No Linux, instala pelo terminal.
        </p>

        <a className={css.cta} href={WINDOWS}>
          <DownloadSimple aria-hidden />
          Baixar para Windows
        </a>
        <p className={css.dica}>
          Instalador · ~150&nbsp;MB. Sem certificado de assinatura, o SmartScreen
          avisa uma vez.
        </p>

        <section className={css.linux} aria-labelledby="linux">
          <h2 id="linux" className={css.secao}>
            Linux
          </h2>
          <p className={css.leadCurto}>
            Ubuntu e Debian usam o <code>.deb</code>. Arch, o pacote do pacman.
          </p>

          <Bloco rotulo="Ubuntu / Debian" comando={UBUNTU} />
          <Bloco rotulo="Arch" comando={ARCH} />
        </section>

        <p className={css.macos}>
          macOS não tem build — a Apple exige assinatura de desenvolvedor.
        </p>

        <p className={css.rodape}>
          Já tem conta?{" "}
          <button type="button" className={css.entrar} onClick={voltarParaEntrar}>
            Entrar
          </button>
        </p>
      </div>
    </main>
  );
}

function Bloco({ rotulo, comando }: { rotulo: string; comando: string }) {
  return (
    <div className={css.bloco}>
      <div className={css.blocoTopo}>
        <h3 className={css.blocoTitulo}>{rotulo}</h3>
        <Botao
          variante="sutil"
          tamanho="pequeno"
          onClick={() => void copiarTexto(comando, "Comando")}
        >
          Copiar
        </Botao>
      </div>
      <pre className={css.pre}>
        <code>{comando}</code>
      </pre>
    </div>
  );
}
