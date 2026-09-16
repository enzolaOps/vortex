use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, User,
};
use revolt_models::v0;
use revolt_permissions::PermissionQuery;
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};

/// # Fetch Tag Members
///
/// Ids of the members who display this server's tag.
///
/// Vortex: `Member.show_tag` travels in member objects, but a client that
/// hydrates members through an SDK unaware of the field cannot see it. This
/// route answers the one question the tag needs, with ids only.
#[openapi(tag = "Server Members")]
#[get("/<target>/tag")]
pub async fn fetch_tag_members(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
) -> Result<Json<v0::ServerTagMembers>> {
    let server = target.as_server(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).server(&server);
    if !query.are_we_a_member().await {
        return Err(create_error!(NotFound));
    }

    // Sem tag, ninguém a exibe — e a varredura de membros não precisa rodar.
    let members = if server.tag.is_some() {
        db.fetch_all_members(&server.id)
            .await?
            .into_iter()
            .filter(|member| member.show_tag)
            .map(|member| member.id.user)
            .collect()
    } else {
        vec![]
    };

    Ok(Json(v0::ServerTagMembers { members }))
}
