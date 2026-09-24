use iso8601_timestamp::Timestamp;

use super::{Channel, File, Server, User};

auto_derived!(
    /// Invite
    #[serde(tag = "type")]
    pub enum Invite {
        /// Invite to a specific server channel
        Server {
            /// Invite code
            #[cfg_attr(feature = "serde", serde(rename = "_id"))]
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
            #[serde(skip_serializing_if = "crate::if_zero_u32", default)]
            uses: u32,
            /// Vortex: how many joins this invite allows, absent for unlimited
            #[serde(skip_serializing_if = "Option::is_none", default)]
            max_uses: Option<u32>,
            /// Vortex: when this invite stops working, absent for never
            #[serde(skip_serializing_if = "Option::is_none", default)]
            expires_at: Option<Timestamp>,
            /// Vortex: whoever joins through this invite is removed when their
            /// last session disconnects, unless they were given a role
            #[serde(skip_serializing_if = "crate::if_false", default)]
            temporary: bool,
        },
        /// Invite to a group channel
        Group {
            /// Invite code
            #[cfg_attr(feature = "serde", serde(rename = "_id"))]
            code: String,
            /// Id of user who created this invite
            creator: String,
            /// Id of the group channel this invite points to
            channel: String,
        },
    }

    /// Information about the invite to create
    #[derive(Default)]
    pub struct DataCreateInvite {
        /// Roles given to whoever joins the server through this invite
        ///
        /// Requires `AssignRoles`, and every role must rank below yours.
        #[serde(default)]
        pub roles: Vec<String>,
        /// Vortex: how many joins the invite allows (1..=1000), absent for unlimited
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pub max_uses: Option<u32>,
        /// Vortex: seconds until the invite expires (60..=2592000), absent for never
        ///
        /// Relative and not a date: the server's clock decides, so a client with
        /// a wrong clock can't make an invite that is born expired.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pub max_age: Option<u32>,
        /// Vortex: remove whoever joins through it when they disconnect
        ///
        /// Server invites only, and not together with `roles` — a role is what
        /// keeps a temporary member.
        #[serde(default, skip_serializing_if = "crate::if_false")]
        pub temporary: bool,
    }

    /// Public invite response
    #[allow(clippy::large_enum_variant)]
    #[serde(tag = "type")]
    pub enum InviteResponse {
        /// Server channel invite
        Server {
            /// Invite code
            code: String,
            /// Id of the server
            server_id: String,
            /// Name of the server
            server_name: String,
            /// Attachment for server icon
            #[serde(skip_serializing_if = "Option::is_none")]
            server_icon: Option<File>,
            /// Attachment for server banner
            #[serde(skip_serializing_if = "Option::is_none")]
            server_banner: Option<File>,
            /// Enum of server flags
            #[serde(skip_serializing_if = "Option::is_none")]
            server_flags: Option<i32>,
            /// Id of server channel
            channel_id: String,
            /// Name of server channel
            channel_name: String,
            /// Description of server channel
            #[serde(skip_serializing_if = "Option::is_none")]
            channel_description: Option<String>,
            /// Name of user who created the invite
            user_name: String,
            /// Avatar of the user who created the invite
            #[serde(skip_serializing_if = "Option::is_none")]
            user_avatar: Option<File>,
            /// Number of members in this server
            member_count: i64,
        },
        /// Group channel invite
        Group {
            /// Invite code
            code: String,
            /// Id of group channel
            channel_id: String,
            /// Name of group channel
            channel_name: String,
            /// Description of group channel
            #[serde(skip_serializing_if = "Option::is_none")]
            channel_description: Option<String>,
            /// Name of user who created the invite
            user_name: String,
            /// Avatar of the user who created the invite
            #[serde(skip_serializing_if = "Option::is_none")]
            user_avatar: Option<File>,
        },
    }

    /// Invite join response
    #[serde(tag = "type")]
    #[allow(clippy::large_enum_variant)]
    pub enum InviteJoinResponse {
        Server {
            /// Channels in the server
            channels: Vec<Channel>,
            /// Server we are joining
            server: Server,
        },
        Group {
            /// Group channel we are joining
            channel: Channel,
            /// Members of this group
            users: Vec<User>,
        },
    }
);
