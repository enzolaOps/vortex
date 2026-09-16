use bson::Document;
use revolt_result::Result;

use crate::MongoDb;
use crate::SoundboardSound;

use super::AbstractSoundboardSounds;

static COL: &str = "soundboard_sounds";

#[async_trait]
impl AbstractSoundboardSounds for MongoDb {
    async fn insert_sound(&self, sound: &SoundboardSound) -> Result<()> {
        query!(self, insert_one, COL, &sound).map(|_| ())
    }

    async fn fetch_sound(&self, id: &str) -> Result<SoundboardSound> {
        query!(self, find_one_by_id, COL, id)?.ok_or_else(|| create_error!(NotFound))
    }

    async fn fetch_sounds_by_server(&self, server_id: &str) -> Result<Vec<SoundboardSound>> {
        query!(
            self,
            find,
            COL,
            doc! {
                "server": server_id
            }
        )
    }

    async fn update_sound(&self, sound: &SoundboardSound) -> Result<()> {
        self.col::<Document>(COL)
            .update_one(
                doc! {
                    "_id": &sound.id
                },
                doc! {
                    "$set": {
                        "name": &sound.name,
                        "emoji": sound.emoji.clone(),
                        "volume": sound.volume as i32,
                    }
                },
            )
            .await
            .map(|_| ())
            .map_err(|_| create_database_error!("update_one", COL))
    }

    async fn delete_sound(&self, id: &str) -> Result<()> {
        query!(self, delete_one_by_id, COL, id).map(|_| ())
    }
}
