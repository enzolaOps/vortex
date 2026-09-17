use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_server_permissions, ChannelPermission};
use revolt_result::Result;
use rocket::{serde::json::Json, State};

/// # Fetch Join Requests
///
/// Vortex: lista os pedidos de entrada pendentes, com quem os fez.
#[openapi(tag = "Server Members")]
#[get("/<target>/join_requests")]
pub async fn list(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
) -> Result<Json<v0::ServerJoinRequestList>> {
    let server = target.as_server(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).server(&server);
    calculate_server_permissions(&mut query)
        .await
        .throw_if_lacking_channel_permission(ChannelPermission::ManageJoinRequests)?;

    let mut requests = db.fetch_join_requests(&server.id).await?;
    // Mais antigo primeiro: é a ordem de uma fila.
    requests.sort_by_key(|a| a.created_at);

    let ids: Vec<String> = requests.iter().map(|request| request.id.user.clone()).collect();
    let users = User::fetch_many_ids_as_mutuals(db, &user, &ids).await?;

    Ok(Json(v0::ServerJoinRequestList {
        requests: requests.into_iter().map(Into::into).collect(),
        users,
    }))
}
