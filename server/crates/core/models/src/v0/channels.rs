#![allow(deprecated)]
use super::{File, UserVoiceState};

use revolt_permissions::{Override, OverrideField};
use std::collections::{HashMap, HashSet};

#[cfg(feature = "rocket")]
use rocket::FromForm;

auto_derived!(
    /// Channel
    #[allow(clippy::large_enum_variant)]
    #[serde(tag = "channel_type")]
    pub enum Channel {
        /// Personal "Saved Notes" channel which allows users to save messages
        SavedMessages {
            /// Unique Id
            #[cfg_attr(feature = "serde", serde(rename = "_id"))]
            id: String,
            /// Id of the user this channel belongs to
            user: String,
        },
        /// Direct message channel between two users
        DirectMessage {
            /// Unique Id
            #[cfg_attr(feature = "serde", serde(rename = "_id"))]
            id: String,

            /// Whether this direct message channel is currently open on both sides
            active: bool,
            /// 2-tuple of user ids participating in direct message
            recipients: Vec<String>,
            /// Id of the last message sent in this channel
            #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
            last_message_id: Option<String>,
        },
        /// Group channel between 1 or more participants
        Group {
            /// Unique Id
            #[cfg_attr(feature = "serde", serde(rename = "_id"))]
            id: String,

            /// Display name of the channel
            name: String,
            /// User id of the owner of the group
            owner: String,
            /// Channel description
            #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
            description: Option<String>,
            /// Array of user ids participating in channel
            recipients: Vec<String>,

            /// Custom icon attachment
            #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
            icon: Option<File>,
            /// Id of the last message sent in this channel
            #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
            last_message_id: Option<String>,

            /// Permissions assigned to members of this group
            /// (does not apply to the owner of the group)
            #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
            permissions: Option<i64>,

            /// Whether this group is marked as not safe for work
            #[cfg_attr(
                feature = "serde",
                serde(skip_serializing_if = "crate::if_false", default)
            )]
            nsfw: bool,
        },
        /// Text channel belonging to a server
        TextChannel {
            /// Unique Id
            #[cfg_attr(feature = "serde", serde(rename = "_id"))]
            id: String,
            /// Id of the server this channel belongs to
            server: String,

            /// Display name of the channel
            name: String,
            /// Channel description
            #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
            description: Option<String>,

            /// Custom icon attachment
            #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
            icon: Option<File>,
            /// Id of the last message sent in this channel
            #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
            last_message_id: Option<String>,

            /// Default permissions assigned to users in this channel
            #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
            default_permissions: Option<OverrideField>,
            /// Permissions assigned based on role to this channel
            #[cfg_attr(
                feature = "serde",
                serde(
                    default = "HashMap::<String, OverrideField>::new",
                    skip_serializing_if = "HashMap::<String, OverrideField>::is_empty"
                )
            )]
            role_permissions: HashMap<String, OverrideField>,

            /// Whether this channel is marked as not safe for work
            #[cfg_attr(
                feature = "serde",
                serde(skip_serializing_if = "crate::if_false", default)
            )]
            nsfw: bool,

            /// Voice Information for when this channel is also a voice channel
            #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
            voice: Option<VoiceInformation>,

            /// The channel's slowmode delay in seconds
            #[serde(skip_serializing_if = "Option::is_none")]
            slowmode: Option<u64>,

            /// Vortex: present when this channel's content is a set of posts
            /// (a forum, or a media gallery) instead of a single conversation
            #[cfg_attr(
                feature = "serde",
                serde(skip_serializing_if = "Option::is_none", default)
            )]
            forum: Option<ForumInformation>,

            /// Vortex: present when this channel is a thread inside another channel
            #[cfg_attr(
                feature = "serde",
                serde(skip_serializing_if = "Option::is_none", default)
            )]
            thread: Option<ThreadInformation>,

            /// Vortex: whether all media in this channel is hidden behind a spoiler
            #[cfg_attr(
                feature = "serde",
                serde(skip_serializing_if = "crate::if_false", default)
            )]
            spoiler: bool,

            /// Vortex: whether joining through this channel's invites is paused
            #[cfg_attr(
                feature = "serde",
                serde(skip_serializing_if = "crate::if_false", default)
            )]
            invites_paused: bool,
        },
    }

    /// Vortex: information for a forum or media channel
    #[derive(Default)]
    pub struct ForumInformation {
        /// Whether posts are media items shown as a gallery
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "crate::if_false", default)
        )]
        pub media: bool,
        /// Tags available to posts in this channel
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "Vec::is_empty", default)
        )]
        pub tags: Vec<ForumTag>,
    }

    /// Vortex: a tag that posts in a forum can carry
    pub struct ForumTag {
        /// Unique Id (within the channel)
        pub id: String,
        /// Display name
        pub name: String,
        /// Colour as `#rrggbb`
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "Option::is_none", default)
        )]
        pub colour: Option<String>,
    }

    /// Vortex: information for a thread channel
    #[derive(Default)]
    pub struct ThreadInformation {
        /// Id of the channel this thread belongs to
        pub parent: String,
        /// Id of the user who started the thread
        pub owner: String,
        /// Id of the opening message
        ///
        /// For a thread started from a message this is that message, which lives
        /// in the parent channel. For a post it is the first message sent inside
        /// the thread.
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "Option::is_none", default)
        )]
        pub message: Option<String>,
        /// Whether this thread is archived
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "crate::if_false", default)
        )]
        pub archived: bool,
        /// Ids of the parent's forum tags applied to this thread
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "Vec::is_empty", default)
        )]
        pub tags: Vec<String>,
        /// Ids of the users following this thread
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "Vec::is_empty", default)
        )]
        pub followers: Vec<String>,
        /// Whether this thread is pinned to the top of its forum
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "crate::if_false", default)
        )]
        pub pinned: bool,
    }

    /// Voice information for a channel
    #[derive(Default)]
    #[cfg_attr(feature = "validator", derive(validator::Validate))]
    pub struct VoiceInformation {
        /// Maximium amount of users allowed in the voice channel at once
        #[cfg_attr(feature = "validator", validate(range(min = 1)))]
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub max_users: Option<usize>,
        /// Audio bitrate for this voice channel, in kbps (Vortex)
        ///
        /// Applied by the client when publishing the microphone track.
        /// Absent means the client default.
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none", default))]
        pub bitrate: Option<u32>,
        /// Voice node pinned for this channel (Vortex)
        ///
        /// Must be one of the configured LiveKit nodes. Absent means automatic.
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none", default))]
        pub rtc_region: Option<String>,
        /// Video quality ceiling for this voice channel (Vortex)
        ///
        /// Applied by the client when publishing camera and screen tracks.
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none", default))]
        pub video_quality: Option<VideoQualityMode>,
        /// Kind of room this voice channel is (Vortex)
        ///
        /// Absent means a plain voice room. Clients that do not know the
        /// field (Stoat) keep seeing an ordinary voice channel.
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none", default))]
        pub kind: Option<VoiceChannelKind>,
    }

    /// Kind of room a voice channel is (Vortex)
    pub enum VoiceChannelKind {
        /// Plain voice room
        #[cfg_attr(feature = "serde", serde(rename = "voice"))]
        Voice,
        /// Video room: opens on the grid
        #[cfg_attr(feature = "serde", serde(rename = "video"))]
        Video,
        /// Stage room for presentations
        #[cfg_attr(feature = "serde", serde(rename = "stage"))]
        Stage,
    }

    /// Video quality ceiling of a voice channel (Vortex)
    pub enum VideoQualityMode {
        /// Let the client decide
        #[cfg_attr(feature = "serde", serde(rename = "auto"))]
        Auto,
        /// Up to 1280x720 at 30 fps
        #[cfg_attr(feature = "serde", serde(rename = "720p30"))]
        Hd720p30,
        /// Up to 1920x1080 at 60 fps
        #[cfg_attr(feature = "serde", serde(rename = "1080p60"))]
        Hd1080p60,
    }

    /// Partial representation of a channel
    #[derive(Default)]
    pub struct PartialChannel {
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub name: Option<String>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub owner: Option<String>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub description: Option<String>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub icon: Option<File>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub nsfw: Option<bool>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub active: Option<bool>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub permissions: Option<i64>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub role_permissions: Option<HashMap<String, OverrideField>>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub default_permissions: Option<OverrideField>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub last_message_id: Option<String>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub voice: Option<VoiceInformation>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub slowmode: Option<u64>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub forum: Option<ForumInformation>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub thread: Option<ThreadInformation>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub spoiler: Option<bool>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub invites_paused: Option<bool>,
    }

    /// Optional fields on channel object
    pub enum FieldsChannel {
        Description,
        Icon,
        DefaultPermissions,
        Voice,
        Slowmode,
    }

    /// New webhook information
    #[cfg_attr(feature = "validator", derive(validator::Validate))]
    pub struct DataEditChannel {
        /// Channel name
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 32)))]
        pub name: Option<String>,

        /// Channel description
        #[cfg_attr(feature = "validator", validate(length(min = 0, max = 1024)))]
        pub description: Option<String>,

        /// Group owner
        pub owner: Option<String>,

        /// Icon
        ///
        /// Provide an Autumn attachment Id.
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 128)))]
        pub icon: Option<String>,

        /// Whether this channel is age-restricted
        pub nsfw: Option<bool>,

        /// Whether this channel is archived
        pub archived: Option<bool>,

        /// Voice Information for voice channels
        pub voice: Option<VoiceInformation>,

        /// The channel's slow mode delay in seconds, up to 6 hours
        #[cfg_attr(feature = "validator", validate(range(min = 0, max = 21600)))]
        pub slowmode: Option<u64>,

        /// Vortex: whether all media in this channel is hidden behind a spoiler
        pub spoiler: Option<bool>,

        /// Vortex: whether joining through this channel's invites is paused
        pub invites_paused: Option<bool>,

        /// Fields to remove from channel
        #[cfg_attr(feature = "serde", serde(default))]
        pub remove: Vec<FieldsChannel>,
    }

    /// Create new group
    #[derive(Default)]
    #[cfg_attr(feature = "validator", derive(validator::Validate))]
    pub struct DataCreateGroup {
        /// Group name
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 32)))]
        pub name: String,
        /// Group description
        #[cfg_attr(feature = "validator", validate(length(min = 0, max = 1024)))]
        pub description: Option<String>,
        /// Group icon
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 128)))]
        pub icon: Option<String>,
        /// Array of user IDs to add to the group
        ///
        /// Must be friends with these users.
        #[cfg_attr(feature = "validator", validate(length(min = 0, max = 49)))]
        #[serde(default)]
        pub users: HashSet<String>,
        /// Whether this group is age-restricted
        #[serde(skip_serializing_if = "Option::is_none")]
        pub nsfw: Option<bool>,
    }

    /// Server Channel Type
    #[derive(Default)]
    pub enum LegacyServerChannelType {
        /// Text Channel
        #[default]
        Text,
        /// Voice Channel
        Voice,
        /// Vortex: Forum Channel (a text channel whose content is posts)
        Forum,
        /// Vortex: Media Channel (a text channel whose content is media posts)
        Media,
    }

    /// Create new server channel
    #[derive(Default)]
    #[cfg_attr(feature = "validator", derive(validator::Validate))]
    pub struct DataCreateServerChannel {
        /// Channel type
        #[serde(rename = "type", default = "LegacyServerChannelType::default")]
        pub channel_type: LegacyServerChannelType,
        /// Channel name
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 32)))]
        pub name: String,
        /// Channel description
        #[cfg_attr(feature = "validator", validate(length(min = 0, max = 1024)))]
        pub description: Option<String>,
        /// Whether this channel is age restricted
        #[serde(skip_serializing_if = "Option::is_none")]
        pub nsfw: Option<bool>,

        /// Voice Information for when this channel is also a voice channel
        #[serde(skip_serializing_if = "Option::is_none")]
        pub voice: Option<VoiceInformation>,
    }

    /// New default permissions
    #[serde(untagged)]
    pub enum DataDefaultChannelPermissions {
        Value {
            /// Permission values to set for members in a `Group`
            permissions: u64,
        },
        Field {
            /// Allow / deny values to set for members in this server channel
            permissions: Override,
        },
    }

    /// New role permissions
    pub struct DataSetRolePermissions {
        /// Allow / deny values to set for this role
        pub permissions: Override,
    }

    /// Options when deleting a channel
    #[cfg_attr(feature = "rocket", derive(FromForm))]
    pub struct OptionsChannelDelete {
        /// Whether to not send a leave message
        pub leave_silently: Option<bool>,
    }

    /// Voice server token response
    pub struct CreateVoiceUserResponse {
        /// Token for authenticating with the voice server
        pub token: String,
        /// Url of the livekit server to connect to
        pub url: String,
    }

    /// Voice state for a channel
    pub struct ChannelVoiceState {
        pub id: String,
        /// The states of the users who are connected to the channel
        pub participants: Vec<UserVoiceState>,
    }

    /// Join a voice channel
    pub struct DataJoinCall {
        /// Name of the node to join
        pub node: Option<String>,
        /// Whether to force disconnect any other existing voice connections
        ///
        /// Useful for disconnecting on another device and joining on a new.
        pub force_disconnect: Option<bool>,
        /// Users which should be notified of the call starting
        ///
        /// Only used when the user is the first one connected.
        pub recipients: Option<Vec<String>>,
    }

    /// Vortex: create a thread inside a channel
    #[derive(Default)]
    #[cfg_attr(feature = "validator", derive(validator::Validate))]
    pub struct DataCreateThread {
        /// Thread name (the post title, in a forum)
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 100)))]
        pub name: String,
        /// Id of the message in the parent channel this thread starts from
        #[cfg_attr(feature = "validator", validate(length(min = 26, max = 26)))]
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "Option::is_none", default)
        )]
        pub message: Option<String>,
        /// Ids of the parent's forum tags to apply
        #[cfg_attr(feature = "validator", validate(length(max = 5)))]
        #[cfg_attr(feature = "serde", serde(default))]
        pub tags: Vec<String>,
    }

    /// Vortex: edit a thread
    #[derive(Default)]
    #[cfg_attr(feature = "validator", derive(validator::Validate))]
    pub struct DataEditThread {
        /// New thread name
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 100)))]
        pub name: Option<String>,
        /// Whether the thread is archived
        pub archived: Option<bool>,
        /// Ids of the parent's forum tags to apply
        #[cfg_attr(feature = "validator", validate(length(max = 5)))]
        pub tags: Option<Vec<String>>,
        /// Whether the post is pinned to the top of its forum
        pub pinned: Option<bool>,
    }

    /// Vortex: edit the tags of a forum or media channel
    #[cfg_attr(feature = "validator", derive(validator::Validate))]
    pub struct DataEditForum {
        /// Tags available to posts in this channel
        #[cfg_attr(feature = "validator", validate(length(max = 20)))]
        pub tags: Vec<ForumTag>,
    }

    /// Vortex: options for listing the threads of a server
    #[cfg_attr(feature = "rocket", derive(FromForm))]
    pub struct OptionsFetchThreads {
        /// Only threads of this channel
        pub channel: Option<String>,
        /// Archived threads instead of active ones
        pub archived: Option<bool>,
    }

    /// Vortex: threads of a server
    pub struct ThreadListResponse {
        /// Thread channels
        pub threads: Vec<Channel>,
        /// Opening messages of the threads, where they exist
        pub messages: Vec<super::Message>,
        /// Authors of the opening messages
        pub users: Vec<super::User>,
        /// Number of messages inside each thread, by thread id
        pub message_counts: HashMap<String, u64>,
    }

    pub struct ChannelSlowmode {
        pub channel_id: String,
        pub duration: u64,
        pub retry_after: u64,
    }
);

