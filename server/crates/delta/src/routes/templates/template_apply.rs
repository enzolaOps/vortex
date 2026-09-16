use revolt_database::{apply_server_template, util::reference::Reference, Database, User};
use revolt_models::v0;
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};

/// # Apply Template
///
/// Vortex: ACRESCENTA a estrutura do modelo a um servidor existente — nunca
/// remove nada, e a permissão padrão do servidor não muda.
///
/// Só o DONO aplica. Um modelo cria cargos com as permissões que traz, e a
/// regra de hierarquia de `roles_edit` (não conceder o que você não tem) não
/// cabe numa aplicação em lote; o dono é o único para quem ela nunca barraria
/// nada.
#[openapi(tag = "Server Information")]
#[post("/<code>/apply/<target>")]
pub async fn apply(
    db: &State<Database>,
    user: User,
    code: &str,
    target: Reference<'_>,
) -> Result<Json<v0::Server>> {
    let mut server = target.as_server(db).await?;
    if server.owner != user.id {
        return Err(create_error!(NotOwner));
    }

    let mut template = db.fetch_server_template(code).await?;
    apply_server_template(db, &mut server, &template.snapshot, false).await?;

    template.uses += 1;
    let _ = db.save_server_template(&template).await;

    Ok(Json(server.into(db).await))
}
