use iso8601_timestamp::Timestamp;
use revolt_database::{
    create_server_template, snapshot_server,
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, Server, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_server_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use rocket_empty::EmptyResponse;
use validator::Validate;

/// Vortex: o modelo é estrutura de administração — quem não gerencia o
/// servidor não o gera, não o vê e não o apaga.
async fn managed_server(db: &Database, user: &User, target: Reference<'_>) -> Result<Server> {
    let server = target.as_server(db).await?;
    let mut query = DatabasePermissionQuery::new(db, user).server(&server);
    calculate_server_permissions(&mut query)
        .await
        .throw_if_lacking_channel_permission(ChannelPermission::ManageServer)?;
    Ok(server)
}

/// # Fetch Server Template
///
/// Vortex: o modelo gerado a partir deste servidor, com o estado de
/// sincronização.
#[openapi(tag = "Server Information")]
#[get("/<target>/template")]
pub async fn fetch(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
) -> Result<Json<v0::OwnServerTemplate>> {
    let server = managed_server(db, &user, target).await?;
    let template = db.fetch_server_template_by_server(&server.id).await?;
    let current = snapshot_server(db, &server).await?;

    Ok(Json(v0::OwnServerTemplate {
        is_dirty: current != template.snapshot,
        template,
    }))
}

/// # Create Server Template
///
/// Vortex: gera o modelo do servidor. Um servidor tem no máximo um modelo.
#[openapi(tag = "Server Information")]
#[post("/<target>/template", data = "<data>")]
pub async fn create(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    data: Json<v0::DataCreateServerTemplate>,
) -> Result<Json<v0::OwnServerTemplate>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let server = managed_server(db, &user, target).await?;
    let template = create_server_template(db, &server, &user, data).await?;

    Ok(Json(v0::OwnServerTemplate {
        template,
        is_dirty: false,
    }))
}

/// # Sync Server Template
///
/// Vortex: recaptura a estrutura atual do servidor no modelo existente.
#[openapi(tag = "Server Information")]
#[put("/<target>/template")]
pub async fn sync(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
) -> Result<Json<v0::OwnServerTemplate>> {
    let server = managed_server(db, &user, target).await?;
    let mut template = db.fetch_server_template_by_server(&server.id).await?;
    template.snapshot = snapshot_server(db, &server).await?;
    template.updated_at = Timestamp::now_utc();
    db.save_server_template(&template).await?;

    Ok(Json(v0::OwnServerTemplate {
        template,
        is_dirty: false,
    }))
}

/// # Delete Server Template
///
/// Vortex: apaga o modelo. O link deixa de funcionar; servidores criados a
/// partir dele não mudam.
#[openapi(tag = "Server Information")]
#[delete("/<target>/template")]
pub async fn delete(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
) -> Result<EmptyResponse> {
    let server = managed_server(db, &user, target).await?;
    let template = db.fetch_server_template_by_server(&server.id).await?;
    db.delete_server_template(&template.code).await?;
    Ok(EmptyResponse)
}
