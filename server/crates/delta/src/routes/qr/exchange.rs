//! Vortex: trocar um pedido de QR autorizado por sessão
//! POST /auth/qr/:id/exchange
use revolt_database::Database;
use revolt_models::v0;
use revolt_result::{create_error, Result};
use rocket::serde::json::Json;
use rocket::State;
use serde::{Deserialize, Serialize};

use super::store;

/// # Troca de QR
#[derive(Serialize, Deserialize, JsonSchema)]
pub struct DataExchangeQrLogin {
    /// O segredo devolvido ao criar o pedido
    pub secret: String,
}

/// # Resultado da troca
///
/// `Success` e `Disabled` têm a forma exata de `ResponseLogin`, para o cliente
/// concluir a entrada pelo mesmo caminho do login por senha.
#[derive(Serialize, JsonSchema)]
#[serde(tag = "result")]
pub enum ResponseExchangeQrLogin {
    /// Ainda ninguém autorizou — pergunte de novo
    Pending,
    Success(v0::Session),
    Disabled { user_id: String },
}

/// # Exchange QR Login
///
/// Vortex: o aparelho que pediu pergunta se já foi autorizado.
#[openapi(tag = "Session")]
#[post("/<id>/exchange", data = "<data>")]
pub async fn exchange(
    db: &State<Database>,
    id: String,
    data: Json<DataExchangeQrLogin>,
) -> Result<Json<ResponseExchangeQrLogin>> {
    let pedido = store::ler(&id)
        .await?
        .ok_or_else(|| create_error!(NotFound))?;

    if !store::iguais(&pedido.secret, &data.secret) {
        // NotFound e não InvalidCredentials: sem o segredo, o pedido não existe.
        return Err(create_error!(NotFound));
    }

    let account_id = match store::autorizado_por(&id).await? {
        Some(account_id) => account_id,
        None => return Ok(Json(ResponseExchangeQrLogin::Pending)),
    };

    // Uso único: só quem apagou o pedido primeiro recebe a sessão.
    if !store::consumir(&id).await? {
        return Err(create_error!(NotFound));
    }

    let account = db.fetch_account(&account_id).await?;
    if account.disabled {
        return Ok(Json(ResponseExchangeQrLogin::Disabled {
            user_id: account.id,
        }));
    }

    let session = account.create_session(db, pedido.name).await?;
    Ok(Json(ResponseExchangeQrLogin::Success(session.into())))
}
