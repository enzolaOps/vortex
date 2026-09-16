use revolt_models::v0::ServerTemplate;
use revolt_result::Result;

use crate::ReferenceDb;

use super::AbstractServerTemplates;

#[async_trait]
impl AbstractServerTemplates for ReferenceDb {
    /// Insert new server template into database
    async fn insert_server_template(&self, template: &ServerTemplate) -> Result<()> {
        let mut templates = self.server_templates.lock().await;
        if templates.contains_key(&template.code) {
            Err(create_database_error!("insert", "server_templates"))
        } else {
            templates.insert(template.code.clone(), template.clone());
            Ok(())
        }
    }

    /// Fetch a server template by its code
    async fn fetch_server_template(&self, code: &str) -> Result<ServerTemplate> {
        let templates = self.server_templates.lock().await;
        templates
            .get(code)
            .cloned()
            .ok_or_else(|| create_error!(NotFound))
    }

    /// Fetch the template generated from a server
    async fn fetch_server_template_by_server(&self, server_id: &str) -> Result<ServerTemplate> {
        let templates = self.server_templates.lock().await;
        templates
            .values()
            .find(|template| template.server == server_id)
            .cloned()
            .ok_or_else(|| create_error!(NotFound))
    }

    /// Replace an existing server template
    async fn save_server_template(&self, template: &ServerTemplate) -> Result<()> {
        let mut templates = self.server_templates.lock().await;
        if templates.contains_key(&template.code) {
            templates.insert(template.code.clone(), template.clone());
            Ok(())
        } else {
            Err(create_error!(NotFound))
        }
    }

    /// Delete a server template by its code
    async fn delete_server_template(&self, code: &str) -> Result<()> {
        let mut templates = self.server_templates.lock().await;
        if templates.remove(code).is_some() {
            Ok(())
        } else {
            Err(create_error!(NotFound))
        }
    }
}
