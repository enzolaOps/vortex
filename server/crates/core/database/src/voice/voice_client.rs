use crate::{
    models::{Channel, User},
    voice::RoomMetadata,
    Database,
};
use livekit_api::{
    access_token::{AccessToken, VideoGrants},
    services::room::{CreateRoomOptions, RoomClient as InnerRoomClient, UpdateParticipantOptions},
};
use livekit_protocol::{ParticipantInfo, ParticipantPermission, Room};
use revolt_config::{config, LiveKitNode};
use revolt_permissions::{ChannelPermission, PermissionValue};
use revolt_result::{create_error, Result, ToRevoltError};
use std::{collections::HashMap, time::Duration};

use super::get_allowed_sources;

#[derive(Debug)]
pub struct RoomClient {
    pub client: InnerRoomClient,
    pub node: LiveKitNode,
}

#[derive(Debug)]
pub struct VoiceClient {
    pub rooms: HashMap<String, RoomClient>,
}

impl VoiceClient {
    pub fn new(nodes: HashMap<String, LiveKitNode>) -> Self {
        Self {
            rooms: nodes
                .into_iter()
                .map(|(name, node)| {
                    (
                        name,
                        RoomClient {
                            client: InnerRoomClient::with_api_key(
                                &node.url,
                                &node.key,
                                &node.secret,
                            ),
                            node,
                        },
                    )
                })
                .collect(),
        }
    }

    pub fn is_enabled(&self) -> bool {
        !self.rooms.is_empty()
    }

    pub async fn from_revolt_config() -> Self {
        let config = config().await;

        Self::new(config.api.livekit.nodes.clone())
    }

    pub fn get_node(&self, name: &str) -> Result<&RoomClient> {
        self.rooms
            .get(name)
            .ok_or_else(|| create_error!(UnknownNode))
    }

    pub async fn create_token(
        &self,
        node: &str,
        db: &Database,
        user: &User,
        permissions: PermissionValue,
        channel: &Channel,
    ) -> Result<String> {
        let room = self.get_node(node)?;

        let limits = user.limits().await;
        let allowed_sources = get_allowed_sources(&limits, permissions);

        AccessToken::with_api_key(&room.node.key, &room.node.secret)
            .with_name(&format!("{}#{}", user.username, user.discriminator))
            .with_identity(&user.id)
            .with_metadata(
                &serde_json::to_string(&user.clone().into(db, None).await).to_internal_error()?,
            )
            .with_ttl(Duration::from_secs(10))
            .with_grants(video_grants(
                channel.id(),
                allowed_sources,
                permissions.has_channel_permission(ChannelPermission::Listen),
            ))
            .to_jwt()
            .to_internal_error()
    }

    pub async fn create_room(&self, node: &str, channel: &Channel) -> Result<Room> {
        let room = self.get_node(node)?;

        let metadata = RoomMetadata {
            server: channel.server().map(|id| id.to_string()),
        };

        room.client
            .create_room(
                channel.id(),
                CreateRoomOptions {
                    empty_timeout: 5 * 60, // 5 minutes,
                    metadata: serde_json::to_string(&metadata).to_internal_error()?,
                    ..Default::default()
                },
            )
            .await
            .to_internal_error()
    }

    pub async fn update_permissions(
        &self,
        node: &str,
        user: &User,
        channel_id: &str,
        new_permissions: ParticipantPermission,
    ) -> Result<ParticipantInfo> {
        let room = self.get_node(node)?;

        room.client
            .update_participant(
                channel_id,
                &user.id,
                UpdateParticipantOptions {
                    permission: Some(new_permissions),
                    ..Default::default()
                },
            )
            .await
            .to_internal_error()
    }

    pub async fn remove_user(&self, node: &str, user_id: &str, channel_id: &str) -> Result<()> {
        let room = self.get_node(node)?;

        room.client
            .remove_participant(channel_id, user_id)
            .await
            .to_internal_error()
    }

    pub async fn delete_room(&self, node: &str, channel_id: &str) -> Result<()> {
        let room = self.get_node(node)?;

        room.client
            .delete_room(channel_id)
            .await
            .to_internal_error()
    }

    pub async fn get_room_participants(
        &self,
        node: &str,
        channel_id: &str,
    ) -> Result<Vec<ParticipantInfo>> {
        let room = self.get_node(node)?;

        room.client
            .list_participants(channel_id)
            .await
            .to_internal_error()
    }
}

/// Os grants do token de voz.
///
/// Vortex: `can_update_own_metadata` é concedido para que cada cliente
/// anuncie, num ATRIBUTO de participante, qual transmissão está assistindo e
/// em que qualidade — é o único caminho até a contagem e a lista de
/// espectadores. O LiveKit não entrega a quem publica quem assina a faixa, e
/// webhook não serve: não existe evento de assinatura entre os webhooks do
/// servidor (só `track_published`/`track_unpublished`).
///
/// O grant também deixa o participante reescrever o próprio `name` e
/// `metadata` no LiveKit. Nenhum consumidor deste fork confia neles — o
/// `voice-ingress` usa só `identity`, que vem do token e o grant não altera, e
/// os clientes resolvem a pessoa pelo `identity`. Atributo é dado escrito pelo
/// próprio cliente: serve para EXIBIÇÃO, nunca para autorização.
pub(crate) fn video_grants(
    room: &str,
    allowed_sources: Vec<&'static str>,
    can_subscribe: bool,
) -> VideoGrants {
    VideoGrants {
        room_join: true,
        can_publish: true,
        can_publish_data: false,
        can_update_own_metadata: true,
        can_publish_sources: allowed_sources
            .into_iter()
            .map(ToString::to_string)
            .collect(),
        can_subscribe,
        room: room.to_string(),
        ..Default::default()
    }
}

#[cfg(test)]
mod tests {
    use super::video_grants;

    #[test]
    fn token_permite_anunciar_o_que_assiste() {
        let grants = video_grants("canal", vec!["microphone"], true);
        assert!(grants.can_update_own_metadata);
    }

    #[test]
    fn grant_novo_nao_amplia_o_resto() {
        let grants = video_grants("canal", vec!["microphone"], false);
        assert!(grants.room_join);
        assert!(grants.can_publish);
        assert!(!grants.can_publish_data);
        assert!(!grants.can_subscribe);
        assert!(!grants.room_admin);
        assert!(!grants.room_create);
        assert!(!grants.room_list);
        assert!(!grants.room_record);
        assert!(!grants.hidden);
        assert!(!grants.recorder);
        assert_eq!(grants.room, "canal");
        assert_eq!(grants.can_publish_sources, vec!["microphone".to_string()]);
    }
}
