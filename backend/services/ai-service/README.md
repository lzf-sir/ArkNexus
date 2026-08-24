# ArkNexus — ai-service

Multi-provider LLM chat microservice for ArkNexus. Bundles a catalog of
every well-known international + China + proxy provider, persists
per-provider API keys via the central config-service, and exposes a
GPT-style streaming chat UI.

## Features

- **22 providers**, 100+ models out-of-the-box (OpenAI, Anthropic,
  Gemini, Mistral, xAI, Groq, Cohere, Together, DeepSeek, Qwen, GLM,
  Moonshot, ERNIE, Doubao, Hunyuan, Spark, Baichuan, MiniMax, OpenRouter,
  SiliconFlow, OneAPI, custom OpenAI-compatible).
- **Only API key needed** to start chatting. Active provider + model are
  persisted as standard config-service entries.
- **Streaming + non-streaming** chat completions (OpenAI + Anthropic
  API styles covered).
- **Conversation persistence** with per-user history, pin / archive,
  system prompt + temperature snapshots.
- **JWT-aware** via the shared `JWT_SECRET`. The gateway is responsible
  for the edge check; this service trusts the bearer token at face value.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/v1/ai/catalog` | Full provider + model catalog (proxied from config-service) |
| `GET`  | `/api/v1/ai/providers` | Slim provider metadata |
| `GET`  | `/api/v1/ai/providers/{id}/models` | Models for a single provider |
| `GET`  | `/api/v1/ai/config` | All AI config (providers, per-provider masked keys, active selection) |
| `PUT`  | `/api/v1/ai/config/provider/{id}` | Save API key + base_url override for a provider |
| `DELETE` | `/api/v1/ai/config/provider/{id}` | Clear API key + base_url override |
| `PUT`  | `/api/v1/ai/config/active` | Set the active provider + model |
| `GET`  | `/api/v1/ai/conversations` | List conversations for the current user |
| `POST` | `/api/v1/ai/conversations` | Create a new conversation (optional first_message) |
| `GET`  | `/api/v1/ai/conversations/{id}` | Fetch a conversation with all messages |
| `PATCH`| `/api/v1/ai/conversations/{id}` | Update title / system prompt / pinned / archived |
| `DELETE` | `/api/v1/ai/conversations/{id}` | Delete a conversation |
| `GET`  | `/api/v1/ai/conversations/{id}/messages` | Messages of a conversation |
| `POST` | `/api/v1/ai/chat` | One-shot chat (no persistence), supports streaming |
| `POST` | `/api/v1/ai/conversations/{id}/chat` | Append a user message, stream assistant reply, persist |

## Run

```powershell
cd backend/services/ai-service
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env       # set JWT_SECRET to match gateway/email-service
python scripts\init_db.py    # alembic upgrade head
python -m app.main           # listens on http://127.0.0.1:8001
```

## Adding a new provider

Open `backend/shared/llm_catalog.py` and append a new entry to the
`PROVIDERS` list. The model list inside it must use the same field shape.
No other code changes are required; the config-service re-publishes the
catalog on next request and the AI service picks it up immediately.

