use std::collections::HashMap;

use iso8601_timestamp::Timestamp;
use revolt_config::config;
use revolt_models::v0;
use revolt_permissions::OverrideField;
use revolt_result::Result;

use crate::{Category, Channel, Database, PartialChannel, PartialRole, PartialServer, Role, Server, User};

/// Mesmo alfabeto dos convites: sem `0/O` e `1/l/I`, que se confundem ao ditar
static ALPHABET: [char; 54] = [
    '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L',
    'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
    'g', 'h', 'i', 'j', 'k', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w',
];

/// Vortex: captura a ESTRUTURA do servidor — canais, categorias, cargos e
/// permissões. Mensagens, membros, convites, ícones e emojis nunca entram: o
/// modelo é compartilhável por link, e dado de pessoa não pode viajar nele.
pub async fn snapshot_server(db: &Database, server: &Server) -> Result<v0::ServerTemplateSnapshot> {
    let mut channels = db.fetch_channels(&server.channels).await?;

    // O banco não garante a ordem do `$in`; a ordem do servidor é a que conta.
    channels.sort_by_key(|channel| {
        server
            .channels
            .iter()
            .position(|id| id == channel.id())
            .unwrap_or(usize::MAX)
    });

    let mut roles: Vec<v0::ServerTemplateRole> = server
        .roles
        .iter()
        .map(|(id, role)| v0::ServerTemplateRole {
            id: id.clone(),
            name: role.name.clone(),
            permissions: role.permissions.clone(),
            colour: role.colour.clone(),
            hoist: role.hoist,
            rank: role.rank,
        })
        .collect();
    roles.sort_by_key(|role| role.rank);

    let channels = channels
        .into_iter()
        .filter_map(|channel| match channel {
            Channel::TextChannel {
                id,
                name,
                description,
                nsfw,
                voice,
                default_permissions,
                role_permissions,
                slowmode,
                forum,
                thread,
                spoiler,
                ..
            } if thread.is_none() => Some(v0::ServerTemplateChannel {
                id,
                name,
                description,
                // Vortex: fórum e galeria são canais de texto com `forum`; sem
                // olhar para ele o modelo os recriava como texto comum.
                channel_type: match (&forum, &voice) {
                    (Some(forum), _) if forum.media => v0::LegacyServerChannelType::Media,
                    (Some(_), _) => v0::LegacyServerChannelType::Forum,
                    (None, Some(_)) => v0::LegacyServerChannelType::Voice,
                    (None, None) => v0::LegacyServerChannelType::Text,
                },
                nsfw,
                voice: voice.map(Into::into),
                default_permissions,
                role_permissions,
                slowmode,
                forum,
                spoiler,
            }),
            _ => None,
        })
        .collect();

    let categories = server
        .categories
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|category| v0::ServerTemplateCategory {
            title: category.title,
            channels: category.channels,
        })
        .collect();

    Ok(v0::ServerTemplateSnapshot {
        name: server.name.clone(),
        description: server.description.clone(),
        default_permissions: server.default_permissions,
        roles,
        channels,
        categories,
    })
}

/// Vortex: gera o modelo de um servidor
pub async fn create_server_template(
    db: &Database,
    server: &Server,
    creator: &User,
    data: v0::DataCreateServerTemplate,
) -> Result<v0::ServerTemplate> {
    if db.fetch_server_template_by_server(&server.id).await.is_ok() {
        return Err(create_error!(InvalidOperation));
    }

    let now = Timestamp::now_utc();
    let template = v0::ServerTemplate {
        code: nanoid::nanoid!(10, &ALPHABET),
        server: server.id.clone(),
        creator: creator.id.clone(),
        name: data.name,
        description: data.description,
        created_at: now,
        updated_at: now,
        uses: 0,
        snapshot: snapshot_server(db, server).await?,
    };

    db.insert_server_template(&template).await?;
    Ok(template)
}

