use revolt_database::{
    events::client::EventV1,
    util::{permissions::perms, reference::Reference},
    voice::{is_in_voice_channel, UserVoiceChannel, VoiceClient},
    Database, User,
};
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::State;
use rocket_empty::EmptyResponse;

/// # Play Soundboard Sound
///
/// Toca um efeito sonoro do servidor para a sala de voz (Vortex).
///
/// ⚠ **O servidor não mixa áudio nenhum — ele AUTORIZA e AVISA.** Quem clica
/// já tocou o som localmente; o evento `VoiceSoundboardPlay` chega a cada
/// cliente que está na sala, e cada um toca o arquivo do `autumn` no próprio
/// dispositivo, com o volume do próprio painel multiplicando o de origem.
///
/// Publicar uma faixa no LiveKit foi a alternativa descartada: faixa nova por
/// clique paga renegociação de SDP antes do primeiro byte, e mixar na faixa do
/// microfone passa o som pelo codec e pelo filtro de ruído de VOZ, some quando
/// a pessoa está muda e não deixa quem ouve baixar só os sons.
#[openapi(tag = "Voice")]
#[post("/<target>/soundboard/<sound_id>")]
pub async fn play_sound(
    db: &State<Database>,
    voice_client: &State<VoiceClient>,
    user: User,
    target: Reference<'_>,
    sound_id: String,
) -> Result<EmptyResponse> {
    if !voice_client.is_enabled() {
        return Err(create_error!(LiveKitUnavailable));
    }

    let channel = target.as_channel(db).await?;
    if channel.voice().is_none() {
        return Err(create_error!(NotAVoiceChannel));
    }

    /* Som é de servidor: numa DM não há painel de onde ele viria. */
    let Some(server_id) = channel.server().map(ToString::to_string) else {
        return Err(create_error!(NoEffect));
    };

    let mut query = perms(db, &user).channel(&channel);
    let permissions = calculate_channel_permissions(&mut query).await;
    permissions.throw_if_lacking_channel_permission(ChannelPermission::Speak)?;
    permissions.throw_if_lacking_channel_permission(ChannelPermission::UseSoundboard)?;

    if !is_in_voice_channel(&user.id, &UserVoiceChannel::from_channel(&channel)).await? {
        return Err(create_error!(NotConnected));
    }

    let sound = db.fetch_sound(&sound_id).await?;
    if sound.server != server_id {
        return Err(create_error!(NotFound));
    }

    EventV1::VoiceSoundboardPlay {
        channel_id: channel.id().to_string(),
        user_id: user.id,
        sound: sound.into(),
    }
    .p(channel.id().to_string())
    .await;

    Ok(EmptyResponse)
}
