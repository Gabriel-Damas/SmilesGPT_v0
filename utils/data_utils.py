from typing import Dict, List, Optional
from datetime import datetime
import copy
import os
import logging
from chat_database import ChatDatabase
from utils.chat_history_cache import ChatHistoryCache
from fastapi import Request, Header, Depends, HTTPException
from datetime import timedelta
from databricks.sdk import WorkspaceClient
from models import MessageResponse
import requests
from databricks.sdk.core import Config


logger = logging.getLogger(__name__)


#def get_token(
#    x_forwarded_access_token: str = Header(None, alias="X-Forwarded-Access-Token")
#) -> str:
#    """Get user authentication token (for user info, not for serving endpoints)"""
    # Try to get the token from the header, else from the environment variable
#    if x_forwarded_access_token:
#        logger.info(f"get_token: Using X-Forwarded-Access-Token: '{x_forwarded_access_token[:20]}...' (truncated)")
#        return x_forwarded_access_token
#    else:
#        env_token = os.environ.get("LOCAL_API_TOKEN")
#        logger.info(f"get_token: No header token, using LOCAL_API_TOKEN: '{env_token[:20] if env_token else 'NOT_SET'}...' (truncated)")
        
#        return env_token

#def get_service_token() -> str:
#    """
#    Get service token for serving endpoint calls.
#    
#    - In Databricks Apps: uses DATABRICKS_TOKEN (has proper scopes for serving endpoints)
#    - In local dev: uses LOCAL_API_TOKEN (your PAT)
#    
#    This is different from user OAuth token which doesn't have serving endpoint scopes.
#    """
#    # Priority: DATABRICKS_TOKEN (Apps) > LOCAL_API_TOKEN (local dev)
#    service_token = os.environ.get("DATABRICKS_TOKEN") or os.environ.get("LOCAL_API_TOKEN")
#    
#    if not service_token:
#        logger.error("No service token available (DATABRICKS_TOKEN or LOCAL_API_TOKEN)")
#        raise HTTPException(status_code=500, detail="No service token available for serving endpoint")
#    
#    token_source = "DATABRICKS_TOKEN" if os.environ.get("DATABRICKS_TOKEN") else "LOCAL_API_TOKEN"
#    logger.info(f"get_service_token: Using {token_source} for serving endpoint call")
#    
#    return service_token




def _is_databricks_apps_env() -> bool:
    """
    Indica se a aplicação está rodando em Databricks Apps (não em dev local).
    Em Apps, o platform injeta DATABRICKS_CLIENT_ID/SECRET ou DATABRICKS_TOKEN.
    """
    return bool(
        os.environ.get("DATABRICKS_CLIENT_ID")
        or os.environ.get("DATABRICKS_TOKEN")
    )


def get_token(
    x_forwarded_access_token: str = Header(default=None, alias="X-Forwarded-Access-Token")
) -> str:
    """
    Token do usuário (OBO) quando seu app usa User Authorization:
    - Databricks Apps: X-Forwarded-Access-Token vem nos headers da requisição.
      Em Apps NUNCA usamos LOCAL_API_TOKEN aqui, para garantir uso de OBO.
    - Local/dev: pode usar LOCAL_API_TOKEN para testes (evite produção).
    """
    token = (x_forwarded_access_token or "").strip()
    if token:
        logger.info("get_token: usando token de usuário via header (OBO).")
        return token

    # Em Databricks Apps, não fazer fallback para LOCAL_API_TOKEN:
    # isso faria tudo rodar como SP em vez do usuário logado (OBO).
    if _is_databricks_apps_env():
        logger.error(
            "get_token: em Databricks Apps o header X-Forwarded-Access-Token não foi enviado. "
            "Habilite 'User Authorization' (on-behalf-of) na configuração do app."
        )
        raise HTTPException(
            status_code=401,
            detail=(
                "Token de usuário (OBO) não disponível. "
                "Habilite 'User Authorization' no app no Databricks e garanta que o proxy envie o header X-Forwarded-Access-Token."
            ),
        )

    env_token = os.environ.get("LOCAL_API_TOKEN")
    if env_token:
        logger.info("get_token: usando LOCAL_API_TOKEN (somente dev).")
        return env_token

    raise HTTPException(status_code=401, detail="Token de usuário não disponível")

