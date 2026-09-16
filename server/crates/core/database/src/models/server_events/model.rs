use indexmap::IndexSet;
use iso8601_timestamp::Timestamp;
use revolt_result::Result;
use ulid::Ulid;

use crate::{events::client::EventV1, Database, File};

auto_derived!(
    /// Scheduled server event (Vortex)
    ///
    /// Coleção própria (`server_events`) e não um campo do servidor: o
    /// servidor vai inteiro no `Ready` de todo mundo, e cada "tenho interesse"
    /// virou um `ServerUpdate` com a lista toda.
    pub struct ServerEvent {
        /// Unique id
        #[serde(rename = "_id")]
        pub id: String,
        /// Server this event belongs to
        pub server: String,
        /// User who created the event
        pub creator: String,
        /// Event name
        pub name: String,
        /// Event description
        #[serde(skip_serializing_if = "Option::is_none", default)]
        pub description: Option<String>,
        /// When the event starts
        pub starts_at: Timestamp,
        /// When the event ends
        #[serde(skip_serializing_if = "Option::is_none", default)]
        pub ends_at: Option<Timestamp>,
        /// Where the event happens
        pub location: ServerEventLocation,
        /// Cover image
        #[serde(skip_serializing_if = "Option::is_none", default)]
        pub image: Option<File>,
        /// How the event repeats
        #[serde(skip_serializing_if = "Option::is_none", default)]
        pub recurrence: Option<ServerEventRecurrence>,
        /// Whether interested users should be reminded before it starts
        #[serde(skip_serializing_if = "crate::if_false", default)]
        pub remind: bool,
        /// Ids of the users interested in this event
        #[serde(skip_serializing_if = "IndexSet::is_empty", default)]
        pub interested: IndexSet<String>,
    }

    /// Where a scheduled event happens (Vortex)
    #[serde(tag = "type")]
    pub enum ServerEventLocation {
        Channel { channel: String },
        External { url: String },
    }

    /// How a scheduled event repeats (Vortex)
    pub enum ServerEventRecurrence {
        #[serde(rename = "weekly")]
        Weekly,
        #[serde(rename = "biweekly")]
        Biweekly,
        #[serde(rename = "monthly")]
        Monthly,
    }
);

#[allow(clippy::disallowed_methods)]
impl ServerEvent {
    /// Build a new event owned by `server`, created by `creator`
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        server: &str,
        creator: &str,
        name: String,
        description: Option<String>,
        starts_at: Timestamp,
        ends_at: Option<Timestamp>,
        location: ServerEventLocation,
        recurrence: Option<ServerEventRecurrence>,
        remind: bool,
    ) -> ServerEvent {
        let mut interested = IndexSet::new();
        // Quem cria tem interesse por construção — é o "ORGANIZA" da lista.
        interested.insert(creator.to_string());

        ServerEvent {
            id: Ulid::new().to_string(),
            server: server.to_string(),
            creator: creator.to_string(),
            name,
            description,
            starts_at,
            ends_at,
            location,
            image: None,
            recurrence,
            remind,
            interested,
        }
    }

    /// Insert this event and announce it to the server
    pub async fn create(&self, db: &Database) -> Result<()> {
        db.insert_server_event(self).await?;

        EventV1::ServerEventCreate {
            event: self.clone().into(),
        }
        .p(self.server.clone())
        .await;

        Ok(())
    }

    /// Persist the editable fields of this event and announce it
    pub async fn save(&self, db: &Database) -> Result<()> {
        db.update_server_event(self).await?;

        EventV1::ServerEventUpdate {
            event: self.clone().into(),
        }
        .p(self.server.clone())
        .await;

        Ok(())
    }

    /// Delete this event and announce it
    pub async fn delete(self, db: &Database) -> Result<()> {
        db.delete_server_event(&self.id).await?;

        if let Some(image) = &self.image {
            db.mark_attachment_as_deleted(&image.id).await.ok();
        }

        EventV1::ServerEventDelete {
            id: self.id.clone(),
            server: self.server.clone(),
        }
        .p(self.server)
        .await;

        Ok(())
    }

    /// Mark or unmark a user's interest
    pub async fn set_interest(&self, db: &Database, user: &str, interested: bool) -> Result<()> {
        db.set_server_event_interest(&self.id, user, interested)
            .await?;

        EventV1::ServerEventInterest {
            id: self.id.clone(),
            server: self.server.clone(),
            user_id: user.to_string(),
            interested,
        }
        .p(self.server.clone())
        .await;

        Ok(())
    }
}
