use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, User,
};
use revolt_permissions::{calculate_server_permissions, ChannelPermission};
use revolt_result::Result;
use rocket::State;
use rocket_empty::EmptyResponse;

/// # Reject Join Request
///
/// Vortex: recusa um pedido de entrada. Quem pediu também pode cancelar o
/// próprio pedido, sem permissão nenhuma.
#[openapi(tag = "Server Members")]
#[delete("/<server>/join_requests/<target>")]
pub async fn reject(
    db: &State<Database>,
    user: User,
    server: Reference<'_>,
    target: Reference<'_>,
) -> Result<EmptyResponse> {
    let server = server.as_server(db).await?;

    if target.id != user.id {
        let mut query = DatabasePermissionQuery::new(db, &user).server(&server);
        calculate_server_permissions(&mut query)
            .await
            .throw_if_lacking_channel_permission(ChannelPermission::ManageJoinRequests)?;
    }

    db.fetch_join_request(&server.id, target.id)
        .await?
        .delete(db)
        .await?;

    Ok(EmptyResponse)
}
