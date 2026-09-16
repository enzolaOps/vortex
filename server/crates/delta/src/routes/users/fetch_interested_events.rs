use std::collections::HashSet;

use revolt_database::{Database, User};
use revolt_models::v0;
use revolt_result::Result;
use rocket::{serde::json::Json, State};

/// # Fetch Interested Events
///
/// Fetch every scheduled server event you marked interest in (Vortex).
///
/// Existe para o lembrete de "10 minutos antes": sem ela o cliente teria de
/// pedir os eventos de cada servidor na abertura, uma chamada por servidor.
#[openapi(tag = "Server Events")]
#[get("/@me/events")]
pub async fn fetch_interested_events(
    db: &State<Database>,
    user: User,
) -> Result<Json<Vec<v0::ServerEvent>>> {
    // Só dos servidores onde a pessoa ainda está: sair do servidor não apaga o
    // interesse gravado, e um lembrete de um lugar que ela deixou seria ruído.
    let servers: HashSet<String> = db
        .fetch_all_memberships(&user.id)
        .await?
        .into_iter()
        .map(|member| member.id.server)
        .collect();

    db.fetch_server_events_for_user(&user.id)
        .await
        .map(|events| {
            events
                .into_iter()
                .filter(|event| servers.contains(&event.server))
                .map(Into::into)
                .collect()
        })
        .map(Json)
}
