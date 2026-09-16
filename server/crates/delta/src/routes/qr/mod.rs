//! Vortex: entrar com código QR.
//!
//! Um aparelho SEM sessão pede um código; um aparelho COM sessão o autoriza; o
//! primeiro troca o segredo que só ele guarda por uma sessão nova da conta que
//! autorizou.
//!
//! ⚠ **Tudo mora no Redis, e nada no Mongo.** O pedido vive dois minutos e é de
//! uso único — é exatamente a forma de dado que o Redis resolve com TTL, e um
//! modelo novo no banco custaria migração, implementação de referência e
//! limpeza para algo que some sozinho.
//!
//! As proteções, na ordem em que o fluxo as encontra:
//!
//! 1. **O QR carrega só o `id`, nunca o segredo.** Quem fotografa a tela pode
//!    abrir a confirmação, mas não pode trocar a autorização por sessão: a
//!    troca exige o `secret`, que só o aparelho que pediu tem.
//! 2. **Dois minutos de vida** (`TTL`), e o aparelho que pediu renova pedindo
//!    outro — um QR esquecido na tela deixa de valer sozinho.
//! 3. **Código de confirmação de 6 dígitos nas DUAS telas.** É a defesa contra
//!    o golpe clássico de QR: alguém manda o próprio QR para a vítima
//!    autorizar. Quem autoriza vê o código e é instruído a só aprovar se o
//!    mesmo número estiver na tela à sua frente.
//! 4. **Primeiro a autorizar ganha** (`SET NX`). Uma segunda conta não troca a
//!    autorização de uma primeira.
//! 5. **Uso único na troca** (`DEL` devolvendo 1). Duas trocas concorrentes com
//!    o mesmo segredo não criam duas sessões.
//! 6. **Comparação de segredo em tempo constante.**
//! 7. A sessão criada leva o nome do aparelho que pediu, e aparece na lista de
//!    dispositivos da conta — onde pode ser derrubada como qualquer outra.
//! 8. Conta desativada não recebe sessão (mesma regra do login por senha), e o
//!    balde de limite de taxa é o `auth` de sempre, porque a rota mora sob
//!    `/auth`.
use revolt_rocket_okapi::revolt_okapi::openapi3::OpenApi;
use rocket::Route;

pub mod approve;
pub mod create;
pub mod deny;
pub mod exchange;
pub mod fetch;
mod store;

pub fn routes() -> (Vec<Route>, OpenApi) {
    openapi_get_routes_spec![
        create::create,
        fetch::fetch,
        approve::approve,
        deny::deny,
        exchange::exchange
    ]
}
