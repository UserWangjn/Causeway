# Backend

FastAPI backend for the Polymarket event propagation demo.

## Run

```powershell
python -m pip install -r backend\requirements.txt
$env:AI_BASE_URL = "https://apigpt.cc/v1"
$env:AI_MODEL = "gpt-5.4-mini"
$env:AI_API_KEY = "<your key>"
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

The frontend dev server proxies `/api/*` to `http://127.0.0.1:8000`.

## Endpoints

- `GET /api/health`
- `GET /api/markets/search?q=bitcoin&limit=20`
- `GET /api/graph/scenario-presets`
- `GET /api/graph/scripted-scenarios`
- `POST /api/scenario/run`
- `GET /api/scenario/{id}/stream`
- `GET /api/node/{id}`
- `GET /api/edge/{id}`

`/api/graph/scenario-presets` dynamically selects root markets from live Polymarket data, searches related markets, attaches recent Google News RSS evidence, and optionally refines causal edges with AI. `/api/graph/scripted-scenarios` keeps the older fixed demo flows as a fallback.
