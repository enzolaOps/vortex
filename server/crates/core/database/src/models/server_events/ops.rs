use revolt_result::Result;

use crate::ServerEvent;

#[cfg(feature = "mongodb")]
mod mongodb;
mod reference;

#[async_trait]
pub trait AbstractServerEvents: Sync + Send {
    /// Insert a new scheduled event
    async fn insert_server_event(&self, event: &ServerEvent) -> Result<()>;

    /// Fetch a scheduled event by its id
    async fn fetch_server_event(&self, id: &str) -> Result<ServerEvent>;

    /// Fetch all scheduled events of a server
    async fn fetch_server_events(&self, server: &str) -> Result<Vec<ServerEvent>>;

    /// Fetch every scheduled event a user is interested in
    async fn fetch_server_events_for_user(&self, user: &str) -> Result<Vec<ServerEvent>>;

    /// Write the editable fields of an event, leaving `interested` untouched
    async fn update_server_event(&self, event: &ServerEvent) -> Result<()>;

    /// Add or remove a user from an event's interested list
    async fn set_server_event_interest(&self, id: &str, user: &str, interested: bool)
        -> Result<()>;

    /// Delete a scheduled event
    async fn delete_server_event(&self, id: &str) -> Result<()>;

    /// Delete every scheduled event of a server
    async fn delete_server_events(&self, server: &str) -> Result<()>;
}
