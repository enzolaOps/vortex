//! O pedido de QR no Redis — a única coisa que as cinco rotas compartilham.
use std::time::{SystemTime, UNIX_EPOCH};

use redis_kiss::{
    get_connection,
    redis::{ExistenceCheck, SetExpiry, SetOptions},
    AsyncCommands,
};
use revolt_result::{create_error, Result, ToRevoltError};
use serde::{Deserialize, Serialize};

/// Vida do pedido, em segundos.
///
/// Dois minutos: o bastante para pegar o celular, abrir o app e apontar; curto
/// o bastante para um QR esquecido numa tela compartilhada deixar de valer.
pub const TTL: usize = 120;

const DIGITOS: [char; 10] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/// O que o Redis guarda por pedido.
#[derive(Serialize, Deserialize, Clone)]
pub struct Pedido {
    /// Só o aparelho que pediu conhece — é o que a troca exige.
    pub secret: String,
    /// Nome do aparelho que pediu, mostrado a quem autoriza.
    pub name: String,
    /// Código de confirmação, mostrado nas duas telas.
    pub code: String,
    /// Unix ms.
    pub created_at: i64,
}

fn chave(id: &str) -> String {
    format!("vortex:qr:{id}")
}

fn chave_da_autorizacao(id: &str) -> String {
    format!("vortex:qr:{id}:autorizado")
}

pub fn agora_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}

pub fn novo_id() -> String {
    nanoid::nanoid!(32)
}

pub fn novo_codigo() -> String {
    nanoid::nanoid!(6, &DIGITOS)
}

/// Comparação em tempo constante — o segredo não pode vazar por cronometragem.
pub fn iguais(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

pub async fn guardar(id: &str, pedido: &Pedido) -> Result<()> {
    let texto = serde_json::to_string(pedido).to_internal_error()?;
    let mut conn = get_connection()
        .await
        .map_err(|_| create_error!(InternalError))?;
    conn.set_ex::<_, _, ()>(chave(id), texto, TTL)
        .await
        .to_internal_error()
}

pub async fn ler(id: &str) -> Result<Option<Pedido>> {
    let mut conn = get_connection()
        .await
        .map_err(|_| create_error!(InternalError))?;
    let texto: Option<String> = conn.get(chave(id)).await.to_internal_error()?;
    Ok(texto.and_then(|t| serde_json::from_str(&t).ok()))
}

/// Marca a autorização. Devolve `false` se outra conta chegou antes.
pub async fn autorizar(id: &str, account_id: &str) -> Result<bool> {
    let mut conn = get_connection()
        .await
        .map_err(|_| create_error!(InternalError))?;

    // A autorização morre junto com o pedido, nunca depois dele.
    let restante: i64 = conn.ttl(chave(id)).await.to_internal_error()?;
    if restante <= 0 {
        return Ok(false);
    }

    let ok: Option<String> = conn
        .set_options(
            chave_da_autorizacao(id),
            account_id,
            SetOptions::default()
                .conditional_set(ExistenceCheck::NX)
                .with_expiration(SetExpiry::EX(restante as usize)),
        )
        .await
        .to_internal_error()?;

    Ok(ok.is_some())
}

pub async fn autorizado_por(id: &str) -> Result<Option<String>> {
    let mut conn = get_connection()
        .await
        .map_err(|_| create_error!(InternalError))?;
    conn.get(chave_da_autorizacao(id)).await.to_internal_error()
}

/// Consome o pedido. Devolve `true` só para quem apagou primeiro.
pub async fn consumir(id: &str) -> Result<bool> {
    let mut conn = get_connection()
        .await
        .map_err(|_| create_error!(InternalError))?;
    let apagados: i64 = conn.del(chave(id)).await.to_internal_error()?;
    let _: i64 = conn
        .del(chave_da_autorizacao(id))
        .await
        .to_internal_error()?;
    Ok(apagados == 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn comparacao_de_segredo() {
        assert!(iguais("abc", "abc"));
        assert!(!iguais("abc", "abd"));
        assert!(!iguais("abc", "abcd"));
    }

    #[test]
    fn codigo_tem_seis_digitos() {
        let c = novo_codigo();
        assert_eq!(c.len(), 6);
        assert!(c.chars().all(|x| x.is_ascii_digit()));
    }
}
