use revolt_config::config;
use revolt_database::{
    util::{permissions::perms, reference::Reference},
    voice::{
        delete_voice_state, get_channel_node, get_user_voice_channels, get_voice_channel_members,
        raise_if_in_voice, set_call_notification_recipients, set_channel_node, UserVoiceChannel,
        VoiceClient,
    },
    Database, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::{create_error, Result};

use rocket::{serde::json::Json, State};

/// Teto da chamada HTTP (Twirp) ao LiveKit dentro de `join_call`.
///
/// Vortex: sem ele, um LiveKit travado segurava a requisição até o timeout do
/// proxy, e o cliente via "conectando" indefinidamente em vez de um erro.
const LIVEKIT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

/// # Join Call
///
/// Asks the voice server for a token to join the call.
#[openapi(tag = "Voice")]
#[post("/<target>/join_call", data = "<data>")]
pub async fn call(
    db: &State<Database>,
    voice_client: &State<VoiceClient>,
    user: User,
    target: Reference<'_>,
    data: Json<v0::DataJoinCall>,
) -> Result<Json<v0::CreateVoiceUserResponse>> {
    if !voice_client.is_enabled() {
        return Err(create_error!(LiveKitUnavailable));
    }

    let v0::DataJoinCall {
        node,
        force_disconnect,
        recipients,
    } = data.into_inner();

    if user.bot.is_some() && force_disconnect == Some(true) {
        return Err(create_error!(IsBot));
    }

    let channel = target.as_channel(db).await?;

    let Some(voice_info) = channel.voice() else {
        return Err(create_error!(NotAVoiceChannel));
    };

    let mut permissions = perms(db, &user).channel(&channel);

    let current_permissions = calculate_channel_permissions(&mut permissions).await;
    current_permissions.throw_if_lacking_channel_permission(ChannelPermission::Connect)?;

    let user_voice_channel = UserVoiceChannel::from_channel(&channel);

    // Vortex: as três leituras do Redis são independentes e iam em série —
    // três idas e voltas onde cabe uma. Rodam juntas, e os resultados são
    // conferidos depois NA ORDEM ORIGINAL, para que o erro devolvido continue
    // o mesmo quando mais de uma condição falha (sala cheia antes de nó
    // desconhecido antes de "já está em voz"). `raise_if_in_voice` só é
    // consultado sem `force_disconnect`, como antes.
    let (members, existing_node, in_voice) = futures::join!(
        get_voice_channel_members(&user_voice_channel),
        get_channel_node(channel.id()),
        async {
            if force_disconnect == Some(true) {
                Ok(())
            } else {
                raise_if_in_voice(&user, &user_voice_channel).await
            }
        },
    );

    if members?
        .zip(voice_info.max_users.filter(|&n| n > 0))
        .is_some_and(|(ms, max_users)| ms.len() >= max_users)
        && !current_permissions.has(ChannelPermission::ManageChannel as u64)
    {
        return Err(create_error!(CannotJoinCall));
    }

    let existing_node = existing_node?;
    let has_existing_node = existing_node.is_some(); // we move existing_node in the next statement so this is the quickest way to know if we need to set it.

    // Vortex: a região fixada no canal ganha do nó que o cliente sugeriu. Sala
    // já aberta continua no nó onde está — mover a sala derrubaria quem está
    // dentro —, então a região vale a partir da próxima vez que ela esvaziar.
    let node = existing_node
        .or_else(|| voice_info.rtc_region.clone())
        .or(node)
        .ok_or_else(|| create_error!(UnknownNode))?;

    let config = config().await;

    let node_host = config
        .hosts
        .livekit
        .get(&node)
        .ok_or_else(|| create_error!(UnknownNode))?
        .clone();

    if force_disconnect == Some(true) {
        // Finds and disconnects any existing voice connections by the user,
        // should only ever loop once but just to cover our backs.

        for previous_channel in get_user_voice_channels(&user.id).await? {
            if let Some(node) = get_channel_node(&previous_channel.id).await? {
                // if this errors its just a mismatching state - ignore and proceed to still delete our state
                let _ = voice_client
                    .remove_user(&node, &user.id, &previous_channel.id)
                    .await;
            };

            delete_voice_state(&previous_channel, &user.id).await?;
        }
    } else {
        in_voice?;
    }

    // Vortex: o token (Mongo: limites e perfil do usuário) e a sala (HTTP ao
    // LiveKit) não dependem um do outro. `create_room` continua sendo chamado
    // em toda entrada, mesmo com sala aberta: ele é idempotente no LiveKit,
    // devolve `num_participants` (que decide a notificação de chamada abaixo)
    // e recria a sala com os metadados certos se o LiveKit reiniciou e o
    // `node:` do Redis ficou velho — pular a chamada nesse caso deixaria o
    // auto-create do LiveKit abrir a sala SEM o `server` nos metadados, e o
    // voice-ingress não saberia de que servidor ela é.
    let (token, room) = futures::join!(
        voice_client.create_token(&node, db, &user, current_permissions, &channel),
        async {
            tokio::time::timeout(LIVEKIT_TIMEOUT, voice_client.create_room(&node, &channel))
                .await
                .map_err(|_| {
                    // Mesmo erro que uma falha HTTP do `create_room` já dava.
                    log::warn!("create_room no nó {node} passou de {LIVEKIT_TIMEOUT:?}");
                    create_error!(InternalError)
                })?
        },
    );
    let token = token?;
    let room = room?;

    if !has_existing_node {
        set_channel_node(channel.id(), &node).await?;
    }

    log::debug!("Created room {}", room.name);

    if let Some(recipients) = recipients {
        if room.num_participants == 0 && !recipients.is_empty() {
            set_call_notification_recipients(channel.id(), &user.id, &recipients).await?;
        }
    }

    Ok(Json(v0::CreateVoiceUserResponse {
        token,
        url: node_host.clone(),
    }))
}
