use iso8601_timestamp::Timestamp;
use revolt_result::{create_error, Result};

use crate::{Channel, Database, User};

static ALPHABET: [char; 54] = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J',
    'K', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
    'g', 'h', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z',
];

auto_derived!(
    /// Invite
    #[serde(tag = "type")]
    pub enum Invite {
        /// Invite to a specific server channel
        Server {
            /// Invite code
            #[serde(rename = "_id")]
            code: String,
            /// Id of the server this invite points to
            server: String,
            /// Id of user who created this invite
            creator: String,
            /// Id of the server channel this invite points to
            channel: String,
            /// Roles given to whoever joins the server through this invite
            #[serde(skip_serializing_if = "Vec::is_empty", default)]
            roles: Vec<String>,
            /// Vortex: how many people joined through this invite
            ///
            /// Counted on join, atomically against `max_uses` (see `use_invite`).
            #[serde(skip_serializing_if = "crate::if_zero_u32", default)]
            uses: u32,
            /// Vortex: how many joins this invite allows, `None` for unlimited
            #[serde(skip_serializing_if = "Option::is_none", default)]
            max_uses: Option<u32>,
            /// Vortex: when this invite stops working, `None` for never
            ///
            /// Checked when the invite is READ or USED, never by a job: the fork
            /// does not publish `crond`, so nothing would run it. An expired
            /// invite stays listed (with its state) until someone deletes it.
            #[serde(skip_serializing_if = "Option::is_none", default)]
            expires_at: Option<Timestamp>,
            /// Vortex: whoever joins through it is removed when their last
            /// session disconnects, unless they hold a role by then
            #[serde(skip_serializing_if = "crate::if_false", default)]
            temporary: bool,
        },
        /// Invite to a group channel
        Group {
            /// Invite code
            #[serde(rename = "_id")]
            code: String,
            /// Id of user who created this invite
            creator: String,
            /// Id of the group channel this invite points to
            channel: String,
        }, /* User {
               code: String,
               user: String
           } */
    }
);

/// Vortex: the limits of a new server invite
///
/// All optional and additive: the default is the plain invite the Stoat
/// protocol always had — never expires, unlimited, permanent membership.
#[derive(Debug, Clone, Default)]
pub struct InviteLimits {
    /// How many joins it allows
    pub max_uses: Option<u32>,
    /// When it stops working
    pub expires_at: Option<Timestamp>,
    /// Remove whoever joins through it when they disconnect
    pub temporary: bool,
}

#[allow(clippy::disallowed_methods)]
impl Invite {
    /// Get the invite code for this invite
    pub fn code(&'_ self) -> &'_ str {
        match self {
            Invite::Server { code, .. } | Invite::Group { code, .. } => code,
        }
    }

    /// Get the ID of the user who created this invite
    pub fn creator(&'_ self) -> &'_ str {
        match self {
            Invite::Server { creator, .. } | Invite::Group { creator, .. } => creator,
        }
    }

    /// Vortex: refuse an invite that expired or ran out of uses
    ///
    /// Called on every read and use of an invite. Group invites and the
    /// pseudo-invite of a discoverable server have no limits and always pass.
    pub fn check_usable(&self) -> Result<()> {
        if let Invite::Server {
            uses,
            max_uses,
            expires_at,
            ..
        } = self
        {
            if expires_at.is_some_and(|at| *at <= *Timestamp::now_utc()) {
                return Err(create_error!(InviteExpired));
            }

            if max_uses.is_some_and(|max| *uses >= max) {
                return Err(create_error!(InviteExhausted));
            }
        }

        Ok(())
    }

    /// Vortex: whether whoever joins through this invite is a temporary member
    pub fn is_temporary(&self) -> bool {
        matches!(
            self,
            Invite::Server {
                temporary: true,
                ..
            }
        )
    }

    /// Vortex: whether this invite has a use limit
    pub fn has_max_uses(&self) -> bool {
        matches!(
            self,
            Invite::Server {
                max_uses: Some(_),
                ..
            }
        )
    }

    /// Create a new invite from given information
    pub async fn create_channel_invite(
        db: &Database,
        creator: &User,
        channel: &Channel,
        roles: Vec<String>,
        limits: InviteLimits,
    ) -> Result<Invite> {
        let code = nanoid::nanoid!(8, &ALPHABET);
        let invite = match &channel {
            Channel::Group { id, .. } => {
                // Limits are a server-invite concept: a group invite that
                // silently ignored them would promise something it can't keep.
                if limits.max_uses.is_some() || limits.expires_at.is_some() || limits.temporary
                {
                    return Err(create_error!(InvalidOperation));
                }

                Ok(Invite::Group {
                    code,
                    creator: creator.id.clone(),
                    channel: id.clone(),
                })
            }
            Channel::TextChannel { id, server, .. } => Ok(Invite::Server {
                code,
                creator: creator.id.clone(),
                server: server.clone(),
                channel: id.clone(),
                roles,
                uses: 0,
                max_uses: limits.max_uses,
                expires_at: limits.expires_at,
                temporary: limits.temporary,
            }),
            _ => Err(create_error!(InvalidOperation)),
        }?;

        db.insert_invite(&invite).await?;
        Ok(invite)
    }

    /// Resolve an invite by its ID or by a public server ID
    pub async fn find(db: &Database, code: &str) -> Result<Invite> {
        if let Ok(invite) = db.fetch_invite(code).await {
            return Ok(invite);
        } else if let Ok(server) = db.fetch_server(code).await {
            if server.discoverable {
                if let Some(channel) = server.channels.into_iter().next() {
                    return Ok(Invite::Server {
                        code: code.to_string(),
                        server: server.id,
                        creator: server.owner,
                        channel,
                        roles: vec![],
                        uses: 0,
                        max_uses: None,
                        expires_at: None,
                        temporary: false,
                    });
                }
            }
        }

        Err(create_error!(NotFound))
    }
}
