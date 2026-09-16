//! Vortex: atividades compartilhadas numa sala de voz.
//!
//! GET    /channels/:id/activity      a sessão em curso, com o registro de reprodução
//! POST   /channels/:id/activity      inicia uma atividade
//! DELETE /channels/:id/activity      encerra
//! POST   /channels/:id/activity/op   manda uma operação para quem está na sala
//!
//! ⚠ **O servidor não sabe o que a atividade É.** Ele guarda quem começou, de
//! que tipo ela é e um registro de operações opacas, e as retransmite por
//! evento. Quem interpreta é o host embutido em cada cliente, isolado num
//! iframe sem origem. Isso é o que faz uma atividade nova custar zero no
//! servidor — e o que mantém o Pi fora de qualquer lógica de jogo.
//!
//! O custo, dito: tudo mora no Redis, com teto. Uma sessão por canal, operação
//! de até `OP_MAX` bytes, registro de até `LOG_MAX` operações (as mais antigas
//! caem) e 12 h de vida desde a última operação. Uma operação com `snapshot`
//! SUBSTITUI o registro — é assim que o host compacta o estado, e é o que deixa
//! quem chega atrasado alcançar os outros lendo pouco.
use std::time::{SystemTime, UNIX_EPOCH};

use redis_kiss::{get_connection, AsyncCommands};
use revolt_database::{
    events::client::EventV1,
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    voice::{is_in_voice_channel, UserVoiceChannel},
    Channel, Database, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::{create_error, Result, ToRevoltError};
use rocket::{serde::json::Json, State};
use rocket_empty::EmptyResponse;

/// Tamanho máximo de uma operação, em bytes.
const OP_MAX: usize = 4096;
/// Operações guardadas para quem chega depois.
const LOG_MAX: isize = 500;
/// Vida da sessão sem nenhuma operação, em segundos.
const VIDA: usize = 12 * 60 * 60;
/// Tipos de atividade: identificador curto do catálogo do cliente.
const KIND_MAX: usize = 32;

fn chave(canal: &str) -> String {
    format!("vortex:activity:{canal}")
}

fn chave_do_log(canal: &str) -> String {
    format!("vortex:activity:{canal}:ops")
}

fn agora_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}

