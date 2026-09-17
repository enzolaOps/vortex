use revolt_rocket_okapi::revolt_okapi::openapi3::OpenApi;
use rocket::Route;

mod template_apply;
mod template_fetch;
mod template_use;

pub fn routes() -> (Vec<Route>, OpenApi) {
    openapi_get_routes_spec![
        template_fetch::fetch,
        template_use::use_template,
        template_apply::apply,
    ]
}
