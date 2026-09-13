//! Vortex: pedir um código QR
//! POST /auth/qr
use revolt_result::{create_error, Result};
use rocket::serde::json::Json;
use serde::{Deserialize, Serialize};
use validator::Validate;

use super::store::{self, Pedido};

/// # Pedido de QR
#[derive(Validate, Serialize, Deserialize, JsonSchema)]
pub struct DataCreateQrLogin {
    /// Nome do aparelho que está pedindo, mostrado a quem autoriza
    #[validate(length(min = 1, max = 72))]
    pub friendly_name: String,
}

/// # QR criado
#[derive(Serialize, JsonSchema)]
pub struct ResponseCreateQrLogin {
    /// Vai dentro do QR — sozinho, não dá acesso a nada
    pub id: String,
    /// Fica SÓ neste aparelho; é o que troca a autorização por sessão
    pub secret: String,
    /// Código de confirmação, mostrado nas duas telas
    pub code: String,
    /// Unix ms em que o pedido deixa de valer
    pub expires_at: i64,
}

/// # Create QR Login
///
/// Vortex: cria um pedido de entrada por QR, que outro aparelho com sessão autoriza.
#[openapi(tag = "Session")]
#[post("/", data = "<data>")]
pub async fn create(data: Json<DataCreateQrLogin>) -> Result<Json<ResponseCreateQrLogin>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let id = store::novo_id();
    let pedido = Pedido {
        secret: nanoid::nanoid!(48),
        name: data.friendly_name,
        code: store::novo_codigo(),
        created_at: store::agora_ms(),
    };

    store::guardar(&id, &pedido).await?;

    Ok(Json(ResponseCreateQrLogin {
        id,
        secret: pedido.secret,
        code: pedido.code,
        expires_at: pedido.created_at + (store::TTL as i64) * 1000,
    }))
}
