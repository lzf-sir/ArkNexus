# ArkNexus — config-service

A central registry + config store for all ArkNexus microservices. Services register
themselves on startup, publish their config schema, and read back runtime values
at any time. Admins edit values via the frontend **系统设置** page.

## Why

- Avoid scattering every service''s tunable into its own `.env` file.
- One place to see which service is up + when it last checked in.
- Audit trail of who changed what.
- Future: hot-reload via `GET /services/{slug}/runtime` polling.

## Run

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python scripts\init_db.py        # alembic upgrade head
python -m app.main               # listens on http://127.0.0.1:8081
```

Swagger UI at `http://127.0.0.1:8081/docs`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`    | `/api/v1/services` | List registered services + online status |
| `POST`   | `/api/v1/services` | Register / refresh a service descriptor |
| `GET`    | `/api/v1/services/{slug}` | One service |
| `DELETE` | `/api/v1/services/{slug}` | Remove service + its config keys |
| `POST`   | `/api/v1/services/{slug}/heartbeat` | Liveness ping |
| `GET`    | `/api/v1/services/{slug}/configs` | All config keys for the service |
| `GET`    | `/api/v1/services/{slug}/configs/grouped` | Grouped by `group` (UI) |
| `PUT`    | `/api/v1/services/{slug}/configs/{key}` | Upsert a single key (service-side) |
| `POST`   | `/api/v1/services/{slug}/configs/bulk` | Bulk publish schema |
| `PATCH`  | `/api/v1/services/{slug}/configs/{key}/value` | Update current value (admin-side) |
| `GET`    | `/api/v1/services/{slug}/configs/{key}/history` | Audit trail |
| `GET`    | `/api/v1/services/{slug}/runtime` | Current values as a typed JSON dict |

## Service-side self-registration example

```python
import httpx

with httpx.Client() as c:
    c.post("http://config-service:8081/api/v1/services", json={
        "slug": "email-service",
        "display_name": "Email Service",
        "version": "0.2.0",
        "icon": "mail",
        "base_url": "http://email-service:8000",
        "health_url": "http://email-service:8000/health",
    })
    c.post("http://config-service:8081/api/v1/services/email-service/configs/bulk", json=[
        {
            "key": "RETENTION_DAYS",
            "value_type": "int",
            "default_value": "30",
            "current_value": "30",
            "group": "retention",
            "display_name": "保留天数",
            "description": "多少天后自动清理邮箱/邮件",
        }
    ])
```

Then later, the running service can pull its current config:

```python
runtime = httpx.get("http://config-service:8081/api/v1/services/email-service/runtime").json()
# {"RETENTION_DAYS": 30, ...}
```