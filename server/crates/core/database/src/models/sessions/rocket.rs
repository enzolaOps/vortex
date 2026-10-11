use crate::{Database, Session};
use revolt_result::Error;
use rocket::{
    http::Status,
    request::{FromRequest, Outcome},
    Request,
};

/// Resultado da busca da sessão, guardado por requisição.
///
/// Vortex: o fairing do limitador (`revolt-ratelimits`) e o guard de `User`
/// pedem a sessão à mesma requisição, e cada pedido era uma ida ao Mongo.
/// O `local_cache` do Rocket é indexado por TIPO, então o valor cacheado é um
/// tipo privado — um `Option<Session>` solto colidiria com qualquer outro
/// código que cacheasse o mesmo tipo. A FALHA também é cacheada: um token
/// inválido não deve custar uma consulta por guard.
struct SessaoDaRequisicao(Option<Session>);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for Session {
    type Error = Error;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let Some(token) = request.headers().get("x-session-token").next() else {
            return Outcome::Error((Status::Unauthorized, create_error!(MissingHeaders)));
        };

        let SessaoDaRequisicao(session) = request
            .local_cache_async(async {
                SessaoDaRequisicao(
                    request
                        .rocket()
                        .state::<Database>()
                        .expect("`Database`")
                        .fetch_session_by_token(token)
                        .await
                        .ok(),
                )
            })
            .await;

        match session {
            Some(session) => Outcome::Success(session.clone()),
            None => Outcome::Error((Status::Unauthorized, create_error!(InvalidSession))),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{Database, DatabaseInfo, Session};
    use iso8601_timestamp::Timestamp;
    use rocket::{
        http::{Header, Status},
        local::asynchronous::Client,
        request::{FromRequest, Outcome},
        Request,
    };

    /// Pede a sessão duas vezes à mesma requisição, apagando-a do banco entre
    /// os dois pedidos. Se o segundo pedido fosse ao banco, falharia.
    struct DuasVezes(bool);

    #[rocket::async_trait]
    impl<'r> FromRequest<'r> for DuasVezes {
        type Error = ();

        async fn from_request(request: &'r Request<'_>) -> Outcome<Self, ()> {
            let primeira = request.guard::<Session>().await;
            if let Outcome::Success(session) = &primeira {
                request
                    .rocket()
                    .state::<Database>()
                    .unwrap()
                    .delete_session(&session.id)
                    .await
                    .unwrap();
            }
            let segunda = request.guard::<Session>().await;
            Outcome::Success(DuasVezes(primeira.is_success() && segunda.is_success()))
        }
    }

    /// Token inválido: o primeiro pedido falha; depois a sessão passa a
    /// existir, e o segundo pedido continua falhando — a falha foi cacheada.
    struct FalhaCacheada(bool);

    #[rocket::async_trait]
    impl<'r> FromRequest<'r> for FalhaCacheada {
        type Error = ();

        async fn from_request(request: &'r Request<'_>) -> Outcome<Self, ()> {
            let primeira = request.guard::<Session>().await;
            request
                .rocket()
                .state::<Database>()
                .unwrap()
                .save_session(&sessao("tardia"))
                .await
                .unwrap();
            let segunda = request.guard::<Session>().await;
            Outcome::Success(FalhaCacheada(primeira.is_error() && segunda.is_error()))
        }
    }

    #[rocket::get("/duas")]
    fn duas(r: DuasVezes) -> &'static str {
        if r.0 {
            "ok"
        } else {
            "falhou"
        }
    }

    #[rocket::get("/falha")]
    fn falha(r: FalhaCacheada) -> &'static str {
        if r.0 {
            "ok"
        } else {
            "falhou"
        }
    }

    fn sessao(token: &str) -> Session {
        Session {
            id: format!("id-{token}"),
            user_id: "usuario".to_string(),
            token: token.to_string(),
            name: "teste".to_string(),
            last_seen: Timestamp::now_utc(),
            origin: None,
            subscription: None,
        }
    }

    async fn cliente() -> Client {
        let db = DatabaseInfo::Reference.connect().await.unwrap();
        db.save_session(&sessao("valido")).await.unwrap();
        let rocket = rocket::build()
            .manage(db)
            .mount("/", rocket::routes![duas, falha]);
        Client::untracked(rocket).await.unwrap()
    }

    #[rocket::async_test]
    async fn sessao_e_buscada_uma_vez_por_requisicao() {
        let client = cliente().await;
        let resposta = client
            .get("/duas")
            .header(Header::new("x-session-token", "valido"))
            .dispatch()
            .await;
        assert_eq!(resposta.status(), Status::Ok);
        assert_eq!(resposta.into_string().await.unwrap(), "ok");
    }

    #[rocket::async_test]
    async fn falha_tambem_e_cacheada() {
        let client = cliente().await;
        let resposta = client
            .get("/falha")
            .header(Header::new("x-session-token", "tardia"))
            .dispatch()
            .await;
        assert_eq!(resposta.into_string().await.unwrap(), "ok");
    }
}