def get_service_token() -> str:
    """
    Token de serviço (Service Principal) para chamadas de backend (ex.: Serving, SQL, etc.).
    Prioridade:
      1) OAuth via SDK (recomendado) — usa DATABRICKS_CLIENT_ID/SECRET injetados no Apps
      2) Fluxo client_credentials manual com CLIENT_ID/SECRET (ambiente local)
      3) Fallback DEV: LOCAL_API_TOKEN (evitar em produção)
    """
    # 1) Tente OAuth via SDK (unified authentication)
    try:
        # Opção A: direto pelo WorkspaceClient
        wc = WorkspaceClient()  # lê DATABRICKS_HOST/CLIENT_ID/CLIENT_SECRET do ambiente
        tok = wc.config.oauth_token().access_token
        logger.info("get_service_token: token OAuth obtido via SDK (Service Principal).")
        return tok
    except Exception as e:
        logger.warning("OAuth via SDK falhou; tentando fluxo client_credentials. Erro: %s", e)

    # 2) Fluxo manual client_credentials (útil em dev/containers sem SDK configurado)
    host = os.getenv("DATABRICKS_HOST")
    client_id = os.getenv("DATABRICKS_CLIENT_ID")
    client_secret = os.getenv("DATABRICKS_CLIENT_SECRET")

    if host and client_id and client_secret:
        token_url = host.rstrip("/") + "/oidc/v1/token"
        try:
            resp = requests.post(
                token_url,
                data={"grant_type": "client_credentials", "scope": "all-apis"},
                auth=(client_id, client_secret),
                timeout=15,
            )
            resp.raise_for_status()
            access_token = resp.json()["access_token"]
            logger.info("get_service_token: token OAuth obtido via client_credentials.")
            return access_token
        except Exception as e:
            logger.error("Falha ao obter token via client_credentials: %s", e)

    # 3) Fallback DEV (não use em produção)
    local = os.getenv("LOCAL_API_TOKEN")
    if local:
        logger.warning("get_service_token: usando LOCAL_API_TOKEN (apenas DEV).")
        return local

    raise HTTPException(status_code=500, detail="Não foi possível obter token de serviço")

async def check_endpoint_capabilities(
    model: str,
    streaming_support_cache: dict,
    user_access_token: str = Depends(get_token)
) -> tuple[bool, bool]:
    """
    Check if endpoint supports streaming and trace data.
    Returns (supports_streaming, supports_trace)
    """
    client = WorkspaceClient(token=user_access_token, auth_type="pat")
    current_time = datetime.now()
    cache_entry = streaming_support_cache['endpoints'].get(model)
    
    # If cache entry exists and is less than 24 hours old, use cached value
    if cache_entry and (current_time - cache_entry['last_checked']) < timedelta(days=1):
        return cache_entry['supports_streaming'], cache_entry['supports_trace']
    
    # Cache expired or doesn't exist - fetch fresh data
    try:
        endpoint = client.serving_endpoints.get(model)
        supports_trace = any(
            entity.name == 'feedback'
            for entity in endpoint.config.served_entities
        )
        
        # Update cache with fresh data
        streaming_support_cache['endpoints'][model] = {
            'supports_streaming': True,
            'supports_trace': supports_trace,
            'last_checked': current_time
        }
        return True, supports_trace
        
    except Exception as e:
        # If error occurs, return default values
        return True, False


    
async def get_user_info(user_access_token: str = Depends(get_token)) -> dict:
    """Get user information from request headers"""
    try:
        w = WorkspaceClient(token=user_access_token, auth_type="pat")

        current_user = w.current_user.me()
        return {
            "email": current_user.user_name,
            "user_id": current_user.id,
            "username": current_user.user_name,
            "displayName": current_user.display_name
        }
    except Exception as e:
        logger.error(f"Error getting user info: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")

async def load_chat_history(session_id: str, user_id: str, is_first_message: bool, chat_history_cache: ChatHistoryCache, chat_db: ChatDatabase) -> List[Dict]:
    """
    Load chat history with caching mechanism.
    Returns chat history in cache format.
    """
    # Try to get from cache first
    chat_history = copy.deepcopy(chat_history_cache.get_history(session_id))
    if chat_history:
        chat_history = convert_messages_to_cache_format(chat_history.messages)
    # If cache is empty and not first message, load from database
    elif not chat_history and not is_first_message:
        chat_data = chat_db.get_chat(session_id, user_id)
        if chat_data and chat_data.messages:
            # Convert to cache format
            chat_history = convert_messages_to_cache_format(chat_data.messages)
            # Store in cache
            for msg in chat_history:
                message_response = MessageResponse(
                    message_id=msg["message_id"],
                    content=msg["content"],
                    role=msg["role"],
                    timestamp=msg["timestamp"],
                    created_at=msg["created_at"]
                )
                chat_history_cache.add_message(session_id, message_response)
    
    return chat_history or []

def convert_messages_to_cache_format(messages: List) -> List[Dict]:
    """
    Convert database messages to cache format.
    Returns last 20 messages in cache format.
    """
    if not messages:
        return []
    formatted_messages = []
    for msg in messages[-20:]:
        formatted_messages.append({
            "role": msg.role,
            "content": msg.content,
            "message_id": msg.message_id,
            "timestamp": msg.timestamp.isoformat() if isinstance(msg.timestamp, datetime) else msg.timestamp,   
            "created_at": msg.created_at.isoformat() if isinstance(msg.created_at, datetime) else msg.created_at
        })
    return formatted_messages
    
def create_response_data(
    message_id: str,
    content: str,
    sources: Optional[List],
    ttft: Optional[float],
    total_time: float,
    timestamp: Optional[str] = None
) -> Dict:
    """Create standardized response data for both streaming and non-streaming responses."""
    # Convert content to string if it's a dictionary
    if isinstance(content, dict):
        content = content.get('content', '')
    if isinstance(timestamp, datetime):
        timestamp = timestamp.isoformat()
    # Create response data
    response_data = {
        'message_id': message_id,
        'content': content,
        'sources': sources if sources else None,
        'metrics': {
            'timeToFirstToken': ttft,
            'totalTime': total_time
        }
    }
    
    # Add timestamp if provided
    if timestamp:
        response_data['timestamp'] = timestamp
        
    # Convert any datetime objects in the response to strings
    return response_data
