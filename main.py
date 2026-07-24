from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Response, Request, Query, Header, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, RedirectResponse
from typing import Dict, List, Optional
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import EndpointStateReady
import os
from dotenv import load_dotenv
import uuid
from datetime import datetime, timedelta
import json
import httpx
import time  
import logging
import asyncio
import io
import pandas as pd
from chat_database import ChatDatabase
from collections import defaultdict
from contextlib import asynccontextmanager
from models import MessageRequest, MessageResponse, ChatHistoryItem, ChatHistoryResponse, CreateChatRequest, RegenerateRequest, GenieRequest
from utils.config import SERVING_ENDPOINT_NAME, DATABRICKS_HOST
from utils import *
from utils.data_utils import get_service_token, _is_databricks_apps_env
from utils.logging_handler import with_logging
from utils.app_state import app_state
from utils.dependencies import (
    get_chat_db,
    get_chat_history_cache,
    get_message_handler,
    get_streaming_handler,
    get_request_handler,
    get_streaming_semaphore,
    get_request_queue,
    get_streaming_support_cache
)
from utils.data_classes import StreamingContext, RequestContext, HandlerContext

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()  # This will output to console
    ]
)

logger = logging.getLogger(__name__)
load_dotenv(override=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await app_state.startup(app)
    yield
    await app_state.shutdown(app)

app = FastAPI(lifespan=lifespan)

class CachedStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response

ui_app = CachedStaticFiles(directory="frontend/build-chat-app", html=True)
api_app = FastAPI()
app.mount("/chat-api", api_app)
app.mount("/", ui_app)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# OBO por padrão; fallback SP só em 403 (usuário sem workspace-access)
async def get_auth_headers(
    token: str = Depends(get_token)
) -> dict:
    """Headers OBO para serving endpoint. Se der 403, o caller usa get_auth_headers_sp e refaz a chamada."""
    return {"Authorization": f"Bearer {token}"}


async def get_auth_headers_sp() -> dict:
    """Headers com token SP; usar só como fallback quando a chamada com OBO retornar 403."""
    return {"Authorization": f"Bearer {get_service_token()}"}
    

# Routes
@api_app.get("/")
async def root():
    return {"message": "Databricks Chat API is running"}


# ---------------------------------------------------------------------------
# Genie endpoint — chama o Genie Space diretamente (sem passar pelo agente)
# Mais rapido pois elimina o overhead do orquestrador LLM.
# ---------------------------------------------------------------------------
@api_app.post("/genie")
async def genie_chat(
    message: GenieRequest,
    user_info: dict = Depends(get_user_info),
    message_handler: MessageHandler = Depends(get_message_handler),
    chat_db: ChatDatabase = Depends(get_chat_db),
):
    logger.info(f"Genie endpoint chamado — session: {message.session_id}")
    user_id = user_info["user_id"]
    space_id = message.space_id or GENIE_SPACE_ID

    if not space_id:
        raise HTTPException(status_code=400, detail="GENIE_SPACE_ID nao configurado.")

    async def generate():
        try:
            yield f"data: {json.dumps({'type': 'status', 'thinkingStatus': 'Consultando dados no Genie...'})}\n\n"

            response_text, sql_query, conv_id = await call_genie(
                space_id=space_id,
                question=message.content,
                conversation_id=message.conversation_id,
            )

            assistant_message = message_handler.create_message(
                message_id=str(uuid.uuid4()),
                content=response_text,
                role="assistant",
                session_id=message.session_id,
                user_id=user_id,
                user_info=user_info,
                is_first_message=chat_db.is_first_message(message.session_id, user_id),
            )

            payload = assistant_message.model_dump()
            # Devolve o conversation_id para o frontend usar em follow-ups
            if conv_id:
                payload["conversation_id"] = conv_id
            if sql_query:
                payload["sql_query"] = sql_query

            yield f"data: {json.dumps(payload)}\n\n"
            yield "event: done\ndata: [DONE]\n\n"

        except Exception as e:
            logger.error(f"Erro no /genie: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
            yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


# ---------------------------------------------------------------------------
# Upload de arquivo CSV / XLSX — retorna prévia em markdown para o chat
# ---------------------------------------------------------------------------
@api_app.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ("csv", "xlsx", "xls"):
        raise HTTPException(status_code=400, detail="Formato não suportado. Envie um arquivo .csv ou .xlsx.")

    content = await file.read()

    try:
        if ext == "csv":
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Erro ao ler o arquivo: {e}")

    rows, cols = df.shape
    # Limite de linhas enviadas como contexto ao agente (acima de ~500 pode estourar tokens do modelo)
    preview_rows = min(500, rows)
    try:
        preview_md = df.head(preview_rows).to_markdown(index=False)
    except Exception:
        preview_md = df.head(preview_rows).to_string(index=False)

    col_types = ", ".join(f"{c} ({t})" for c, t in df.dtypes.items())

    return {
        "filename": filename,
        "rows": rows,
        "cols": cols,
        "columns": list(df.columns),
        "col_types": col_types,
        "preview_markdown": preview_md,
        "summary": (
            f"Arquivo '{filename}': {rows} linhas × {cols} colunas.\n"
            f"Colunas: {', '.join(df.columns.tolist())}"
        ),
    }


# Modify the chat endpoint to handle sessions
@api_app.post("/chat")
async def chat(
    message: MessageRequest,
    user_info: dict = Depends(get_user_info),
    headers: dict = Depends(get_auth_headers),
    headers_sp: dict = Depends(get_auth_headers_sp),
    chat_db: ChatDatabase = Depends(get_chat_db),
    chat_history_cache: ChatHistoryCache = Depends(get_chat_history_cache),
    message_handler: MessageHandler = Depends(get_message_handler),
    streaming_handler: StreamingHandler = Depends(get_streaming_handler),
    request_handler: RequestHandler = Depends(get_request_handler),
    streaming_semaphore: asyncio.Semaphore = Depends(get_streaming_semaphore),
    request_queue: asyncio.Queue = Depends(get_request_queue),
    streaming_support_cache: dict = Depends(get_streaming_support_cache)
):
    logger.info(f"Chat endpoint called with session_id: {message.session_id}, content length: {len(message.content) if message.content else 0}")
    try:
        user_id = user_info["user_id"]
        logger.info(f"Processing request for user_id: {user_id}")
        is_first_message = chat_db.is_first_message(message.session_id, user_id)
        logger.info(f"Is first message: {is_first_message}")
        user_message = message_handler.create_message(
            message_id=str(uuid.uuid4()),
            content=message.content,
            role="user",
            session_id=message.session_id,
            user_id=user_id,
            user_info=user_info,
            is_first_message=is_first_message
        )
        # Load chat history with caching
        logger.info(f"Loading chat history for session {message.session_id}")
        chat_history = await load_chat_history(message.session_id, user_id, is_first_message, chat_history_cache, chat_db)
        logger.info(f"Loaded {len(chat_history)} messages from chat history")
        
        async def generate():
            logger.info("Starting response generation")
            
            # Enviar status: preparando requisição
            yield f"data: {json.dumps({'type': 'status', 'thinkingStatus': 'Preparando requisição...'})}\n\n"
            
            streaming_timeout = httpx.Timeout(
                connect=8.0,
                read=120.0,
                write=8.0,
                pool=8.0
            )
            # Get the serving endpoint name from the request
            serving_endpoint_name = SERVING_ENDPOINT_NAME
            endpoint_url = f"{DATABRICKS_HOST}/serving-endpoints/{serving_endpoint_name}/invocations"
            logger.info(f"Using endpoint: {endpoint_url}")
            
            # Enviar status: verificando endpoint
            yield f"data: {json.dumps({'type': 'status', 'thinkingStatus': 'Verificando endpoint...'})}\n\n"
            supports_streaming = await check_endpoint_capabilities(serving_endpoint_name, streaming_support_cache)
            logger.info(f"Endpoint {serving_endpoint_name} supports_streaming: {supports_streaming}")
            request_data = {
                "input": [
                    *([{"role": msg["role"], "content": msg["content"]} for msg in chat_history[:-1]] 
                        if message.include_history else []),
                    {"role": "user", "content": message.content}
                ]
            }
            request_data["databricks_options"] = {"return_trace": True}

            if not supports_streaming:
                logger.info("Using non-streaming mode")
                yield f"data: {json.dumps({'type': 'status', 'thinkingStatus': 'Processando resposta...'})}\n\n"
                async for response_chunk in streaming_handler.handle_non_streaming_response(
                    request_handler, endpoint_url, headers, request_data, message.session_id, user_id, user_info, message_handler,
                    fallback_headers=headers_sp
                ):
                    yield response_chunk
            else:
                logger.info("Using streaming mode")
                async with streaming_semaphore:
                    logger.info("Acquired streaming semaphore")
                    async with httpx.AsyncClient(timeout=streaming_timeout) as streaming_client:
                        try:
                            request_data["stream"] = True
                            assistant_message_id = str(uuid.uuid4())
                            logger.info(f"Generated assistant message ID: {assistant_message_id}")
                            first_token_time = None
                            accumulated_content = ""
                            ttft = None
                            start_time = time.time()
                            logger.info(f"Starting streaming request at {start_time}")

                            logger.info(f"Making streaming POST request to {endpoint_url}")
                            logger.debug(f"Request data: {json.dumps(request_data, indent=2)}")
                            
                            # Enviar status: conectando ao modelo
                            yield f"data: {json.dumps({'type': 'status', 'thinkingStatus': 'Conectando ao modelo...'})}\n\n"
                            
                            # Send initial connection message to establish SSE stream
                            yield f"data: {json.dumps({'type': 'connection', 'message': 'connected'})}\n\n"
                            
                            # Enviar status: aguardando resposta
                            yield f"data: {json.dumps({'type': 'status', 'thinkingStatus': 'Aguardando resposta do modelo...'})}\n\n"
                            
                            # Primeira tentativa com OBO; em 403 retentar com SP
                            async with streaming_client.stream('POST', 
                                endpoint_url,
                                headers=headers,
                                json=request_data,
                                timeout=streaming_timeout
                            ) as response:
                                logger.info(f"Received response with status code: {response.status_code}")
                                if response.status_code == 200:
                                    logger.info("Starting to process streaming response (OBO)")
                                    async for response_chunk in streaming_handler.handle_streaming_response(
                                        response, request_data, headers, message.session_id, assistant_message_id,
                                        user_id, user_info, None, start_time, first_token_time,
                                        accumulated_content, None, ttft, request_handler, message_handler,
                                        streaming_support_cache, True, False
                                    ):
                                        yield response_chunk
                                    return
                                if response.status_code == 403:
                                    await response.aread()
                                    logger.warning("Serving endpoint 403 with OBO (user may lack workspace-access); retrying with SP")
                                    async with streaming_client.stream('POST',
                                        endpoint_url,
                                        headers=headers_sp,
                                        json=request_data,
                                        timeout=streaming_timeout
                                    ) as response2:
                                        if response2.status_code != 200:
                                            response_text = await response2.aread()
                                            logger.error(f"SP retry failed: {response2.status_code} - {response_text.decode('utf-8', errors='ignore')[:500]}")
                                            raise Exception(f"Streaming failed - HTTP {response2.status_code}")
                                        logger.info("Streaming response (SP fallback)")
                                        async for response_chunk in streaming_handler.handle_streaming_response(
                                            response2, request_data, headers_sp, message.session_id, assistant_message_id,
                                            user_id, user_info, None, start_time, first_token_time,
                                            accumulated_content, None, ttft, request_handler, message_handler,
                                            streaming_support_cache, True, False
                                        ):
                                            yield response_chunk
                                    return
                                response_text = await response.aread()
                                logger.error(f"Streaming request failed: {response.status_code} - {response_text.decode('utf-8', errors='ignore')[:1000]}")
                                raise Exception(f"Streaming not supported - HTTP {response.status_code}")
                        except (httpx.ReadTimeout, httpx.HTTPError, Exception) as e:
                            logger.error(f"Streaming failed with error type: {type(e).__name__}, message: {str(e)}")
                            logger.error(f"Falling back to non-streaming mode")
                            if serving_endpoint_name in streaming_support_cache['endpoints']:
                                logger.info(f"Updating cache to mark endpoint as non-streaming")
                                streaming_support_cache['endpoints'][serving_endpoint_name].update({
                                    'supports_streaming': False,
                                    'last_checked': datetime.now()
                                })
                            
                            request_data["stream"] = False
                            url = f"{endpoint_url}?nocache={uuid.uuid4()}"
                            logger.info(f"Making fallback request with fresh connection to {url}")
                            async for response_chunk in streaming_handler.handle_non_streaming_response(
                                request_handler, url, headers, request_data, message.session_id, user_id, user_info, message_handler,
                                fallback_headers=headers_sp
                            ):
                                yield response_chunk
                        

        logger.info("Returning StreamingResponse")
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        )

    except Exception as e:
        logger.error(f"Unhandled exception in chat endpoint: {type(e).__name__}: {str(e)}")
        logger.error(f"Exception details", exc_info=True)
        
        # Handle rate limit errors specifically
        if isinstance(e, httpx.HTTPStatusError) and e.response.status_code == 429:
            logger.warning("Rate limit error encountered")
            error_message = "The service is currently experiencing high demand. Please wait a moment and try again."
        
        error_message = message_handler.create_error_message(
            session_id=message.session_id,
            user_id=user_id,
            error_content="An error occurred while processing your request. " + str(e)
        )
        logger.info(f"Created error message: {error_message.message_id}")
        
        async def error_generate():
            yield f"data: {error_message.model_dump_json()}\n\n"
            yield "event: done\ndata: {}\n\n"
            
        return StreamingResponse(
            error_generate(),
            media_type="text/event-stream",
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        )

# WebSocket endpoint for chat to bypass proxy timeouts
@api_app.websocket("/chat-ws")
async def websocket_chat(
    websocket: WebSocket,
    chat_db: ChatDatabase = Depends(get_chat_db),
    chat_history_cache: ChatHistoryCache = Depends(get_chat_history_cache),
    message_handler: MessageHandler = Depends(get_message_handler),
    streaming_handler: StreamingHandler = Depends(get_streaming_handler),
    request_handler: RequestHandler = Depends(get_request_handler),
    streaming_semaphore: asyncio.Semaphore = Depends(get_streaming_semaphore),
    request_queue: asyncio.Queue = Depends(get_request_queue),
    streaming_support_cache: dict = Depends(get_streaming_support_cache)
):
    await websocket.accept()
    
    try:
        # Get token from WebSocket headers (set by proxy during handshake)
        # Header name is case-insensitive; try both common variants
        headers_dict = {k.lower(): v for k, v in websocket.headers.items()}
        token = (headers_dict.get("x-forwarded-access-token") or "").strip()

        if token:
            actual_token = token
        elif _is_databricks_apps_env():
            # Em Apps não usar LOCAL_API_TOKEN: exige OBO via header
            logger.error(
                "WebSocket: X-Forwarded-Access-Token ausente. Habilite 'User Authorization' no app."
            )
            await websocket.close(code=1008, reason="OBO token required. Enable User Authorization.")
            return
        else:
            env_token = (os.environ.get("LOCAL_API_TOKEN") or "").strip()
            if env_token:
                actual_token = env_token
            else:
                logger.warning("WebSocket: No authentication token found in headers or LOCAL_API_TOKEN.")
                await websocket.close(code=1008, reason="No authentication token provided")
                return

        # OBO primeiro; em 403 usamos SP (fallback)
        headers = {"Authorization": f"Bearer {actual_token}"}
        headers_sp = {"Authorization": f"Bearer {get_service_token()}"}
        
        # Call get_user_info properly - it expects to use dependency injection
        try:
            w = WorkspaceClient(token=actual_token, auth_type="pat")
            current_user = w.current_user.me()
            user_info = {
                "email": current_user.user_name,
                "user_id": current_user.id,
                "username": current_user.user_name,
                "displayName": current_user.display_name
            }
        except Exception as e:
            logger.error(f"Error getting user info: {str(e)}")
            await websocket.close(code=1008, reason="Authentication failed")
            return
            
        user_id = user_info["user_id"]
        
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            message_request = MessageRequest(**data)
            
            is_first_message = chat_db.is_first_message(message_request.session_id, user_id)
            user_message = message_handler.create_message(
                message_id=str(uuid.uuid4()),
                content=message_request.content,
                role="user",
                session_id=message_request.session_id,
                user_id=user_id,
                user_info=user_info,
                is_first_message=is_first_message
            )
            
            # Load chat history with caching
            chat_history = await load_chat_history(message_request.session_id, user_id, is_first_message, chat_history_cache, chat_db)
            
            # Use longer timeout since WebSocket bypasses proxy timeout
            streaming_timeout = httpx.Timeout(
                connect=10.0,
                read=300.0,  # 5 minutes
                write=10.0,
                pool=10.0
            )
            
            serving_endpoint_name = SERVING_ENDPOINT_NAME
            endpoint_url = f"{DATABRICKS_HOST}/serving-endpoints/{serving_endpoint_name}/invocations"
            
            # Enviar status: verificando endpoint
            await websocket.send_json({'type': 'status', 'thinkingStatus': 'Verificando endpoint...'})
            supports_streaming = await check_endpoint_capabilities(serving_endpoint_name, streaming_support_cache)
            request_data = {
                "input": [
                    *([{"role": msg["role"], "content": msg["content"]} for msg in chat_history[:-1]] 
                        if message_request.include_history else []),
                    {"role": "user", "content": message_request.content}
                ],
                "stream": True
            }
            request_data["databricks_options"] = {"return_trace": True}
            
            # Enviar status: preparando requisição
            await websocket.send_json({'type': 'status', 'thinkingStatus': 'Preparando requisição...'})
            
            # Enviar status: conectando ao modelo
            await websocket.send_json({'type': 'status', 'thinkingStatus': 'Conectando ao modelo...'})

            async def _ws_process_stream(response: httpx.Response) -> None:
                assistant_message_id = str(uuid.uuid4())
                start_time = time.time()
                accumulated_content = ""
                async for raw_line in response.aiter_lines():
                    if raw_line.startswith('data: '):
                        json_data = raw_line[6:].strip()
                        if json_data and json_data != '{}' and json_data != '[DONE]':
                            try:
                                raw_data = json.loads(json_data)
                                message_type = raw_data.get('type', 'unknown')
                                if message_type == 'response.output_text.delta' and 'delta' in raw_data:
                                    accumulated_content += raw_data['delta']
                                    await websocket.send_json(raw_data)
                                elif message_type == 'response.output_item.done':
                                    if raw_data.get('item', {}).get('content') and raw_data['item']['content']:
                                        final_content = raw_data['item']['content'][0].get('text', '')
                                        if final_content and len(final_content) > len(accumulated_content):
                                            accumulated_content = final_content
                                else:
                                    await websocket.send_json(raw_data)
                            except json.JSONDecodeError as e:
                                logger.error(f"JSON decode error: {e}")
                        elif json_data == '[DONE]':
                            if accumulated_content:
                                try:
                                    assistant_message = message_handler.create_message(
                                        message_id=assistant_message_id,
                                        content=accumulated_content,
                                        role="assistant",
                                        session_id=message_request.session_id,
                                        user_id=user_id,
                                        user_info=user_info,
                                        sources=None,
                                        metrics={'totalTime': time.time() - start_time}
                                    )
                                    completion_data = {
                                        'type': 'response.output_item.done',
                                        'item': {'id': assistant_message_id, 'content': [{'text': accumulated_content}]}
                                    }
                                    await websocket.send_text(json.dumps(completion_data))
                                    await asyncio.sleep(0.1)
                                except Exception as e:
                                    logger.error(f"Failed to save assistant message: {str(e)}")
                            break

            async with streaming_semaphore:
                async with httpx.AsyncClient(timeout=streaming_timeout) as streaming_client:
                    try:
                        # Enviar status: aguardando resposta
                        await websocket.send_json({'type': 'status', 'thinkingStatus': 'Aguardando resposta do modelo...'})
                        
                        retry_with_sp = False
                        async with streaming_client.stream('POST',
                            endpoint_url,
                            headers=headers,
                            json=request_data,
                            timeout=streaming_timeout
                        ) as response:
                            if response.status_code == 403:
                                await response.aread()
                                logger.warning("WebSocket: serving endpoint 403 with OBO; retrying with SP")
                                retry_with_sp = True
                            elif response.status_code == 200:
                                await _ws_process_stream(response)
                            else:
                                raise Exception(f"HTTP {response.status_code}: {await response.aread()}")

                        if retry_with_sp:
                            async with streaming_client.stream('POST',
                                endpoint_url,
                                headers=headers_sp,
                                json=request_data,
                                timeout=streaming_timeout
                            ) as response2:
                                if response2.status_code != 200:
                                    raise Exception(f"HTTP {response2.status_code}: {await response2.aread()}")
                                await _ws_process_stream(response2)
                    except Exception as e:
                        logger.error(f"WebSocket streaming error: {str(e)}")
                        await websocket.send_json({'type': 'error', 'message': f"Streaming error: {str(e)}"})
                            
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        try:
            await websocket.send_json({
                'type': 'error',
                'message': f"An error occurred: {str(e)}"
            })
        except:
            pass

@api_app.get("/chats", response_model=ChatHistoryResponse)
async def get_chat_history(user_info: dict = Depends(get_user_info),chat_db: ChatDatabase = Depends(get_chat_db)):
    user_id = user_info["user_id"]
    return chat_db.get_chat_history(user_id)

# Add logout endpoint
@api_app.get("/logout")
async def logout():
    return RedirectResponse(url=f"{os.getenv('DATABRICKS_HOST')}/login.html", status_code=303)

@api_app.get("/user-info")
async def login(
    user_info: dict = Depends(get_user_info),
):
    """Login endpoint for PAT authentication"""
    try:
       return user_info
    except Exception as e:
        logger.error(f"Login failed with error: {str(e)}")
        if hasattr(e, 'response'):
            logger.error(f"Response status: {e.response.status_code}")
            logger.error(f"Response body: {e.response.text}")
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8005, reload=False)
