//! Vortex: autorizar um pedido de QR
//! POST /auth/qr/:id/approve
use revolt_database::{Database, Session};
use revolt_result::{create_error, Result};
use rocket::State;
use rocket_empty::EmptyResponse;

use super::store;

/// # Approve QR Login
///
/// Vortex: entrega a um aparelho sem sessão uma sessão nova desta conta.
#[openapi(tag = "Session")]
#[post("/<id>/approve")]
pub async fn approve(db: &State<Database>, session: Session, id: String) -> Result<EmptyResponse> {
    if store::ler(&id).await?.is_none() {
        return Err(create_error!(NotFound));
    }

    let account = db.fetch_account(&session.user_id).await?;
    if account.disabled {
        return Err(create_error!(InvalidOperation));
    }

    // Primeiro a autorizar ganha; uma segunda conta não sobrescreve.
    if !store::autorizar(&id, &account.id).await? {
        return Err(create_error!(InvalidOperation));
    }

    Ok(EmptyResponse)
}
