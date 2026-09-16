//! A exportação em si — roda fora da requisição, uma por vez.
use std::collections::HashMap;
use std::fs::File;
use std::io::{self, BufWriter};
use std::time::Duration;

use once_cell::sync::Lazy;
use revolt_config::config;
use revolt_database::{
    util::email::{send_email, Template},
    Database, MessageFilter, MessageQuery, MessageTimePeriod,
};
use revolt_models::v0::MessageSort;
use serde::Serialize;
use tokio::sync::Semaphore;

use super::store::{self, DataExport, ExportState};
use super::zip::EscritorDeZip;

/// Uma exportação por vez no processo inteiro.
static FILA: Lazy<Semaphore> = Lazy::new(|| Semaphore::new(1));

/// Página de consulta ao Mongo — do tamanho de um arquivo do ZIP.
///
/// ⚠ **Grande de propósito, e a razão é o índice.** `messages` tem índice só
/// em `author`, não em `(author, _id)`: cada página faz o Mongo buscar TODAS as
/// mensagens da pessoa, filtrar `_id > cursor` e ordenar as primeiras N. O
/// custo total é ~n²/PAGINA documentos lidos, então 1.000 em vez de 100 corta
/// a varredura em dez vezes pelo preço de ~1 MB de memória por página. Criar o
/// índice composto seria migração de banco para uma rota rara.
const PAGINA: i64 = 1000;
/// Mensagens por arquivo dentro do ZIP.
const POR_ARQUIVO: usize = 1000;
/// Respiro entre páginas — o chat ao vivo divide a mesma CPU.
const PAUSA: Duration = Duration::from_millis(100);

type Zip = EscritorDeZip<BufWriter<File>>;

async fn adicionar<T: Serialize + Send + 'static>(
    zip: Zip,
    nome: String,
    valor: T,
) -> io::Result<Zip> {
    tokio::task::spawn_blocking(move || {
        let bytes = serde_json::to_vec_pretty(&valor).map_err(io::Error::other)?;
        let mut zip = zip;
        zip.adicionar(&nome, &bytes)?;
        Ok(zip)
    })
    .await
    .map_err(io::Error::other)?
}

/// Texto que não é JSON (o LEIAME), pelo mesmo caminho fora do executor.
async fn adicionar_texto(zip: Zip, nome: &'static str, texto: &'static str) -> io::Result<Zip> {
    tokio::task::spawn_blocking(move || {
        let mut zip = zip;
        zip.adicionar(nome, texto.as_bytes())?;
        Ok(zip)
    })
    .await
    .map_err(io::Error::other)?
}

const LEIAME: &str = "Seus dados do Vortex\n\
\n\
conta.json         e-mail e estado da conta (sem senha)\n\
usuario.json       perfil, status e insígnias\n\
relacoes.json      amigos, pedidos e bloqueios\n\
servidores.json    servidores em que você está, com apelido e cargos\n\
configuracoes.json preferências sincronizadas\n\
mensagens/         tudo o que você enviou, em ordem, mil por arquivo\n\
\n\
Anexos não vêm dentro do arquivo: cada mensagem traz o identificador do anexo.\n";

pub fn enfileirar(db: Database, user_id: String, token: String) {
    tokio::spawn(async move {
        let _vez = FILA.acquire().await;

        if let Err(e) = rodar(&db, &user_id, &token).await {
            log::error!("exportação de {user_id} falhou: {e:?}");
            let _ = std::fs::remove_file(store::caminho(&user_id, &token).with_extension("part"));
            if let Ok(Some(mut estado)) = store::ler(&user_id).await {
                estado.state = ExportState::Failed;
                estado.finished_at = Some(store::agora_ms());
                estado.download = None;
                let _ = store::guardar(&user_id, &estado).await;
            }
        }
    });
}

async fn marcar(user_id: &str, mudar: impl FnOnce(&mut DataExport)) {
    if let Ok(Some(mut estado)) = store::ler(user_id).await {
        mudar(&mut estado);
        let _ = store::guardar(user_id, &estado).await;
    }
}

#[derive(Serialize)]
struct Conta {
    id: String,
    email: String,
    desativada: bool,
}

#[derive(Serialize)]
struct Relacao {
    id: String,
    usuario: Option<String>,
    estado: String,
}

#[derive(Serialize)]
struct Participacao {
    servidor: String,
    nome: Option<String>,
    apelido: Option<String>,
    cargos: Vec<String>,
    entrou_em: String,
}

