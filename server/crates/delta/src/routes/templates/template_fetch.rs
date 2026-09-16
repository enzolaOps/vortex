use revolt_database::{Database, User};
use revolt_models::v0;
use revolt_result::Result;
use rocket::{serde::json::Json, State};

/// # Fetch Template
///
/// Vortex: pré-visualiza um modelo pelo código do link. O modelo só carrega
/// estrutura — nada de pessoa —, então qualquer conta pode vê-lo.
#[openapi(tag = "Server Information")]
#[get("/<code>")]
pub async fn fetch(
    db: &State<Database>,
    _user: User,
    code: &str,
) -> Result<Json<v0::ServerTemplate>> {
    Ok(Json(db.fetch_server_template(code).await?))
}