/// Vortex: ACRESCENTA a estrutura do modelo a um servidor
///
/// Nunca remove nada. Os IDs do modelo são só amarras internas: todo cargo,
/// canal e categoria nasce com ID novo, e as exceções de permissão são
/// traduzidas pelo mapa. Exceção para cargo que não veio no modelo é
/// descartada em vez de apontar para um cargo que não existe.
///
/// `replace_default_permissions` só vale para servidor recém-criado: num
/// servidor existente, trocar a permissão padrão mudaria o que todo membro já
/// pode fazer, e aplicar um modelo promete acrescentar.
pub async fn apply_server_template(
    db: &Database,
    server: &mut Server,
    snapshot: &v0::ServerTemplateSnapshot,
    replace_default_permissions: bool,
) -> Result<Vec<Channel>> {
    let config = config().await;

    let mut role_ids: HashMap<String, String> = HashMap::new();
    let mut roles = snapshot.roles.clone();
    roles.sort_by_key(|role| role.rank);

    for template_role in roles {
        if server.roles.len() >= config.features.limits.global.server_roles {
            return Err(create_error!(TooManyRoles {
                max: config.features.limits.global.server_roles,
            }));
        }

        let mut role = Role::create(db, server, template_role.name.clone()).await?;
        role.update(
            db,
            &server.id,
            PartialRole {
                permissions: Some(template_role.permissions.clone()),
                colour: template_role.colour.clone(),
                hoist: Some(template_role.hoist),
                ..Default::default()
            },
            vec![],
        )
        .await?;

        role_ids.insert(template_role.id.clone(), role.id.clone());
        server.roles.insert(role.id.clone(), role);
    }

    let mut channel_ids: HashMap<String, String> = HashMap::new();
    let mut created = vec![];

    for template_channel in &snapshot.channels {
        let mut channel = Channel::create_server_channel(
            db,
            server,
            v0::DataCreateServerChannel {
                channel_type: template_channel.channel_type.clone(),
                name: template_channel.name.clone(),
                description: template_channel.description.clone(),
                nsfw: Some(template_channel.nsfw),
                voice: template_channel.voice.clone(),
            },
            true,
        )
        .await?;

        let role_permissions: HashMap<String, OverrideField> = template_channel
            .role_permissions
            .iter()
            .filter_map(|(id, value)| role_ids.get(id).map(|new| (new.clone(), value.clone())))
            .collect();

        // `create_server_channel` só conhece tipo, nome, descrição, nsfw e voz;
        // o resto do canal vem numa atualização logo depois.
        let partial = PartialChannel {
            default_permissions: template_channel.default_permissions.clone(),
            role_permissions: (!role_permissions.is_empty()).then_some(role_permissions),
            slowmode: template_channel.slowmode,
            forum: template_channel
                .forum
                .clone()
                .filter(|forum| !forum.tags.is_empty()),
            spoiler: template_channel.spoiler.then_some(true),
            ..Default::default()
        };

        if partial.default_permissions.is_some()
            || partial.role_permissions.is_some()
            || partial.slowmode.is_some()
            || partial.forum.is_some()
            || partial.spoiler.is_some()
        {
            channel.update(db, partial, vec![]).await?;
        }

        channel_ids.insert(template_channel.id.clone(), channel.id().to_string());
        created.push(channel);
    }

    let mut partial = PartialServer::default();

    if !snapshot.categories.is_empty() {
        let mut categories = server.categories.clone().unwrap_or_default();
        for template_category in &snapshot.categories {
            categories.push(Category {
                id: ulid::Ulid::new().to_string(),
                title: template_category.title.clone(),
                channels: template_category
                    .channels
                    .iter()
                    .filter_map(|id| channel_ids.get(id).cloned())
                    .collect(),
                // Categoria nova de modelo nasce sem sincronia de permissões.
                default_permissions: None,
                role_permissions: HashMap::new(),
            });
        }
        partial.categories = Some(categories);
    }

    if replace_default_permissions {
        partial.default_permissions = Some(snapshot.default_permissions);
    }

    if partial.categories.is_some() || partial.default_permissions.is_some() {
        server.update(db, partial, vec![]).await?;
    }

    Ok(created)
}