async fn rodar(db: &Database, user_id: &str, token: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    marcar(user_id, |e| e.state = ExportState::Running).await;

    let pasta = store::diretorio();
    std::fs::create_dir_all(&pasta)?;
    let parcial = store::caminho(user_id, token).with_extension("part");
    let final_ = store::caminho(user_id, token);

    let mut zip: Zip = EscritorDeZip::new(BufWriter::new(File::create(&parcial)?));

    let conta = db.fetch_account(user_id).await?;
    let usuario = db.fetch_user(user_id).await?;

    zip = adicionar_texto(zip, "LEIAME.txt", LEIAME).await?;

    zip = adicionar(
        zip,
        "conta.json".into(),
        Conta {
            id: conta.id.clone(),
            email: conta.email.clone(),
            desativada: conta.disabled,
        },
    )
    .await?;

    // Relações com o nome de quem está do outro lado.
    let relacoes = usuario.relations.clone().unwrap_or_default();
    let ids: Vec<String> = relacoes.iter().map(|r| r.id.clone()).collect();
    let nomes: HashMap<String, String> = db
        .fetch_users(&ids)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|u| (u.id, format!("{}#{}", u.username, u.discriminator)))
        .collect();
    let relacoes: Vec<Relacao> = relacoes
        .into_iter()
        .map(|r| Relacao {
            usuario: nomes.get(&r.id).cloned(),
            estado: format!("{:?}", r.status),
            id: r.id,
        })
        .collect();

    zip = adicionar(zip, "usuario.json".into(), usuario).await?;
    zip = adicionar(zip, "relacoes.json".into(), relacoes).await?;

    let membros = db.fetch_all_memberships(user_id).await?;
    let ids: Vec<String> = membros.iter().map(|m| m.id.server.clone()).collect();
    let servidores: HashMap<String, String> = db
        .fetch_servers(&ids)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|s| (s.id, s.name))
        .collect();
    let participacoes: Vec<Participacao> = membros
        .into_iter()
        .map(|m| Participacao {
            nome: servidores.get(&m.id.server).cloned(),
            apelido: m.nickname,
            cargos: m.roles,
            entrou_em: m.joined_at.format().to_string(),
            servidor: m.id.server,
        })
        .collect();
    zip = adicionar(zip, "servidores.json".into(), participacoes).await?;

    let configuracoes = db.fetch_user_settings(user_id, &[]).await.unwrap_or_default();
    zip = adicionar(zip, "configuracoes.json".into(), configuracoes).await?;

    // Mensagens: cursor por ID, do mais antigo para o mais novo.
    let mut depois: Option<String> = None;
    let mut lote = Vec::with_capacity(POR_ARQUIVO);
    let mut arquivo = 0u32;
    let mut total = 0u64;

    loop {
        let pagina = db
            .fetch_messages(MessageQuery {
                limit: Some(PAGINA),
                filter: MessageFilter {
                    author: Some(user_id.to_string()),
                    ..Default::default()
                },
                time_period: MessageTimePeriod::Absolute {
                    before: None,
                    after: depois.clone(),
                    sort: Some(MessageSort::Oldest),
                },
            })
            .await?;

        let fim = (pagina.len() as i64) < PAGINA;
        if let Some(ultima) = pagina.last() {
            depois = Some(ultima.id.clone());
        }
        total += pagina.len() as u64;
        lote.extend(pagina);

        while lote.len() >= POR_ARQUIVO || (fim && !lote.is_empty()) {
            let resto = if lote.len() > POR_ARQUIVO {
                lote.split_off(POR_ARQUIVO)
            } else {
                Vec::new()
            };
            arquivo += 1;
            let cheio = std::mem::replace(&mut lote, resto);
            zip = adicionar(zip, format!("mensagens/{arquivo:05}.json"), cheio).await?;
        }

        marcar(user_id, |e| e.messages = total).await;

        if fim {
            break;
        }
        tokio::time::sleep(PAUSA).await;
    }

    let saida = tokio::task::spawn_blocking(move || zip.terminar()).await??;
    drop(saida);

    std::fs::rename(&parcial, &final_)?;
    let tamanho = std::fs::metadata(&final_).map(|m| m.len()).ok();

    store::ligar_token(token, user_id).await?;

    let emailed = enviar_email(&conta.email, token).await;
    let agora = store::agora_ms();
    marcar(user_id, |e| {
        e.state = ExportState::Ready;
        e.finished_at = Some(agora);
        e.expires_at = Some(agora + store::VALIDADE_MS);
        e.size = tamanho;
        e.messages = total;
        e.download = Some(token.to_string());
        e.emailed = emailed;
    })
    .await;

    Ok(())
}

/// Manda o link por e-mail, se houver SMTP. Falha de e-mail não derruba a
/// exportação: o link também aparece na tela de quem pediu.
async fn enviar_email(endereco: &str, token: &str) -> bool {
    let config = config().await;
    if config.api.smtp.host.is_empty() {
        return false;
    }

    let url = format!(
        "{}/auth/export/download/{}/vortex-dados.zip",
        config.hosts.api, token
    );
    let smtp = config.api.smtp.clone();
    let endereco = endereco.to_string();

    tokio::task::spawn_blocking(move || {
        let template = Template {
            title: "Seus dados do Vortex estão prontos".into(),
            text: "Olá,\n\nA cópia dos seus dados do Vortex está pronta. O link abaixo vale por 48 horas:\n\n{{url}}\n\nSe você não pediu esta cópia, troque sua senha e derrube as sessões que não reconhece em Configurações · Dispositivos.\n".into(),
            html: None,
            url: String::new(),
        };
        send_email(&smtp, endereco, &template, serde_json::json!({ "url": url })).is_ok()
    })
    .await
    .unwrap_or(false)
}
