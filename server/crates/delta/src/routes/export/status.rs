//! Vortex: estado da exportação
//! GET /auth/export/status
use revolt_database::Session;
use revolt_result::{create_error, Result};
use rocket::serde::json::Json;

use super::store::{self, DataExport};

/// # Fetch Data Export
///
/// Vortex: o estado do último pedido de exportação desta conta.
#[openapi(tag = "Account")]
#[get("/status")]
pub async fn status(session: Session) -> Result<Json<DataExport>> {
    store::ler(&session.user_id)
        .await?
        .map(Json)
        .ok_or_else(|| create_error!(NotFound))
}
