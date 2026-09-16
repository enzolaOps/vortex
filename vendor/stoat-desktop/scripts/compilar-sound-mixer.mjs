// Compila o `native-sound-mixer` a partir do FONTE e devolve o caminho do `.node`.
//
// ⚠ **Por que existe.** O pacote publicado no npm traz só o binário, sem o C++.
// Esse binário roda no processo main da casca, com permissão total, e mexe no
// áudio do sistema; sem o fonte ninguém consegue conferir o que ele faz. Aqui o
// `.node` que vai para o instalador sai do repositório público, numa tag e num
// commit FIXADOS — o que se lê é o que se executa.
//
// ⚠ **Sem recuo para o binário publicado.** Se a compilação falhar, o build
// falha. Um recuo silencioso devolveria exatamente o binário que este script
// existe para não usar, e ninguém perceberia.
//
// Precisa de CMake e do compilador C++ do Visual Studio — os dois vêm no runner
// `windows-latest` do GitHub, e localmente com o "Desenvolvimento para desktop
// com C++" do Visual Studio (Build Tools, gratuito).
//
// Uso: node scripts/compilar-sound-mixer.mjs  →  imprime o caminho do `.node`.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Versão instalada → tag e commit do fonte.
 *
 * ⚠ **O commit é conferido, não só a tag.** Tag é mutável: alguém com acesso
 * ao repositório pode movê-la para outro código, e o build compilaria o código
 * novo sem aviso. Atualizar o pacote exige acrescentar a linha aqui — e quem a
 * acrescenta é quem leu o diff do fonte.
 */
const FONTES = {
  "3.4.6-win": {
    repositorio: "https://github.com/m1dugh/native-sound-mixer.git",
    tag: "v3.4.6-win",
    commit: "bc454d78f397eeb9c9f5653dfd0fc0820f9e4c11",
  },
};

function rodar(cmd, args, opcoes = {}) {
  return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"], ...opcoes })
    .toString()
    .trim();
}

/** CMake no PATH, ou o que vem dentro do Visual Studio (via vswhere). */
function ambienteComCmake() {
  /*
    ⚠ **Sem as `npm_config_*` e sem `NODE_ENV` do processo pai.** Chamado de
    dentro do `pnpm package`, o Vite do forge já pôs `NODE_ENV=production`, e
    o `npm ci` do clone pulava as devDependencies — o `node-addon-api` entre
    elas —, terminando com sucesso e deixando o cmake-js falhar adiante com
    "Cannot find module 'node-addon-api'".
  */
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !/^npm_/i.test(k) && k !== "NODE_ENV"),
  );
  try {
    rodar("cmake", ["--version"], { env });
    return env;
  } catch {
    const vswhere = join(
      process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
      "Microsoft Visual Studio",
      "Installer",
      "vswhere.exe",
    );
    if (!existsSync(vswhere)) throw new Error("CMake não encontrado e Visual Studio ausente.");
    const vs = rodar(vswhere, ["-latest", "-products", "*", "-property", "installationPath"]);
    const bin = join(vs, "Common7", "IDE", "CommonExtensions", "Microsoft", "CMake", "CMake", "bin");
    if (!existsSync(join(bin, "cmake.exe"))) {
      throw new Error(`O Visual Studio em ${vs} não tem o componente CMake.`);
    }
    env.PATH = `${bin};${env.PATH ?? ""}`;
    return env;
  }
}

/**
 * Gerador do CMake para o Visual Studio instalado, lido do vswhere.
 *
 * ⚠ **Passado explícito para o cmake-js não procurar o Visual Studio.** A busca
 * dele (cópia da do node-gyp) roda um script de PowerShell cuja saída estoura o
 * buffer no runner `windows-latest` — medido: `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`
 * e "unknown version" para o VS 18 —, e termina em "Could not find any Visual
 * Studio installation" com o VS instalado. Com `-G` e `-A` a busca é pulada.
 */
