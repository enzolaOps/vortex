use indexmap::IndexSet;
use iso8601_timestamp::Timestamp;

#[cfg(feature = "validator")]
use validator::Validate;

use super::File;

auto_derived!(
    /// Scheduled server event (Vortex)
    ///
    /// Not part of the upstream Stoat protocol: clients that do not know it
    /// never call these routes and ignore the events.
    pub struct ServerEvent {
        /// Unique id
        #[cfg_attr(feature = "serde", serde(rename = "_id"))]
        pub id: String,
        /// Server this event belongs to
        pub server: String,
        /// User who created the event
        pub creator: String,
        /// Event name
        pub name: String,
        /// Event description
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none", default))]
        pub description: Option<String>,
        /// When the event starts
        pub starts_at: Timestamp,
        /// When the event ends
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none", default))]
        pub ends_at: Option<Timestamp>,
        /// Where the event happens
        pub location: ServerEventLocation,
        /// Cover image
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none", default))]
        pub image: Option<File>,
        /// How the event repeats
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none", default))]
        pub recurrence: Option<ServerEventRecurrence>,
        /// Whether interested users should be reminded before it starts
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "crate::if_false", default))]
        pub remind: bool,
        /// Ids of the users interested in this event
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "IndexSet::is_empty", default)
        )]
        pub interested: IndexSet<String>,
    }

    /// Where a scheduled event happens (Vortex)
    #[cfg_attr(feature = "serde", serde(tag = "type"))]
    pub enum ServerEventLocation {
        /// A channel of the same server, voice or text
        Channel {
            /// Channel id
            channel: String,
        },
        /// Somewhere outside Vortex
        External {
            /// Link to the event
            url: String,
        },
    }

    /// How a scheduled event repeats (Vortex)
    pub enum ServerEventRecurrence {
        #[cfg_attr(feature = "serde", serde(rename = "weekly"))]
        Weekly,
        #[cfg_attr(feature = "serde", serde(rename = "biweekly"))]
        Biweekly,
        #[cfg_attr(feature = "serde", serde(rename = "monthly"))]
        Monthly,
    }

    /// Data to create a scheduled event (Vortex)
    #[cfg_attr(feature = "validator", derive(Validate))]
    pub struct DataCreateServerEvent {
        /// Event name
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 100)))]
        pub name: String,
        /// Event description
        #[cfg_attr(feature = "validator", validate(length(min = 0, max = 1000)))]
        pub description: Option<String>,
        /// When the event starts
        pub starts_at: Timestamp,
        /// When the event ends; required for external events
        pub ends_at: Option<Timestamp>,
        /// Where the event happens
        pub location: ServerEventLocation,
        /// Cover image, an Autumn id from the `banners` tag
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 128)))]
        pub image: Option<String>,
        /// How the event repeats
        pub recurrence: Option<ServerEventRecurrence>,
        /// Whether interested users should be reminded before it starts
        #[cfg_attr(feature = "serde", serde(default))]
        pub remind: bool,
    }

    /// Optional fields of a scheduled event (Vortex)
    pub enum FieldsServerEvent {
        Description,
        EndsAt,
        Image,
        Recurrence,
    }

    /// Data to edit a scheduled event (Vortex)
    #[cfg_attr(feature = "validator", derive(Validate))]
    pub struct DataEditServerEvent {
        /// Event name
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 100)))]
        pub name: Option<String>,
        /// Event description
        #[cfg_attr(feature = "validator", validate(length(min = 0, max = 1000)))]
        pub description: Option<String>,
        /// When the event starts
        pub starts_at: Option<Timestamp>,
        /// When the event ends
        pub ends_at: Option<Timestamp>,
        /// Where the event happens
        pub location: Option<ServerEventLocation>,
        /// Cover image, an Autumn id from the `banners` tag
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 128)))]
        pub image: Option<String>,
        /// How the event repeats
        pub recurrence: Option<ServerEventRecurrence>,
        /// Whether interested users should be reminded before it starts
        pub remind: Option<bool>,
        /// Fields to remove
        #[cfg_attr(feature = "serde", serde(default))]
        pub remove: Vec<FieldsServerEvent>,
    }
);
