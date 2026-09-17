//! Vortex: baixar a exportação
//! GET /auth/export/download/:token/vortex-dados.zip
use rocket::fs::NamedFile;
use revolt_result::{create_error, Result};

use super::store;

/// # Download Data Export
///
/// Sem cabeçalho de sessão: o link sai por e-mail e abre num navegador que não
/// tem o token do app. O token do link É a credencial — 48 caracteres
/// aleatórios, 48 h de vida, e não é o token da sessão.
///
/// O último segmento é ignorado; ele existe para o navegador salvar o arquivo
/// com um nome que diz o que ele é, em vez do token.
#[openapi(skip)]
#[get("/download/<token>/<_>")]
pub async fn download(token: String) -> Result<NamedFile> {
    if !store::token_valido(&token) {
        return Err(create_error!(NotFound));
    }

    let dono = store::dono_do_token(&token)
        .await?
        .ok_or_else(|| create_error!(NotFound))?;

    NamedFile::open(store::caminho(&dono, &token))
        .await
        .map_err(|_| create_error!(NotFound))
}
