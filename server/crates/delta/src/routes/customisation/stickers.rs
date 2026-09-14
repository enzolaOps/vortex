//! Figurinhas de servidor (Vortex).
//!
//! ⚠ **O Stoat não tem o conceito.** O desenho segue o do emoji — o id da
//! figurinha É o id do arquivo, e quem administra é `ManageCustomisation` —
//! com uma diferença que decide o resto: figurinha é APAGADA de verdade, e
//! não "desanexada". Uma mensagem com figurinha guarda só o id, e o arquivo
//! continua sendo servido pelo `autumn` depois da exclusão.

use revolt_config::config;
use revolt_database::{util::permissions::DatabasePermissionQuery, Database, File, Metadata, Sticker, User};
use revolt_models::v0;
use revolt_permissions::{calculate_server_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use rocket_empty::EmptyResponse;
use validator::Validate;

/// Exige `ManageCustomisation` no servidor.
async fn exigir_gerencia(db: &Database, user: &User, server_id: &str) -> Result<()> {
    let server = db.fetch_server(server_id).await?;
    let mut query = DatabasePermissionQuery::new(db, user).server(&server);
    calculate_server_permissions(&mut query)
        .await
        .throw_if_lacking_channel_permission(ChannelPermission::ManageCustomisation)
}

/// String vazia apaga; ausência não mexe.
fn campo_opcional(atual: Option<String>, novo: Option<String>) -> Option<String> {
    match novo {
        None => atual,
        Some(v) if v.trim().is_empty() => None,
        Some(v) => Some(v),
    }
}

/// # Create Sticker
///
/// Cria uma figurinha a partir de um arquivo subido para a tag `attachments`.
#[openapi(tag = "Stickers")]
#[put("/sticker/<sticker_id>", data = "<data>")]
pub async fn create_sticker(
    db: &State<Database>,
    user: User,
    sticker_id: String,
    data: Json<v0::DataCreateSticker>,
) -> Result<Json<v0::Sticker>> {
    let config = config().await;

    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    exigir_gerencia(db, &user, &data.server).await?;

    let teto = config.features.limits.global.server_stickers;
    if db.fetch_stickers_by_server(&data.server).await?.len() >= teto {
        return Err(create_error!(TooManyStickers { max: teto }));
    }

    /*
      Conferido ANTES de usar o arquivo: `use_expression` marca o arquivo como
      usado, e uma recusa depois disso o deixaria preso a uma figurinha que
      nunca existiu. A tag é `attachments` (ver `File::use_expression`), que
      aceita qualquer tipo — então tipo e tamanho são checados aqui.
    */
    let arquivo = db.fetch_attachment("attachments", &sticker_id).await?;
    if arquivo.uploader_id.as_deref() != Some(user.id.as_str()) {
        return Err(create_error!(NotFound));
    }
    if !matches!(arquivo.metadata, Metadata::Image { .. }) {
        return Err(create_error!(FileTypeNotAllowed));
    }
    let tamanho = config.features.limits.global.sticker_size;
    if arquivo.size < 0 || arquivo.size as usize > tamanho {
        return Err(create_error!(FileTooLarge { max: tamanho }));
    }

    let arquivo = File::use_expression(db, &sticker_id, &sticker_id, &user.id).await?;

    let sticker = Sticker {
        id: sticker_id,
        server: data.server,
        creator_id: user.id,
        name: data.name,
        description: campo_opcional(None, data.description),
        emoji: campo_opcional(None, data.emoji),
        content_type: arquivo.content_type,
        filename: arquivo.filename,
    };

    sticker.create(db).await?;
    Ok(Json(sticker.into()))
}

/// # Fetch Sticker
///
/// Busca uma figurinha pelo id — é o que a linha de uma mensagem usa para dar
/// nome a uma figurinha de servidor que o cliente ainda não carregou.
#[openapi(tag = "Stickers")]
#[get("/sticker/<sticker_id>")]
pub async fn fetch_sticker(db: &State<Database>, sticker_id: String) -> Result<Json<v0::Sticker>> {
    db.fetch_sticker(&sticker_id)
        .await
        .map(|sticker| Json(sticker.into()))
}

/// # Edit Sticker
///
/// Renomeia, troca a descrição ou o emoji relacionado.
#[openapi(tag = "Stickers")]
#[patch("/sticker/<sticker_id>", data = "<data>")]
pub async fn edit_sticker(
    db: &State<Database>,
    user: User,
    sticker_id: String,
    data: Json<v0::DataEditSticker>,
) -> Result<Json<v0::Sticker>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let mut sticker = db.fetch_sticker(&sticker_id).await?;
    exigir_gerencia(db, &user, &sticker.server).await?;

    if let Some(name) = data.name {
        sticker.name = name;
    }
    sticker.description = campo_opcional(sticker.description.take(), data.description);
    sticker.emoji = campo_opcional(sticker.emoji.take(), data.emoji);

    sticker.update(db).await?;
    Ok(Json(sticker.into()))
}

/// # Delete Sticker
///
/// Quem enviou pode apagar a própria; os outros precisam de `ManageCustomisation`.
#[openapi(tag = "Stickers")]
#[delete("/sticker/<sticker_id>")]
pub async fn delete_sticker(
    db: &State<Database>,
    user: User,
    sticker_id: String,
) -> Result<EmptyResponse> {
    let sticker = db.fetch_sticker(&sticker_id).await?;
    if sticker.creator_id != user.id {
        exigir_gerencia(db, &user, &sticker.server).await?;
    }

    sticker.delete(db).await?;
    Ok(EmptyResponse)
}
