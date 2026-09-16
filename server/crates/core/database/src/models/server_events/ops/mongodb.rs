use bson::{to_document, Document};
use revolt_result::Result;

use crate::MongoDb;
use crate::ServerEvent;

use super::AbstractServerEvents;

static COL: &str = "server_events";

/// Campos opcionais que somem do documento quando o evento não os tem.
///
/// `skip_serializing_if` os tira do `$set`, e sem o `$unset` correspondente
/// remover a descrição num PATCH deixaria a antiga gravada.
const OPTIONAL_FIELDS: [&str; 4] = ["description", "ends_at", "image", "recurrence"];

#[async_trait]
impl AbstractServerEvents for MongoDb {
    /// Insert a new scheduled event
    async fn insert_server_event(&self, event: &ServerEvent) -> Result<()> {
        query!(self, insert_one, COL, &event).map(|_| ())
    }

    /// Fetch a scheduled event by its id
    async fn fetch_server_event(&self, id: &str) -> Result<ServerEvent> {
        query!(self, find_one_by_id, COL, id)?.ok_or_else(|| create_error!(NotFound))
    }

    /// Fetch all scheduled events of a server
    async fn fetch_server_events(&self, server: &str) -> Result<Vec<ServerEvent>> {
        query!(
            self,
            find,
            COL,
            doc! {
                "server": server
            }
        )
    }

    /// Fetch every scheduled event a user is interested in
    async fn fetch_server_events_for_user(&self, user: &str) -> Result<Vec<ServerEvent>> {
        query!(
            self,
            find,
            COL,
            doc! {
                "interested": user
            }
        )
    }

    /// Write the editable fields of an event, leaving `interested` untouched
    async fn update_server_event(&self, event: &ServerEvent) -> Result<()> {
        let mut set =
            to_document(event).map_err(|_| create_database_error!("to_document", COL))?;

        // Nunca pelo `$set`: interesse muda por `$addToSet`/`$pull`, e
        // regravar a lista inteira aqui apagaria quem marcou interesse entre
        // a leitura e esta escrita.
        set.remove("_id");
        set.remove("server");
        set.remove("interested");

        let mut unset = Document::new();
        for field in OPTIONAL_FIELDS {
            if !set.contains_key(field) {
                unset.insert(field, 1);
            }
        }

        let mut update = doc! { "$set": set };
        if !unset.is_empty() {
            update.insert("$unset", unset);
        }

        self.col::<Document>(COL)
            .update_one(doc! { "_id": &event.id }, update)
            .await
            .map(|_| ())
            .map_err(|_| create_database_error!("update_one", COL))
    }

    /// Add or remove a user from an event's interested list
    async fn set_server_event_interest(
        &self,
        id: &str,
        user: &str,
        interested: bool,
    ) -> Result<()> {
        let update = if interested {
            doc! { "$addToSet": { "interested": user } }
        } else {
            doc! { "$pull": { "interested": user } }
        };

        self.col::<Document>(COL)
            .update_one(doc! { "_id": id }, update)
            .await
            .map(|_| ())
            .map_err(|_| create_database_error!("update_one", COL))
    }

    /// Delete a scheduled event
    async fn delete_server_event(&self, id: &str) -> Result<()> {
        query!(self, delete_one_by_id, COL, id).map(|_| ())
    }

    /// Delete every scheduled event of a server
    async fn delete_server_events(&self, server: &str) -> Result<()> {
        self.col::<Document>(COL)
            .delete_many(doc! { "server": server })
            .await
            .map(|_| ())
            .map_err(|_| create_database_error!("delete_many", COL))
    }
}