/// O tipo só pode ser um identificador — ele volta a todo cliente da sala.
fn kind_valido(kind: &str) -> bool {
    !kind.is_empty()
        && kind.len() <= KIND_MAX
        && kind
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

async fn conexao() -> Result<redis_kiss::Conn> {
    get_connection()
        .await
        .map_err(|_| create_error!(InternalError))
}

async fn ler(canal: &str) -> Result<Option<v0::ActivitySession>> {
    let mut conn = conexao().await?;
    let texto: Option<String> = conn.get(chave(canal)).await.to_internal_error()?;
    let Some(mut sessao) = texto.and_then(|t| serde_json::from_str::<v0::ActivitySession>(&t).ok())
    else {
        return Ok(None);
    };

    let ops: Vec<String> = conn
        .lrange(chave_do_log(canal), 0, -1)
        .await
        .to_internal_error()?;
    sessao.ops = ops
        .iter()
        .filter_map(|t| serde_json::from_str(t).ok())
        .collect();
    Ok(Some(sessao))
}

/// Quem está na sala de voz — a única condição para mexer na atividade.
async fn exigir_na_sala(user: &User, channel: &Channel) -> Result<()> {
    if channel.voice().is_none() {
        return Err(create_error!(NotAVoiceChannel));
    }
    if !is_in_voice_channel(&user.id, &UserVoiceChannel::from_channel(channel)).await? {
        return Err(create_error!(NotConnected));
    }
    Ok(())
}

/// # Fetch Activity
///
/// Vortex: a atividade em curso neste canal de voz, com o registro de operações.
#[openapi(tag = "Voice")]
#[get("/<target>/activity")]
pub async fn fetch(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
) -> Result<Json<v0::ActivitySession>> {
    let channel = target.as_channel(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).channel(&channel);
    calculate_channel_permissions(&mut query)
        .await
        .throw_if_lacking_channel_permission(ChannelPermission::ViewChannel)?;

    ler(channel.id())
        .await?
        .map(Json)
        .ok_or_else(|| create_error!(NotFound))
}

/// # Start Activity
///
/// Vortex: inicia uma atividade na sala. Uma por canal; a segunda recebe a que já existe.
#[openapi(tag = "Voice")]
#[post("/<target>/activity", data = "<data>")]
pub async fn start(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    data: Json<v0::DataStartActivity>,
) -> Result<Json<v0::ActivitySession>> {
    let channel = target.as_channel(db).await?;
    exigir_na_sala(&user, &channel).await?;

    let data = data.into_inner();
    if !kind_valido(&data.kind) {
        return Err(create_error!(InvalidOperation));
    }

    if let Some(existente) = ler(channel.id()).await? {
        return Ok(Json(existente));
    }

    let sessao = v0::ActivitySession {
        id: ulid::Ulid::new().to_string(),
        channel_id: channel.id().to_string(),
        kind: data.kind,
        host: user.id.clone(),
        started_at: agora_ms(),
        ops: Vec::new(),
    };

    let texto = serde_json::to_string(&sessao).to_internal_error()?;
    let mut conn = conexao().await?;
    conn.set_ex::<_, _, ()>(chave(channel.id()), texto, VIDA)
        .await
        .to_internal_error()?;
    conn.del::<_, ()>(chave_do_log(channel.id()))
        .await
        .to_internal_error()?;

    EventV1::ActivityUpdate {
        channel_id: channel.id().to_string(),
        activity: Some(sessao.clone()),
    }
    .p(channel.id().to_string())
    .await;

    Ok(Json(sessao))
}

/// # Stop Activity
///
/// Vortex: encerra a atividade. Qualquer pessoa na sala pode — quem começou pode
/// ter saído, e uma atividade sem dono não pode ficar presa na tela de todos.
#[openapi(tag = "Voice")]
#[delete("/<target>/activity")]
pub async fn stop(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
) -> Result<EmptyResponse> {
    let channel = target.as_channel(db).await?;
    exigir_na_sala(&user, &channel).await?;

    let mut conn = conexao().await?;
    let apagadas: i64 = conn
        .del(vec![chave(channel.id()), chave_do_log(channel.id())])
        .await
        .to_internal_error()?;

    if apagadas > 0 {
        EventV1::ActivityUpdate {
            channel_id: channel.id().to_string(),
            activity: None,
        }
        .p(channel.id().to_string())
        .await;
    }

    Ok(EmptyResponse)
}

/// # Activity Operation
///
/// Vortex: manda uma operação a todos na sala e a guarda para quem chegar depois.
#[openapi(tag = "Voice")]
#[post("/<target>/activity/op", data = "<data>")]
pub async fn op(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    data: Json<v0::DataActivityOp>,
) -> Result<EmptyResponse> {
    let channel = target.as_channel(db).await?;
    exigir_na_sala(&user, &channel).await?;

    let data = data.into_inner();
    if data.op.is_empty() || data.op.len() > OP_MAX {
        return Err(create_error!(InvalidOperation));
    }

    let sessao = ler(channel.id())
        .await?
        .ok_or_else(|| create_error!(NotFound))?;
    // Operação para uma sessão que já acabou não pode cair na seguinte.
    if sessao.id != data.activity_id {
        return Err(create_error!(NotFound));
    }

    let operacao = v0::ActivityOp {
        user: user.id.clone(),
        at: agora_ms(),
        op: data.op,
        snapshot: data.snapshot,
    };
    let texto = serde_json::to_string(&operacao).to_internal_error()?;

    let mut conn = conexao().await?;
    let log = chave_do_log(channel.id());
    if operacao.snapshot {
        conn.del::<_, ()>(&log).await.to_internal_error()?;
    }
    conn.rpush::<_, _, ()>(&log, texto).await.to_internal_error()?;
    conn.ltrim::<_, ()>(&log, -LOG_MAX, -1)
        .await
        .to_internal_error()?;
    conn.expire::<_, ()>(&log, VIDA).await.to_internal_error()?;
    conn.expire::<_, ()>(chave(channel.id()), VIDA)
        .await
        .to_internal_error()?;

    EventV1::ActivityOp {
        channel_id: channel.id().to_string(),
        activity_id: sessao.id,
        op: operacao,
    }
    .p(channel.id().to_string())
    .await;

    Ok(EmptyResponse)
}

#[cfg(test)]
mod tests {
    use super::kind_valido;

    #[test]
    fn tipo_de_atividade_so_identificador() {
        assert!(kind_valido("quadro"));
        assert!(kind_valido("assistir-junto"));
        assert!(!kind_valido(""));
        assert!(!kind_valido("<script>"));
        assert!(!kind_valido(&"a".repeat(33)));
    }
}