function geradorDoVisualStudio() {
  const vswhere = join(
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe",
  );
  if (!existsSync(vswhere)) throw new Error("vswhere ausente: Visual Studio não instalado.");
  const versao = rodar(vswhere, [
    "-latest",
    "-products",
    "*",
    "-requires",
    "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
    "-property",
    "installationVersion",
  ]);
  const major = versao.split(".")[0];
  /* O ano não vem do vswhere: `catalog_productLineVersion` do VS 2026 é "18". */
  const ano = { 16: "2019", 17: "2022", 18: "2026" }[major];
  if (!ano) throw new Error(`Visual Studio "${versao}" sem gerador do CMake conhecido.`);
  const plataforma = { x64: "x64", ia32: "Win32", arm64: "ARM64" }[process.arch] ?? "x64";
  return { gerador: `Visual Studio ${major} ${ano}`, plataforma };
}

function sha256(arquivo) {
  return createHash("sha256").update(readFileSync(arquivo)).digest("hex");
}

const instalado = JSON.parse(
  readFileSync(join(RAIZ, "node_modules", "native-sound-mixer", "package.json"), "utf8"),
).version;
const fonte = FONTES[instalado];
if (!fonte) {
  throw new Error(
    `native-sound-mixer ${instalado} não tem fonte fixado em scripts/compilar-sound-mixer.mjs. ` +
      "Leia o fonte da nova versão e acrescente tag e commit antes de atualizar.",
  );
}

/* Em `node_modules/.cache`: fora do `tsc` e do lint da casca, ignorado pelo
   git, e fora de `out/` — que o próprio forge limpa ao empacotar. */
const pasta = join(RAIZ, "node_modules", ".cache", "native-sound-mixer-fonte");
rmSync(pasta, { recursive: true, force: true });
rodar("git", ["clone", "--quiet", "--depth", "1", "--branch", fonte.tag, fonte.repositorio, pasta]);

const commit = rodar("git", ["-C", pasta, "rev-parse", "HEAD"]);
if (commit !== fonte.commit) {
  throw new Error(
    `A tag ${fonte.tag} aponta para ${commit}, e o fixado é ${fonte.commit}. ` +
      "A tag foi movida — confira o fonte antes de confiar nele.",
  );
}

const env = ambienteComCmake();
/* `npm ci` pelo lockfile do próprio projeto: as versões de cmake-js e
   node-addon-api são as que o autor usou, e sem scripts de terceiros. */
rodar("npm", ["ci", "--include=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
  cwd: pasta,
  env,
  shell: true,
});
/*
  ⚠ **cmake-js 7.3.1 por cima do lockfile.** O do projeto (7.1.x) não reconhece
  o Visual Studio 18 e não acha o Windows SDK — medido: "could not find a version
  of Visual Studio 2017 or newer" com o VS 2022 instalado. É ferramenta de
  BUILD e não entra no binário; o `node-addon-api`, que entra, segue o do lockfile.
*/
rodar("npm", ["install", "--no-save", "--ignore-scripts", "--no-audit", "--no-fund", "cmake-js@7.3.1"], {
  cwd: pasta,
  env,
  shell: true,
});
const { gerador, plataforma } = geradorDoVisualStudio();
console.error(`cmake-js com o gerador "${gerador}" (${plataforma})`);
rodar("npx", ["cmake-js", "rebuild", "-G", `"${gerador}"`, "-A", plataforma], {
  cwd: pasta,
  env,
  shell: true,
});

const saida = join(pasta, "dist", "addons", "win-sound-mixer.node");
if (!existsSync(saida)) throw new Error("A compilação terminou sem produzir win-sound-mixer.node.");

console.error(
  `native-sound-mixer ${instalado} compilado de ${fonte.repositorio}@${fonte.commit} ` +
    `(sha256 ${sha256(saida)})`,
);
console.log(saida);
