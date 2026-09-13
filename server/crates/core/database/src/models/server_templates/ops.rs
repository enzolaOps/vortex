use revolt_models::v0::ServerTemplate;
use revolt_result::Result;

#[cfg(feature = "mongodb")]
mod mongodb;
mod reference;

#[async_trait]
pub trait AbstractServerTemplates: Sync + Send {
    /// Insert new server template into database
    async fn insert_server_template(&self, template: &ServerTemplate) -> Result<()>;

    /// Fetch a server template by its code
    async fn fetch_server_template(&self, code: &str) -> Result<ServerTemplate>;

    /// Fetch the template generated from a server
    async fn fetch_server_template_by_server(&self, server_id: &str) -> Result<ServerTemplate>;

    /// Replace an existing server template
    async fn save_server_template(&self, template: &ServerTemplate) -> Result<()>;

    /// Delete a server template by its code
    async fn delete_server_template(&self, code: &str) -> Result<()>;
}
