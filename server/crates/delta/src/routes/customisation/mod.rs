use revolt_rocket_okapi::revolt_okapi::openapi3::OpenApi;
use rocket::Route;

mod emoji_create;
mod emoji_delete;
mod emoji_edit;
mod emoji_fetch;
mod sounds;
mod stickers;

pub fn routes() -> (Vec<Route>, OpenApi) {
    openapi_get_routes_spec![
        emoji_create::create_emoji,
        emoji_delete::delete_emoji,
        emoji_edit::edit_emoji,
        emoji_fetch::fetch_emoji,
        stickers::create_sticker,
        stickers::fetch_sticker,
        stickers::edit_sticker,
        stickers::delete_sticker,
        sounds::create_sound,
        sounds::edit_sound,
        sounds::delete_sound
    ]
}
