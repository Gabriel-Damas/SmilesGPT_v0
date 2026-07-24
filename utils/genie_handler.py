import asyncio
import logging
from typing import Optional
from databricks.sdk import WorkspaceClient

logger = logging.getLogger(__name__)


def _extract_genie_response(message) -> tuple:
    """
    Extrai texto e SQL dos attachments da resposta do Genie.
    Retorna (texto_resposta, sql_query_ou_None).
    """
    text_parts = []
    sql_query = None

    if not message or not message.attachments:
        return "Nao foi possivel obter uma resposta do Genie.", None

    for attachment in message.attachments:
        if hasattr(attachment, "text") and attachment.text:
            content = getattr(attachment.text, "content", None)
            if content:
                text_parts.append(content)

        if hasattr(attachment, "query") and attachment.query:
            query_obj = attachment.query
            description = getattr(query_obj, "description", None)
            query = getattr(query_obj, "query", None)
            if description:
                text_parts.append(description)
            if query:
                sql_query = query
                text_parts.append(f"```sql\n{query}\n```")

    response_text = "\n\n".join(text_parts) if text_parts else "Genie retornou uma resposta vazia."
    return response_text, sql_query


async def call_genie(
    space_id: str,
    question: str,
    conversation_id: Optional[str] = None,
) -> tuple:
    """
    Chama o Genie Space de forma assincrona (nao bloqueia o event loop).

    Retorna:
        (response_text, sql_query, conversation_id)
        - response_text  : resposta em linguagem natural + SQL formatado
        - sql_query      : SQL bruto gerado pelo Genie (ou None)
        - conversation_id: ID da conversa para follow-ups
    """
    def _sync_call():
        w = WorkspaceClient()
        if conversation_id:
            result = w.genie.ask_question_and_wait(
                space_id=space_id,
                conversation_id=conversation_id,
                content=question,
            )
        else:
            result = w.genie.start_conversation_and_wait(
                space_id=space_id,
                content=question,
            )
        return result

    try:
        result = await asyncio.to_thread(_sync_call)
        logger.info(f"Genie response status: {getattr(result, 'status', 'unknown')}")
        conv_id = getattr(result, "conversation_id", None)
        message = result if hasattr(result, "attachments") else getattr(result, "message", result)
        text, sql = _extract_genie_response(message)
        return text, sql, conv_id
    except Exception as e:
        logger.error(f"Erro ao chamar Genie: {type(e).__name__}: {e}")
        raise
