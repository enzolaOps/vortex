use revolt_result::Result;

use crate::ReferenceDb;
use crate::ServerEvent;

use super::AbstractServerEvents;

#[async_trait]
impl AbstractServerEvents for ReferenceDb {
    /// Insert a new scheduled event
    async fn insert_server_event(&self, event: &ServerEvent) -> Result<()> {
        let mut events = self.server_events.lock().await;
        if events.contains_key(&event.id) {
            Err(create_database_error!("insert", "server_event"))
        } else {
            events.insert(event.id.clone(), event.clone());
            Ok(())
        }
    }

    /// Fetch a scheduled event by its id
    async fn fetch_server_event(&self, id: &str) -> Result<ServerEvent> {
        let events = self.server_events.lock().await;
        events
            .get(id)
            .cloned()
            .ok_or_else(|| create_error!(NotFound))
    }

    /// Fetch all scheduled events of a server
    async fn fetch_server_events(&self, server: &str) -> Result<Vec<ServerEvent>> {
        let events = self.server_events.lock().await;
        Ok(events
            .values()
            .filter(|event| event.server == server)
            .cloned()
            .collect())
    }

    /// Fetch every scheduled event a user is interested in
    async fn fetch_server_events_for_user(&self, user: &str) -> Result<Vec<ServerEvent>> {
        let events = self.server_events.lock().await;
        Ok(events
            .values()
            .filter(|event| event.interested.contains(user))
            .cloned()
            .collect())
    }

    /// Write the editable fields of an event, leaving `interested` untouched
    async fn update_server_event(&self, event: &ServerEvent) -> Result<()> {
        let mut events = self.server_events.lock().await;
        let Some(current) = events.get_mut(&event.id) else {
            return Err(create_error!(NotFound));
        };

        let interested = std::mem::take(&mut current.interested);
        *current = event.clone();
        current.interested = interested;
        Ok(())
    }

    /// Add or remove a user from an event's interested list
    async fn set_server_event_interest(
        &self,
        id: &str,
        user: &str,
        interested: bool,
    ) -> Result<()> {
        let mut events = self.server_events.lock().await;
        let Some(event) = events.get_mut(id) else {
            return Err(create_error!(NotFound));
        };

        if interested {
            event.interested.insert(user.to_string());
        } else {
            event.interested.shift_remove(user);
        }

        Ok(())
    }

    /// Delete a scheduled event
    async fn delete_server_event(&self, id: &str) -> Result<()> {
        let mut events = self.server_events.lock().await;
        if events.remove(id).is_some() {
            Ok(())
        } else {
            Err(create_error!(NotFound))
        }
    }

    /// Delete every scheduled event of a server
    async fn delete_server_events(&self, server: &str) -> Result<()> {
        let mut events = self.server_events.lock().await;
        events.retain(|_, event| event.server != server);
        Ok(())
    }
}
