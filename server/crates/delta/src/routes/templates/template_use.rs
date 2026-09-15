use revolt_config::config;
use revolt_database::{apply_server_template, Database, Member, Server, User};
use revolt_models::v0;
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use validator::Validate;

/// # Create Server From Template
///
/// Vortex: cria um servidor novo com a estrutura do modelo. As mesmas
/// restrições de `POST /servers/create` valem aqui — um modelo não pode ser a
/// porta dos fundos da criação de servidor.
#[openapi(tag = "Server Information")]
#[post("/<code>", data = "<data>")]
pub async fn use_template(
    db: &State<Database>,
    user: User,
    code: &str,
    data: Json<v0::DataUseServerTemplate>,
) -> Result<Json<v0::CreateServerLegacyResponse>> {
    if user.bot.is_some() {
        return Err(create_error!(IsBot));
    }

    let config = config().await;
    let restrict = &config.features.limits.global.restrict_server_creation;
    if !restrict.is_empty() && !restrict.contains(&user.id) {
        return Err(create_error!(CantCreateServers));
    }

    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let mut template = db.fetch_server_template(code).await?;
    user.can_acquire_server(db).await?;

    let (mut server, _) = Server::create(
        db,
        v0::DataCreateServer {
            name: data.name,
            description: template.snapshot.description.clone(),
            nsfw: None,
        },
        &user,
        false,
    )
    .await?;

    let channels = apply_server_template(db, &mut server, &template.snapshot, true).await?;
    let (_, channels) = Member::create(db, &server, &user, Some(channels)).await?;

    // Contagem de uso é informativa: falhar ao gravá-la não desfaz o servidor.
    template.uses += 1;
    let _ = db.save_server_template(&template).await;

    Ok(Json(v0::CreateServerLegacyResponse {
        server: server.into(db).await,
        channels: channels.into_iter().map(|channel| channel.into()).collect(),
    }))
}
