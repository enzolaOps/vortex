//! Estado da exportação no Redis, e o diretório no disco.
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use redis_kiss::{get_connection, AsyncCommands};
use revolt_result::{create_error, Result, ToRevoltError};
use serde::{Deserialize, Serialize};

/// Quanto o link vale.
pub const VALIDADE_MS: i64 = 48 * 60 * 60 * 1000;
/// Intervalo mínimo entre dois pedidos da mesma conta.
pub const INTERVALO_MS: i64 = 24 * 60 * 60 * 1000;

/// # Estado de uma exportação
#[derive(Serialize, Deserialize, JsonSchema, Clone, Copy, PartialEq, Eq)]
pub enum ExportState {
    Queued,
    Running,
    Ready,
    Failed,
}

/// # Exportação de dados
#[derive(Serialize, Deserialize, JsonSchema, Clone)]
pub struct DataExport {
    pub state: ExportState,
    /// Unix ms
    pub requested_at: i64,
    /// Unix ms em que ficou pronta ou falhou
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<i64>,
    /// Unix ms em que o link deixa de valer
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
    /// Tamanho do arquivo, em bytes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    /// Mensagens incluídas até agora
    pub messages: u64,
    /// Unix ms a partir de quando um novo pedido é aceito
    pub next_request_at: i64,
    /// Token do link de download — só aparece com `Ready`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub download: Option<String>,
    /// Se um e-mail com o link foi enviado
    pub emailed: bool,
}

pub fn agora_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}

fn chave(user_id: &str) -> String {
    format!("vortex:export:{user_id}")
}

fn chave_do_token(token: &str) -> String {
    format!("vortex:export:token:{token}")
}

/// A exportação some do Redis junto com o link — nunca antes dele.
const VIDA_NO_REDIS: usize = ((VALIDADE_MS + INTERVALO_MS) / 1000) as usize;

pub async fn ler(user_id: &str) -> Result<Option<DataExport>> {
    let mut conn = get_connection()
        .await
        .map_err(|_| create_error!(InternalError))?;
    let texto: Option<String> = conn.get(chave(user_id)).await.to_internal_error()?;
    Ok(texto.and_then(|t| serde_json::from_str(&t).ok()))
}

pub async fn guardar(user_id: &str, estado: &DataExport) -> Result<()> {
    let texto = serde_json::to_string(estado).to_internal_error()?;
    let mut conn = get_connection()
        .await
        .map_err(|_| create_error!(InternalError))?;
    conn.set_ex::<_, _, ()>(chave(user_id), texto, VIDA_NO_REDIS)
        .await
        .to_internal_error()
}

pub async fn ligar_token(token: &str, user_id: &str) -> Result<()> {
    let mut conn = get_connection()
        .await
        .map_err(|_| create_error!(InternalError))?;
    conn.set_ex::<_, _, ()>(chave_do_token(token), user_id, (VALIDADE_MS / 1000) as usize)
        .await
        .to_internal_error()
}

pub async fn dono_do_token(token: &str) -> Result<Option<String>> {
    let mut conn = get_connection()
        .await
        .map_err(|_| create_error!(InternalError))?;
    conn.get(chave_do_token(token)).await.to_internal_error()
}

pub fn diretorio() -> PathBuf {
    std::env::var("VORTEX_EXPORT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir().join("vortex-exports"))
}

/// Nome do arquivo no disco. O token entra no nome: sem ele, um usuário não
/// consegue adivinhar o caminho do arquivo de outro.
pub fn caminho(user_id: &str, token: &str) -> PathBuf {
    diretorio().join(format!("{user_id}-{token}.zip"))
}

/// O token só pode ter o alfabeto do nanoid — ele vira parte de um caminho.
pub fn token_valido(token: &str) -> bool {
    token.len() == 48
        && token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

/// Apaga o que passou da validade. Barato: a pasta tem um arquivo por pedido
/// das últimas 48 h, e numa instância privada isso é um punhado.
pub async fn limpar_expirados() {
    let pasta = diretorio();
    let _ = tokio::task::spawn_blocking(move || {
        let itens = match std::fs::read_dir(&pasta) {
            Ok(itens) => itens,
            Err(_) => return,
        };
        let validade = Duration::from_millis(VALIDADE_MS as u64);
        for item in itens.flatten() {
            let velho = item
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.elapsed().ok())
                .map(|idade| idade > validade)
                .unwrap_or(false);
            if velho {
                let _ = std::fs::remove_file(item.path());
            }
        }
    })
    .await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_nao_escapa_do_diretorio() {
        assert!(!token_valido("../../etc/passwd"));
        assert!(!token_valido(&"a/".repeat(24)));
        assert!(token_valido(&"a".repeat(48)));
    }
}