impl Channel {
    /// Get a reference to this channel's id
    pub fn id(&self) -> &str {
        match self {
            Channel::DirectMessage { id, .. }
            | Channel::Group { id, .. }
            | Channel::SavedMessages { id, .. }
            | Channel::TextChannel { id, .. } => id,
        }
    }

    /// This returns a Result because the recipient name can't be determined here without a db call,
    /// which can't be done since this is models, which can't reference the database crate.
    ///
    /// If it returns None, you need to fetch the name from the db.
    pub fn name(&self) -> Option<&str> {
        match self {
            Channel::DirectMessage { .. } => None,
            Channel::SavedMessages { .. } => Some("Saved Messages"),
            Channel::TextChannel { name, .. } | Channel::Group { name, .. } => Some(name),
        }
    }
}

#[cfg(all(test, feature = "serde"))]
mod test {
    use super::{VoiceChannelKind, VoiceInformation};

    #[test]
    fn voz_sem_kind_desserializa_como_ausente() {
        let voz: VoiceInformation = serde_json::from_str(r#"{"max_users":5}"#).unwrap();
        assert_eq!(voz.kind, None);
        assert_eq!(voz.max_users, Some(5));
        // Ausente não é escrito: quem não conhece o campo recebe o JSON de sempre.
        assert_eq!(serde_json::to_string(&voz).unwrap(), r#"{"max_users":5}"#);
    }

    #[test]
    fn kind_ida_e_volta() {
        for (texto, kind) in [
            ("voice", VoiceChannelKind::Voice),
            ("video", VoiceChannelKind::Video),
            ("stage", VoiceChannelKind::Stage),
        ] {
            let json = format!(r#"{{"kind":"{texto}"}}"#);
            let voz: VoiceInformation = serde_json::from_str(&json).unwrap();
            assert_eq!(voz.kind, Some(kind));
            assert_eq!(serde_json::to_string(&voz).unwrap(), json);
        }
    }

    #[test]
    fn kind_desconhecido_e_recusado() {
        assert!(serde_json::from_str::<VoiceInformation>(r#"{"kind":"forum"}"#).is_err());
    }
}
