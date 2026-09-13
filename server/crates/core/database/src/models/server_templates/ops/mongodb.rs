use revolt_models::v0::ServerTemplate;
use revolt_result::Result;

use crate::MongoDb;

use super::AbstractServerTemplates;

static COL: &str = "server_templates";

#[async_trait]
impl AbstractServerTemplates for MongoDb {
    /// Insert new server template into database
    async fn insert_server_template(&self, template: &ServerTemplate) -> Result<()> {
        query!(self, insert_one, COL, &template).map(|_| ())
    }

    /// Fetch a server template by its code
    async fn fetch_server_template(&self, code: &str) -> Result<ServerTemplate> {
        query!(self, find_one_by_id, COL, code)?.ok_or_else(|| create_error!(NotFound))
    }

    /// Fetch the template generated from a server
    async fn fetch_server_template_by_server(&self, server_id: &str) -> Result<ServerTemplate> {
        query!(
            self,
            find_one,
            COL,
            doc! {
                "server": server_id
            }
        )?
        .ok_or_else(|| create_error!(NotFound))
    }

    /// Replace an existing server template
    async fn save_server_template(&self, template: &ServerTemplate) -> Result<()> {
        self.col::<ServerTemplate>(COL)
            .replace_one(
                doc! {
                    "_id": &template.code
                },
                template,
            )
            .await
            .map(|_| ())
            .map_err(|_| create_database_error!("replace_one", COL))
    }

    /// Delete a server template by its code
    async fn delete_server_template(&self, code: &str) -> Result<()> {
        query!(
            self,
            delete_one,
            COL,
            doc! {
                "_id": code
            }
        )
        .map(|_| ())
    }
}
