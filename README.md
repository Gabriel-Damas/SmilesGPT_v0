---
title: "Knowledge Assistant Chatbot"
language: python
author: "Taiga Matsumoto"
date: 2025-05-26
---

# Databricks Knowledge Assistant Chatbot Application

Chat applications powered by your Databricks Knowledge Assistant

## Features

- 🚀 Real-time chat interface
- 💾 Chat history persistence
- 🔄 Message regeneration capability
- ⚡ Streaming responses
- 🔒 On-behalf-of-user authentication
- 🎯 Rate limiting and error handling

## Architecture

The application is built with:
- FastAPI for the backend API
- SQLite for chat history storage
- React frontend


## Getting Started

### Local Development

1. Clone the repository
2. Create an .env file with the following:
    - `LOCAL_API_TOKEN`: your PAT used only for local development
    - `DATABRICKS_HOST`: your Databricks domain url (e.g. "https://your-domain.cloud.databricks.com")
    - `SERVING_ENDPOINT_NAME`: your Knowledge Assistant's serving endpoint (e.g "ka-123-endpoint")

### Databricks Apps Deployment — OBO primeiro, fallback SP em 403

- **Sempre OBO quando o usuário tem workspace-access**: identidade e chamadas ao serving endpoint usam o token do usuário.
- **Fallback para SP só em 403**: se a chamada ao endpoint retornar 403 (ex.: usuário só Consumer, sem workspace-access), o app refaz a chamada com o token do Service Principal.
- **Acesso a dados (Genie, SQL, UC)**: sempre com o usuário (OBO), para respeitar RLS/CLS.

| Uso | Token | Motivo |
|-----|--------|--------|
| **Identidade** (sessão, histórico) | OBO | Quem está logado. |
| **Model serving / streaming** | OBO → em 403 usa SP | Quem tem workspace-access usa OBO; quem não tem recebe 403 e o app refaz com SP. |
| **Genie / SQL / UC** (dados governados) | **Sempre OBO** | Permissões e RLS por usuário. |

**Configuração resumida**

1. **App authorization (SP)**  
   SP com *workspace-access* e permissões no serving endpoint; usado só como fallback quando OBO retorna 403.

2. **User authorization (OBO)**  
   Habilite **User Authorization** e scopes (ex.: `sql`, `sql.warehouses`, `iam.current-user` para Genie/SQL/UC). Token em `x-forwarded-access-token`; acesso a dados (Genie) sempre com esse token.

3. **No app**  
   Sem User Authorization o header não é enviado e o app não identifica o usuário (em Apps não há fallback para `LOCAL_API_TOKEN`).

3. Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

4. Build the frontend

    [1]. Navigate to the frontend directory:

    ```bash
    cd frontend
    ```

    [2]. Install dependencies:

    ```bash
    npm install
    ```
    [3a]. Generate a local build:

    ```bash
    npm run build
    ```

    [3b]. Generate a production build for app deployment:

    ```bash
    npm run build:prod
    ```

5. Run the server:
    ```bash
    python main.py
    ```

## Key Components

- `fronted/`: React frontend
- `main.py`: FastAPI application entry point
- `utils/`: Helper functions and utilities
- `models.py`: Data models and schemas
- `chat_database.py`: Database interactions
