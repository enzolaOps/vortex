//! Vortex: ver um pedido de QR antes de autorizar
//! GET /auth/qr/:id
use revolt_database::Session;
use revolt_result::{create_error, Result};
use rocket::serde::json::Json;
use serde::Serialize;

use super::store;

/// # Pedido de QR, visto por quem vai autorizar
#[derive(Serialize, JsonSchema)]
pub struct QrLoginRequest {
    /// Nome do aparelho que pediu
    pub name: String,
    /// Código de confirmação — tem de bater com o da outra tela
    pub code: String,
    /// Unix ms em que foi pedido
    pub created_at: i64,
    /// Unix ms em que deixa de valer
    pub expires_at: i64,
}

/// # Fetch QR Login
///
/// Vortex: mostra a quem tem sessão o que ele está prestes a autorizar.
#[openapi(tag = "Session")]
#[get("/<id>")]
pub async fn fetch(_session: Session, id: String) -> Result<Json<QrLoginRequest>> {
    let pedido = store::ler(&id)
        .await?
        .ok_or_else(|| create_error!(NotFound))?;

    // Já autorizado por alguém: não há mais o que ver aqui.
    if store::autorizado_por(&id).await?.is_some() {
        return Err(create_error!(NotFound));
    }

    Ok(Json(QrLoginRequest {
        name: pedido.name,
        code: pedido.code,
        created_at: pedido.created_at,
        expires_at: pedido.created_at + (store::TTL as i64) * 1000,
    }))
}
