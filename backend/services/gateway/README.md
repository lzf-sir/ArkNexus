# ArkNexus — gateway

A thin reverse-proxy + JWT-edge that fronts the ArkNexus microservices.

## What it does

- Single `/api/*` entrypoint for the frontend.
- Forwards `/api/v1/*` to the configured `email-service` upstream.
- Validates `Authorization: Bearer <jwt>` at the edge for non-public paths.
- Falls open if `REQUIRE_AUTH_FOR_PROTECTED=false`.

## Adding a new upstream

Edit `app/routes/<new>_proxy.py` and mount its router in `app/main.py`.
The middleware in `app/main.py` is shared.

## Run

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python -m app.main     # listens on http://127.0.0.1:8080
```

## Notes

- `JWT_SECRET` MUST match the `email-service` so the edge can decode tokens.
- Attachments are streamed as binary responses (any octet-stream / image / audio / video / pdf).