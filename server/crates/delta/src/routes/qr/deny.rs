//! Vortex: recusar um pedido de QR
//! DELETE /auth/qr/:id
use revolt_database::Session;
use revolt_result::Result;
use rocket_empty::EmptyResponse;

use super::store;

/// # Deny QR Login
///
/// Vortex: descarta um pedido de QR — o aparelho que pediu passa a ver "expirou".
#[openapi(tag = "Session")]
#[delete("/<id>")]
pub async fn deny(_session: Session, id: String) -> Result<EmptyResponse> {
    // Recusar um pedido já autorizado não desfaz a autorização de outra pessoa.
    if store::autorizado_por(&id).await?.is_none() {
        store::consumir(&id).await?;
    }

    Ok(EmptyResponse)
}
