//! Efeitos sonoros do painel de sons (Vortex).
//!
//! Mesmo desenho das figurinhas: o id do som É o id do arquivo de áudio, e
//! quem administra é `ManageCustomisation`. TOCAR é outra rota
//! (`POST /channels/<id>/soundboard/<sound_id>`), com outra permissão.

use revolt_config::config;
use revolt_database::{
    util::permissions::DatabasePermissionQuery, Database, File, Metadata, SoundboardSound, User,
};
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

/// Volume é porcentagem; acima de 100 é recusado em vez de cortado.
fn volume_valido(volume: u8) -> Result<u8> {
    if volume > 100 {
        Err(create_error!(FailedValidation {
            error: "volume: deve estar entre 0 e 100".to_string()
        }))
    } else {
        Ok(volume)
    }
}

/// Áudio pelo metadata OU pelo tipo: o detector do `autumn` classifica alguns
/// OGG como arquivo genérico, e o `content_type` ainda diz a verdade.
fn eh_audio(arquivo: &File) -> bool {
    matches!(arquivo.metadata, Metadata::Audio) || arquivo.content_type.starts_with("audio/")
}

/// # Create Soundboard Sound
///
/// Cria um efeito sonoro a partir de um arquivo de áudio subido para a tag
/// `attachments`.
///
/// ⚠ A DURAÇÃO (até 5 s) é conferida no cliente, que decodifica o áudio antes
/// de subir. O servidor não tem como medi-la sem um decodificador, e o teto de
/// tamanho é o que ele garante.
#[openapi(tag = "Soundboard")]
#[put("/sound/<sound_id>", data = "<data>")]
pub async fn create_sound(
    db: &State<Database>,
    user: User,
    sound_id: String,
    data: Json<v0::DataCreateSoundboardSound>,
) -> Result<Json<v0::SoundboardSound>> {
    let config = config().await;

    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;
    let volume = volume_valido(data.volume.unwrap_or(100))?;

    exigir_gerencia(db, &user, &data.server).await?;

    let teto = config.features.limits.global.server_sounds;
    if db.fetch_sounds_by_server(&data.server).await?.len() >= teto {
        return Err(create_error!(TooManySounds { max: teto }));
    }

    /* Conferido ANTES de usar o arquivo — ver `create_sticker`. */
    let arquivo = db.fetch_attachment("attachments", &sound_id).await?;
    if arquivo.uploader_id.as_deref() != Some(user.id.as_str()) {
        return Err(create_error!(NotFound));
    }
    if !eh_audio(&arquivo) {
        return Err(create_error!(FileTypeNotAllowed));
    }
    let tamanho = config.features.limits.global.sound_size;
    if arquivo.size < 0 || arquivo.size as usize > tamanho {
        return Err(create_error!(FileTooLarge { max: tamanho }));
    }

    File::use_expression(db, &sound_id, &sound_id, &user.id).await?;

    let sound = SoundboardSound {
        id: sound_id,
        server: data.server,
        creator_id: user.id,
        name: data.name,
        emoji: data.emoji.filter(|e| !e.trim().is_empty()),
        volume,
    };

    sound.create(db).await?;
    Ok(Json(sound.into()))
}

/// # Edit Soundboard Sound
///
/// Renomeia, troca o emoji ou o volume de origem.
#[openapi(tag = "Soundboard")]
#[patch("/sound/<sound_id>", data = "<data>")]
pub async fn edit_sound(
    db: &State<Database>,
    user: User,
    sound_id: String,
    data: Json<v0::DataEditSoundboardSound>,
) -> Result<Json<v0::SoundboardSound>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let mut sound = db.fetch_sound(&sound_id).await?;
    exigir_gerencia(db, &user, &sound.server).await?;

    if let Some(name) = data.name {
        sound.name = name;
    }
    if let Some(emoji) = data.emoji {
        sound.emoji = if emoji.trim().is_empty() {
            None
        } else {
            Some(emoji)
        };
    }
    if let Some(volume) = data.volume {
        sound.volume = volume_valido(volume)?;
    }

    sound.update(db).await?;
    Ok(Json(sound.into()))
}

/// # Delete Soundboard Sound
///
/// Quem enviou pode apagar o próprio; os outros precisam de `ManageCustomisation`.
#[openapi(tag = "Soundboard")]
#[delete("/sound/<sound_id>")]
pub async fn delete_sound(
    db: &State<Database>,
    user: User,
    sound_id: String,
) -> Result<EmptyResponse> {
    let sound = db.fetch_sound(&sound_id).await?;
    if sound.creator_id != user.id {
        exigir_gerencia(db, &user, &sound.server).await?;
    }

    sound.delete(db).await?;
    Ok(EmptyResponse)
}
