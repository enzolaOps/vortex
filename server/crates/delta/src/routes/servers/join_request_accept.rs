use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, Member, User,
};
use revolt_permissions::{calculate_server_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::State;
use rocket_empty::EmptyResponse;

/// # Accept Join Request
///
/// Vortex: aprova um pedido de entrada — a pessoa vira membro na hora.
#[openapi(tag = "Server Members")]
#[put("/<server>/join_requests/<target>")]
pub async fn accept(
    db: &State<Database>,
    user: User,
    server: Reference<'_>,
    target: Reference<'_>,
) -> Result<EmptyResponse> {
    let server = server.as_server(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).server(&server);
    calculate_server_permissions(&mut query)
        .await
        .throw_if_lacking_channel_permission(ChannelPermission::ManageJoinRequests)?;

    // Congelar entradas vale para a fila também: aprovar durante a emergência
    // seria a porta dos fundos da própria emergência.
    if server
        .security
        .as_ref()
        .and_then(|security| security.active_emergency())
        .is_some_and(|emergency| emergency.freeze_joins)
    {
        return Err(create_error!(JoinBlocked {
            reason: "JoinsFrozen".to_string()
        }));
    }

    let request = db.fetch_join_request(&server.id, target.id).await?;
    let requester = target.as_user(db).await?;

    // O pedido sai antes da entrada: se entrar falhar (banido no meio tempo,
    // limite de servidores), o pedido não fica preso na fila para sempre.
    request.delete(db).await?;
    requester.can_acquire_server(db).await?;
    Member::create(db, &server, &requester, None).await?;

    Ok(EmptyResponse)
}
