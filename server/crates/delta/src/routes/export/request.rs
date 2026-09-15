//! Vortex: pedir a exportação dos dados da conta
//! POST /auth/export/request
use revolt_database::{Database, Session};
use revolt_result::Result;
use rocket::serde::json::Json;
use rocket::State;

use super::store::{self, DataExport, ExportState};
use super::worker;

/// # Request Data Export
///
/// Vortex: enfileira uma cópia dos dados desta conta. Um pedido por conta a
/// cada 24 h; repetir devolve o estado atual em vez de enfileirar outro.
#[openapi(tag = "Account")]
#[post("/request")]
pub async fn request(db: &State<Database>, session: Session) -> Result<Json<DataExport>> {
    store::limpar_expirados().await;

    let agora = store::agora_ms();
    if let Some(atual) = store::ler(&session.user_id).await? {
        // Falha libera um novo pedido na hora: a pessoa não esperou 24 h por nada.
        let em_curso = matches!(atual.state, ExportState::Queued | ExportState::Running);
        if em_curso || (atual.state != ExportState::Failed && agora < atual.next_request_at) {
            return Ok(Json(atual));
        }
    }

    let token = nanoid::nanoid!(48);
    let estado = DataExport {
        state: ExportState::Queued,
        requested_at: agora,
        finished_at: None,
        expires_at: None,
        size: None,
        messages: 0,
        next_request_at: agora + store::INTERVALO_MS,
        download: None,
        emailed: false,
    };

    store::guardar(&session.user_id, &estado).await?;
    worker::enfileirar(db.inner().clone(), session.user_id, token);

    Ok(Json(estado))
}
