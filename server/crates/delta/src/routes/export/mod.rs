//! Vortex: exportar os dados da conta.
//!
//! Pedido → fila → arquivo ZIP no disco do contêiner → link temporário (e
//! e-mail, se o servidor tiver SMTP). O protocolo do Stoat não tem nada disto,
//! nem o upstream.
//!
//! ⚠ **O custo no Pi é o que decide cada escolha daqui:**
//!
//! - **Uma exportação por vez** no processo inteiro (`FILA`, semáforo de 1). A
//!   segunda espera; nunca duas varreduras de mensagens concorrendo por CPU e
//!   pelo Mongo com o chat ao vivo.
//! - **Uma por conta a cada 24 h.** O pedido repetido devolve o estado atual em
//!   vez de enfileirar outro.
//! - **Mensagens paginadas de 100 em 100, com pausa entre páginas**, e gravadas
//!   em arquivos de mil. A memória por passo é limitada pelo tamanho da página,
//!   não pelo histórico da pessoa.
//! - **Disco, não Redis nem S3.** Um ZIP de alguns MB no Valkey disputaria a
//!   memória que o Pi não tem; S3 exigiria o crate de arquivos inteiro, com os
//!   codecs de imagem, dentro da API. O arquivo vive em
//!   `VORTEX_EXPORT_DIR` (padrão: pasta temporária do sistema) e é apagado ao
//!   expirar, na próxima vez que qualquer rota de exportação rodar.
//! - **O link expira em 48 h** e é um token aleatório de 48 caracteres. Baixar
//!   não exige cabeçalho de sessão — link de e-mail abre num navegador que não
//!   tem o token do app —, então o token do link É a credencial, e ele não é o
//!   token da sessão.
//!
//! ⚠ **Um processo só.** O arquivo está no disco DESTE contêiner; com duas
//! réplicas da API o download cairia na outra metade das vezes. No Pi há uma.
use revolt_rocket_okapi::revolt_okapi::openapi3::OpenApi;
use rocket::Route;

pub mod download;
pub mod request;
pub mod status;
mod store;
mod worker;
mod zip;

pub fn routes() -> (Vec<Route>, OpenApi) {
    openapi_get_routes_spec![request::request, status::status, download::download]
}
