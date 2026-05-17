import asyncio
import html
import json
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import quote_plus
from xml.etree import ElementTree

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

GAMMA_BASE_URL = os.getenv("POLYMARKET_GAMMA_BASE_URL", "https://gamma-api.polymarket.com").rstrip("/")
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://apigpt.cc/v1").rstrip("/")
AI_MODEL = os.getenv("AI_MODEL", "gpt-5.4-mini")
AI_API_KEY = os.getenv("AI_API_KEY", "")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")
    if origin.strip()
]

Outcome = Literal["YES", "NO"]
Direction = Literal["up", "down", "uncertain"]
Strength = Literal["weak", "medium", "strong"]


class GraphNode(BaseModel):
    id: str
    question: str
    outcome: Outcome = "YES"
    price: float
    category: str
    volume: float | None = None
    status: Literal["idle", "active", "impacted", "muted"] = "idle"


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceOutcome: Outcome = "YES"
    targetOutcome: Outcome = "YES"
    direction: Direction
    strength: Strength
    confidence: float
    deltaRange: tuple[float, float]
    explanation: str
    evidenceUrls: list[str]


class ScenarioStep(BaseModel):
    id: str
    title: str
    sourceNodeId: str
    edgeIds: list[str]
    impactedNodeIds: list[str]
    narrative: str


class EvidenceItem(BaseModel):
    title: str
    url: str
    source: str | None = None
    published: str | None = None


class ScenarioPreset(BaseModel):
    id: str
    title: str
    subtitle: str
    rootNodeId: str
    summary: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    steps: list[ScenarioStep]
    evidence: list[EvidenceItem] = []
    source: Literal["polymarket-gamma", "polymarket-gamma-ai", "mock-fallback"] = "polymarket-gamma"
    aiStatus: Literal["disabled", "refined", "failed"] = "disabled"
    aiError: str | None = None


class ScenarioRunRequest(BaseModel):
    scenario_id: str
    use_ai: bool = True


class MarketSearchResult(BaseModel):
    id: str
    question: str
    category: str
    price: float
    volume: float
    slug: str | None = None
    endDate: str | None = None


class UniverseMarket(BaseModel):
    id: str
    question: str
    category: str
    eventTitle: str | None = None
    price: float
    volume: float
    slug: str | None = None
    endDate: str | None = None


class ScenarioGenerateRequest(BaseModel):
    root_market_id: str
    use_ai: bool = True


@dataclass(frozen=True)
class ScenarioSeed:
    id: str
    title: str
    subtitle: str
    summary: str
    root_terms: tuple[str, ...]
    candidate_terms: tuple[str, ...]


SCENARIO_SEEDS = {
    "trump-tariff": ScenarioSeed(
        id="trump-tariff",
        title="Live PM: Trump tariff shock",
        subtitle="Live Polymarket markets related to tariffs, inflation, Fed path, China risk, and equities.",
        summary="Active Polymarket questions are pulled from Gamma, then ranked and linked into a causal demo graph.",
        root_terms=("trump", "tariff"),
        candidate_terms=("trump", "tariff", "cpi", "inflation", "fed", "rate", "china", "s&p", "sp500", "recession"),
    ),
    "fed-rate-cut": ScenarioSeed(
        id="fed-rate-cut",
        title="Live PM: Fed rate cut cascade",
        subtitle="Live Polymarket markets related to Fed decisions, risk assets, recession, dollar, housing, and gold.",
        summary="Active rate and macro markets are pulled from Gamma and converted into a read-only scenario graph.",
        root_terms=("fed", "cut"),
        candidate_terms=("fed", "rate", "cut", "inflation", "cpi", "recession", "nasdaq", "s&p", "dollar", "gold"),
    ),
    "btc-regulation": ScenarioSeed(
        id="btc-regulation",
        title="Live PM: BTC regulation break",
        subtitle="Live Polymarket markets related to crypto regulation, ETF flows, Bitcoin price, and exchange risk.",
        summary="Active crypto policy and BTC markets are pulled from Gamma and linked into a causal propagation graph.",
        root_terms=("bitcoin", "btc"),
        candidate_terms=("bitcoin", "btc", "crypto", "etf", "sec", "coinbase", "stablecoin", "regulation", "ethereum"),
    ),
}

SCENARIO_SEARCH_QUERIES = {
    "trump-tariff": ("tariff", "trump tariff", "inflation", "china tariff"),
    "fed-rate-cut": ("fed rate cut", "fed", "recession", "gold"),
    "btc-regulation": ("bitcoin", "crypto regulation", "ethereum", "coinbase"),
}

DISCOVERY_QUERIES = (
    "trump",
    "fed",
    "bitcoin",
    "tariff",
    "election",
    "inflation",
    "ukraine",
    "china",
    "ai",
    "crypto",
)

STOPWORDS = {
    "will",
    "the",
    "and",
    "or",
    "before",
    "after",
    "with",
    "from",
    "this",
    "that",
    "have",
    "happen",
    "market",
    "2026",
    "2027",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
}

SCENARIO_CACHE: dict[str, tuple[float, list[ScenarioPreset]]] = {}
SCENARIO_CACHE_SECONDS = 300
UNIVERSE_CACHE: tuple[float, list[dict[str, Any]]] | None = None


app = FastAPI(title="Polymarket Event Propagation Engine", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_jsonish(value: Any, default: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return value if value is not None else default


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _market_price(market: dict[str, Any]) -> float:
    prices = _parse_jsonish(market.get("outcomePrices"), [])
    if isinstance(prices, list) and prices:
        return max(0.0, min(1.0, _as_float(prices[0], 0.5)))
    for key in ("lastTradePrice", "bestAsk", "bestBid"):
        if key in market:
            return max(0.0, min(1.0, _as_float(market.get(key), 0.5)))
    return 0.5


def _market_category(market: dict[str, Any]) -> str:
    events = market.get("events")
    if isinstance(events, list) and events:
        title = events[0].get("title")
        if isinstance(title, str) and title:
            return title[:28]
    category = market.get("category")
    return category if isinstance(category, str) and category else "Polymarket"


def _node_from_market(market: dict[str, Any], index: int) -> GraphNode:
    return GraphNode(
        id=f"pm-{market.get('id') or index}",
        question=str(market.get("question") or "Untitled Polymarket market"),
        price=_market_price(market),
        category=_market_category(market),
        volume=_as_float(market.get("volumeNum", market.get("volume")), 0.0),
    )


def _keyword_score(text: str, terms: tuple[str, ...]) -> int:
    lower = text.lower()
    return sum(2 if term in lower else 0 for term in terms)


def _market_id(market: dict[str, Any]) -> str:
    return str(market.get("id") or market.get("conditionId") or "")


def _event_title(market: dict[str, Any]) -> str:
    events = market.get("events")
    if isinstance(events, list) and events:
        title = events[0].get("title")
        if isinstance(title, str):
            return title
    return ""


def _extract_keywords(text: str, limit: int = 7) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z0-9$-]{2,}", text.lower())
    keywords: list[str] = []
    for word in words:
        clean = word.strip("-")
        if clean in STOPWORDS or clean in keywords:
            continue
        keywords.append(clean)
        if len(keywords) >= limit:
            break
    return keywords


def _dedupe_markets(markets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for market in markets:
        market_id = _market_id(market)
        if not market_id or market_id in seen:
            continue
        seen.add(market_id)
        deduped.append(market)
    return deduped


def _compact_market(market: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _market_id(market),
        "question": str(market.get("question", "")),
        "price": _market_price(market),
        "volume": _as_float(market.get("volumeNum", market.get("volume")), 0.0),
        "event": _event_title(market),
        "endDate": market.get("endDate"),
    }


def _market_cluster(market: dict[str, Any]) -> str:
    text = f"{market.get('question', '')} {_market_category(market)} {_event_title(market)}".lower()
    if any(term in text for term in ("bitcoin", "crypto", "ethereum", "solana", "coinbase")):
        return "crypto"
    if any(term in text for term in ("cup", "nba", "nhl", "fifa", "finals", "league", "win the 2026")):
        return "sports"
    if any(term in text for term in ("fed", "inflation", "rate", "recession", "cpi", "gdp", "jobs")):
        return "macro"
    if any(term in text for term in ("china", "taiwan", "ukraine", "iran", "israel", "russia", "war")):
        return "geopolitics"
    if re.search(r"\b(ai|openai|anthropic|xai|model|gpt)\b", text):
        return "ai"
    if any(term in text for term in ("trump", "election", "president", "senate", "congress", "tariff")):
        return "politics"
    return "other"


def _universe_item(market: dict[str, Any]) -> UniverseMarket:
    return UniverseMarket(
        id=_market_id(market),
        question=str(market.get("question", "")),
        category=_market_category(market),
        eventTitle=_event_title(market) or None,
        price=_market_price(market),
        volume=_as_float(market.get("volumeNum", market.get("volume")), 0.0),
        slug=market.get("slug"),
        endDate=market.get("endDate"),
    )


async def fetch_active_markets(limit: int = 250) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            f"{GAMMA_BASE_URL}/markets",
            params={"active": "true", "closed": "false", "limit": limit},
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            raise HTTPException(status_code=502, detail="Unexpected Polymarket Gamma response")
        return payload


async def public_search_markets(query: str, limit: int = 20) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(f"{GAMMA_BASE_URL}/public-search", params={"q": query, "limit": limit})
        response.raise_for_status()
        payload = response.json()

    markets: list[dict[str, Any]] = []
    seen: set[str] = set()
    for event in payload.get("events", []):
        for market in event.get("markets", []):
            market_id = str(market.get("id"))
            if market_id in seen:
                continue
            if not market.get("active", False) or market.get("closed", False):
                continue
            market["events"] = [event]
            markets.append(market)
            seen.add(market_id)

    return markets


async def fetch_news_evidence(query: str, limit: int = 5) -> list[EvidenceItem]:
    url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
    except Exception:
        return []

    try:
        root = ElementTree.fromstring(response.text)
    except ElementTree.ParseError:
        return []

    evidence: list[EvidenceItem] = []
    for item in root.findall(".//item")[:limit]:
        title = html.unescape(item.findtext("title") or "").strip()
        link = item.findtext("link") or ""
        source = item.findtext("source") or None
        published = item.findtext("pubDate") or None
        if title and link:
            evidence.append(EvidenceItem(title=title, url=link, source=source, published=published))
    return evidence


async def discover_market_pool() -> list[dict[str, Any]]:
    global UNIVERSE_CACHE
    if UNIVERSE_CACHE and time.time() - UNIVERSE_CACHE[0] < SCENARIO_CACHE_SECONDS:
        return UNIVERSE_CACHE[1]

    active_task = fetch_active_markets(limit=300)
    search_tasks = [public_search_markets(query, limit=12) for query in DISCOVERY_QUERIES]
    results = await asyncio.gather(active_task, *search_tasks, return_exceptions=True)

    markets: list[dict[str, Any]] = []
    for result in results:
        if isinstance(result, Exception):
            continue
        markets.extend(result)
    deduped = _dedupe_markets(markets)
    UNIVERSE_CACHE = (time.time(), deduped)
    return deduped


def fallback_roots(markets: list[dict[str, Any]], count: int = 3) -> list[dict[str, Any]]:
    ranked = sorted(markets, key=lambda market: _as_float(market.get("volumeNum", market.get("volume")), 0.0), reverse=True)
    roots: list[dict[str, Any]] = []
    used_events: set[str] = set()
    for market in ranked:
        question = str(market.get("question", ""))
        event = _event_title(market) or question[:40]
        if not question or event in used_events:
            continue
        roots.append(market)
        used_events.add(event)
        if len(roots) >= count:
            return roots
    return ranked[:count]


async def choose_dynamic_roots(markets: list[dict[str, Any]], count: int = 3) -> list[dict[str, Any]]:
    if not AI_API_KEY:
        return fallback_roots(markets, count)

    candidates = sorted(
        markets,
        key=lambda market: _as_float(market.get("volumeNum", market.get("volume")), 0.0),
        reverse=True,
    )[:80]
    prompt = {
        "task": (
            "Select live Polymarket root markets for a causal event-propagation demo. "
            "Choose markets that can plausibly affect other markets and are not just duplicate thresholds."
        ),
        "return_json_schema": {
            "roots": [
                {
                    "id": "market id from candidates",
                    "title": "short scenario title",
                    "summary": "why this root market is worth a causal scenario",
                }
            ]
        },
        "candidate_markets": [_compact_market(market) for market in candidates],
        "count": count,
    }
    headers = {"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"}
    body = {
        "model": AI_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "Return strict JSON. Use only candidate market ids. Prefer diverse politics, macro, crypto, geopolitics, and tech roots.",
            },
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(f"{AI_BASE_URL}/chat/completions", headers=headers, json=body)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            payload = json.loads(content)
    except Exception:
        return fallback_roots(markets, count)

    by_id = {_market_id(market): market for market in markets}
    roots: list[dict[str, Any]] = []
    for item in payload.get("roots", []):
        market = by_id.get(str(item.get("id")))
        if market and market not in roots:
            market["_aiScenarioTitle"] = item.get("title")
            market["_aiScenarioSummary"] = item.get("summary")
            roots.append(market)
        if len(roots) >= count:
            break
    return roots or fallback_roots(markets, count)


async def related_markets_for_root(root_market: dict[str, Any], pool: list[dict[str, Any]], count: int = 6) -> list[dict[str, Any]]:
    root_question = str(root_market.get("question", ""))
    event_title = _event_title(root_market)
    queries = [root_question, event_title, " ".join(_extract_keywords(root_question, 4))]
    query_results = await asyncio.gather(
        *(public_search_markets(query, limit=12) for query in queries if query),
        return_exceptions=True,
    )

    candidates = [root_market]
    for result in query_results:
        if not isinstance(result, Exception):
            candidates.extend(result)
    candidates.extend(pool)
    candidates = _dedupe_markets(candidates)

    root_terms = tuple(_extract_keywords(f"{root_question} {event_title}", 10))
    ranked = sorted(
        [market for market in candidates if _market_id(market) != _market_id(root_market)],
        key=lambda market: (
            _keyword_score(f"{market.get('question', '')} {_event_title(market)}", root_terms),
            _as_float(market.get("volumeNum", market.get("volume")), 0.0),
        ),
        reverse=True,
    )
    return [root_market, *ranked[: count - 1]]


async def fetch_seed_markets(seed: ScenarioSeed) -> list[dict[str, Any]]:
    queries = SCENARIO_SEARCH_QUERIES.get(seed.id, (" ".join(seed.root_terms),))
    results = await asyncio.gather(*(public_search_markets(query, limit=12) for query in queries), return_exceptions=True)

    markets: list[dict[str, Any]] = []
    seen: set[str] = set()
    for result in results:
        if isinstance(result, Exception):
            continue
        for market in result:
            market_id = str(market.get("id"))
            if market_id not in seen:
                markets.append(market)
                seen.add(market_id)

    if len(markets) < 6:
        active = await fetch_active_markets(limit=300)
        markets.extend([market for market in active if str(market.get("id")) not in seen])
    return markets


def select_markets(markets: list[dict[str, Any]], seed: ScenarioSeed, count: int = 6) -> list[dict[str, Any]]:
    ranked = sorted(
        markets,
        key=lambda market: (
            _keyword_score(str(market.get("question", "")), seed.candidate_terms),
            _as_float(market.get("volumeNum", market.get("volume")), 0.0),
        ),
        reverse=True,
    )
    selected = [market for market in ranked if _keyword_score(str(market.get("question", "")), seed.candidate_terms) > 0]
    if len(selected) < count:
        selected.extend([market for market in ranked if market not in selected])

    root_candidates = sorted(
        selected[: max(20, count)],
        key=lambda market: (
            _keyword_score(str(market.get("question", "")), seed.root_terms),
            _as_float(market.get("volumeNum", market.get("volume")), 0.0),
        ),
        reverse=True,
    )
    root = root_candidates[0]
    rest = [market for market in selected if market is not root][: count - 1]
    return [root, *rest]


def heuristic_edges(nodes: list[GraphNode], seed: ScenarioSeed) -> tuple[list[GraphEdge], list[ScenarioStep]]:
    root = nodes[0]
    edges: list[GraphEdge] = []
    first_layer_ids: list[str] = []
    second_layer_ids: list[str] = []

    for index, node in enumerate(nodes[1:], start=1):
        direction: Direction = "up"
        if re.search(r"\b(no|not|below|down|against|fail|recession)\b", node.question.lower()):
            direction = "down" if index % 2 else "uncertain"
        elif index % 4 == 0:
            direction = "uncertain"

        high = 0.04 + min(index, 4) * 0.02
        low = max(0.02, high - 0.04)
        if direction == "down":
            delta = (-high, -low)
        elif direction == "uncertain":
            delta = (-0.02, high / 2)
        else:
            delta = (low, high)

        source = root.id if index <= 3 else nodes[index - 2].id
        edge = GraphEdge(
            id=f"edge-{source}-{node.id}",
            source=source,
            target=node.id,
            direction=direction,
            strength="strong" if index == 1 else "medium" if index <= 3 else "weak",
            confidence=max(0.48, 0.78 - index * 0.05),
            deltaRange=delta,
            explanation=(
                f"Live Polymarket market selected from Gamma for the {seed.title} demo. "
                f"The current YES price is {node.price:.0%}; this edge is a provisional causal link until AI analysis is enabled."
            ),
            evidenceUrls=["https://gamma-api.polymarket.com"],
        )
        edges.append(edge)
        if index <= 3:
            first_layer_ids.append(node.id)
        else:
            second_layer_ids.append(node.id)

    steps = [
        ScenarioStep(
            id=f"{seed.id}-live-step-1",
            title="Live markets selected from Polymarket Gamma",
            sourceNodeId=root.id,
            edgeIds=[edge.id for edge in edges[:3]],
            impactedNodeIds=first_layer_ids,
            narrative="The backend pulled active Polymarket markets, selected the strongest keyword and volume matches, and activated the first propagation layer.",
        )
    ]
    if second_layer_ids:
        steps.append(
            ScenarioStep(
                id=f"{seed.id}-live-step-2",
                title="Second-order links are staged for AI review",
                sourceNodeId=nodes[2].id if len(nodes) > 2 else root.id,
                edgeIds=[edge.id for edge in edges[3:]],
                impactedNodeIds=second_layer_ids,
                narrative="Later branches are kept lower confidence unless the AI agent returns stronger causal evidence.",
            )
        )
    return edges, steps


def build_scenario_from_markets(seed: ScenarioSeed, markets: list[dict[str, Any]]) -> ScenarioPreset:
    selected = select_markets(markets, seed)
    nodes = [_node_from_market(market, index) for index, market in enumerate(selected)]
    edges, steps = heuristic_edges(nodes, seed)
    return ScenarioPreset(
        id=seed.id,
        title=seed.title,
        subtitle=seed.subtitle,
        summary=seed.summary,
        rootNodeId=nodes[0].id,
        nodes=nodes,
        edges=edges,
        steps=steps,
    )


def build_dynamic_scenario(root_market: dict[str, Any], markets: list[dict[str, Any]], evidence: list[EvidenceItem]) -> ScenarioPreset:
    nodes = [_node_from_market(market, index) for index, market in enumerate(markets)]
    root = nodes[0]
    root_title = str(root_market.get("_aiScenarioTitle") or _event_title(root_market) or root.question)
    summary = str(
        root_market.get("_aiScenarioSummary")
        or "AI selected this live Polymarket market as a root condition and searched related markets plus recent news evidence."
    )
    evidence_urls = [item.url for item in evidence[:3]] or ["https://gamma-api.polymarket.com"]

    edges: list[GraphEdge] = []
    first_layer_ids: list[str] = []
    second_layer_ids: list[str] = []
    root_terms = tuple(_extract_keywords(f"{root.question} {root_title}", 10))
    for index, node in enumerate(nodes[1:], start=1):
        text = node.question.lower()
        direction: Direction = "up"
        if any(term in text for term in ("no ", "not ", "below", "less than", "down", "fail", "recession")):
            direction = "down"
        elif index % 4 == 0 or _keyword_score(node.question, root_terms) <= 2:
            direction = "uncertain"

        high = 0.03 + min(index, 4) * 0.015
        low = max(0.01, high - 0.035)
        delta: tuple[float, float]
        if direction == "down":
            delta = (-high, -low)
        elif direction == "uncertain":
            delta = (-0.02, high)
        else:
            delta = (low, high)

        source = root.id if index <= 3 else nodes[index - 2].id
        edge = GraphEdge(
            id=f"edge-{source}-{node.id}",
            source=source,
            target=node.id,
            direction=direction,
            strength="medium" if index <= 3 else "weak",
            confidence=max(0.42, 0.72 - index * 0.04),
            deltaRange=delta,
            explanation=(
                "Provisional link from live Polymarket discovery. AI refinement will judge whether this is causal, "
                "merely correlated, or should be weakened by contradictory evidence."
            ),
            evidenceUrls=evidence_urls,
        )
        edges.append(edge)
        if index <= 3:
            first_layer_ids.append(node.id)
        else:
            second_layer_ids.append(node.id)

    steps = [
        ScenarioStep(
            id=f"dynamic-{_market_id(root_market)}-step-1",
            title="AI-selected live root market",
            sourceNodeId=root.id,
            edgeIds=[edge.id for edge in edges[:3]],
            impactedNodeIds=first_layer_ids,
            narrative="The backend selected this root from current Polymarket markets, fetched related markets, and attached recent news evidence before causal scoring.",
        )
    ]
    if second_layer_ids:
        steps.append(
            ScenarioStep(
                id=f"dynamic-{_market_id(root_market)}-step-2",
                title="Second-order market propagation",
                sourceNodeId=nodes[2].id if len(nodes) > 2 else root.id,
                edgeIds=[edge.id for edge in edges[3:]],
                impactedNodeIds=second_layer_ids,
                narrative="The second layer links markets that may be affected indirectly through the first-order outcome and related news flow.",
            )
        )

    return ScenarioPreset(
        id=f"pm-{_market_id(root_market)}",
        title=root_title[:64],
        subtitle=f"Live PM root: {root.question}",
        summary=summary,
        rootNodeId=root.id,
        nodes=nodes,
        edges=edges,
        steps=steps,
        evidence=evidence,
    )


async def analyze_with_ai(scenario: ScenarioPreset) -> ScenarioPreset:
    if not AI_API_KEY:
        return scenario.model_copy(update={"aiStatus": "failed", "aiError": "AI_API_KEY is not configured"})

    prompt = {
        "task": "Refine causal edges for a Polymarket event propagation demo. Return strict JSON only.",
        "schema": {
            "edges": [
                {
                    "id": "existing edge id",
                    "direction": "up|down|uncertain",
                    "strength": "weak|medium|strong",
                    "confidence": 0.0,
                    "deltaRange": [0.0, 0.0],
                    "explanation": "short evidence-grounded explanation",
                }
            ]
        },
        "scenario": scenario.model_dump(),
        "recent_news_evidence": [item.model_dump() for item in scenario.evidence[:8]],
    }
    headers = {"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"}
    body = {
        "model": AI_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a cautious prediction-market causal analyst. Use the provided Polymarket questions, "
                    "prices, and recent news evidence. Penalize keyword-only relationships. Return strict JSON."
                ),
            },
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(f"{AI_BASE_URL}/chat/completions", headers=headers, json=body)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            payload = json.loads(content)
    except Exception as exc:
        return scenario.model_copy(update={"aiStatus": "failed", "aiError": f"{type(exc).__name__}: {exc}"[:180]})

    updates = {edge["id"]: edge for edge in payload.get("edges", []) if isinstance(edge, dict) and "id" in edge}
    refined_edges: list[GraphEdge] = []
    for edge in scenario.edges:
        update = updates.get(edge.id, {})
        refined_edges.append(
            edge.model_copy(
                update={
                    key: update[key]
                    for key in ("direction", "strength", "confidence", "deltaRange", "explanation")
                    if key in update
                }
            )
        )
    return scenario.model_copy(update={"edges": refined_edges, "source": "polymarket-gamma-ai", "aiStatus": "refined"})


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "polymarket_gamma": GAMMA_BASE_URL,
        "ai_base_url_configured": bool(AI_BASE_URL),
        "ai_key_configured": bool(AI_API_KEY),
        "ai_model": AI_MODEL,
    }


@app.get("/api/markets/search", response_model=list[MarketSearchResult])
async def search_markets(q: str = Query("", max_length=120), limit: int = Query(20, ge=1, le=100)):
    markets = await public_search_markets(q, limit=limit) if q.strip() else await fetch_active_markets(limit=250)
    terms = tuple(term for term in re.split(r"\s+", q.lower().strip()) if term)
    if terms and not markets:
        active = await fetch_active_markets(limit=250)
        markets = [market for market in active if _keyword_score(str(market.get("question", "")), terms) > 0]
    markets = sorted(markets, key=lambda market: _as_float(market.get("volumeNum", market.get("volume")), 0.0), reverse=True)
    return [
        MarketSearchResult(
            id=str(market.get("id")),
            question=str(market.get("question", "")),
            category=_market_category(market),
            price=_market_price(market),
            volume=_as_float(market.get("volumeNum", market.get("volume")), 0.0),
            slug=market.get("slug"),
            endDate=market.get("endDate"),
        )
        for market in markets[:limit]
    ]


@app.get("/api/markets/universe", response_model=list[UniverseMarket])
async def market_universe(limit: int = Query(60, ge=12, le=120)):
    markets = await discover_market_pool()
    ranked = sorted(
        markets,
        key=lambda market: (
            _as_float(market.get("volume24hr", 0.0)),
            _as_float(market.get("volumeNum", market.get("volume")), 0.0),
        ),
        reverse=True,
    )
    caps = {
        "politics": 14,
        "macro": 12,
        "crypto": 12,
        "geopolitics": 12,
        "ai": 8,
        "sports": 8,
        "other": 8,
    }
    counts = {key: 0 for key in caps}
    selected: list[dict[str, Any]] = []
    for market in ranked:
        cluster = _market_cluster(market)
        if counts[cluster] >= caps[cluster]:
            continue
        selected.append(market)
        counts[cluster] += 1
        if len(selected) >= limit:
            break
    return [_universe_item(market) for market in selected[:limit]]


@app.post("/api/scenario/generate", response_model=ScenarioPreset)
async def generate_scenario(request: ScenarioGenerateRequest):
    pool = await discover_market_pool()
    root_id = request.root_market_id.removeprefix("pm-")
    root = next((market for market in pool if _market_id(market) == root_id), None)
    if root is None:
        searches = await asyncio.gather(
            *(public_search_markets(term, limit=12) for term in _extract_keywords(request.root_market_id, 4)),
            return_exceptions=True,
        )
        extra: list[dict[str, Any]] = []
        for result in searches:
            if not isinstance(result, Exception):
                extra.extend(result)
        pool = _dedupe_markets([*pool, *extra])
        root = next((market for market in pool if _market_id(market) == root_id), None)
    if root is None:
        raise HTTPException(status_code=404, detail="Root market not found in live universe")

    related = await related_markets_for_root(root, pool, count=7)
    evidence_query = f"{root.get('question', '')} {_event_title(root)}"
    evidence = await fetch_news_evidence(evidence_query, limit=6)
    scenario = build_dynamic_scenario(root, related, evidence)
    if request.use_ai:
        scenario = await analyze_with_ai(scenario)
    return scenario


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.post("/api/scenario/generate/stream")
async def generate_scenario_stream(request: ScenarioGenerateRequest):
    async def stream():
        try:
            pool = await discover_market_pool()
            root_id = request.root_market_id.removeprefix("pm-")
            root = next((market for market in pool if _market_id(market) == root_id), None)
            if root is None:
                searches = await asyncio.gather(
                    *(public_search_markets(term, limit=12) for term in _extract_keywords(request.root_market_id, 4)),
                    return_exceptions=True,
                )
                extra: list[dict[str, Any]] = []
                for result in searches:
                    if not isinstance(result, Exception):
                        extra.extend(result)
                pool = _dedupe_markets([*pool, *extra])
                root = next((market for market in pool if _market_id(market) == root_id), None)
            if root is None:
                yield _sse({"type": "error", "step": 0, "message": "Root market not found in live Polymarket universe"})
                return

            root_item = _universe_item(root).model_dump(mode="json")
            yield _sse(
                {
                    "type": "root",
                    "step": 0,
                    "message": f"Locked live PM root: {root_item['question']}",
                    "data": {"root": root_item},
                }
            )

            related = await related_markets_for_root(root, pool, count=7)
            related_items = [_universe_item(market).model_dump(mode="json") for market in related[1:]]
            yield _sse(
                {
                    "type": "related",
                    "step": 1,
                    "message": f"Found {len(related_items)} related Polymarket markets from live Gamma/search pool",
                    "data": {"markets": related_items},
                }
            )

            evidence_query = f"{root.get('question', '')} {_event_title(root)}"
            evidence = await fetch_news_evidence(evidence_query, limit=6)
            yield _sse(
                {
                    "type": "evidence",
                    "step": 2,
                    "message": f"Fetched {len(evidence)} recent news evidence items for: {evidence_query[:96]}",
                    "data": {"evidence": [item.model_dump(mode="json") for item in evidence]},
                }
            )

            scenario = build_dynamic_scenario(root, related, evidence)
            yield _sse(
                {
                    "type": "draft",
                    "step": 4,
                    "message": f"Drafted {len(scenario.edges)} causal edges across {len(scenario.nodes)} PM nodes",
                    "data": {"edgeCount": len(scenario.edges), "nodeCount": len(scenario.nodes)},
                }
            )

            if request.use_ai:
                yield _sse(
                    {
                        "type": "ai",
                        "step": 5,
                        "message": f"Sending causal draft to {AI_MODEL} for direction, confidence, and delta review",
                        "data": {"aiStatus": "disabled" if not AI_API_KEY else scenario.aiStatus},
                    }
                )
                scenario = await analyze_with_ai(scenario)
                yield _sse(
                    {
                        "type": "ai",
                        "step": 5,
                        "message": "AI review completed" if scenario.aiStatus == "refined" else "AI review failed",
                        "data": {"aiStatus": scenario.aiStatus, "aiError": scenario.aiError},
                    }
                )

            yield _sse(
                {
                    "type": "done",
                    "step": 5,
                    "message": "Playable causal scenario is ready",
                    "scenario": scenario.model_dump(mode="json"),
                }
            )
        except Exception as exc:
            yield _sse({"type": "error", "step": 0, "message": f"{type(exc).__name__}: {exc}"[:220]})

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.get("/api/graph/scenario-presets", response_model=list[ScenarioPreset])
async def scenario_presets(use_ai: bool = False):
    cache_key = f"dynamic:{use_ai}"
    cached = SCENARIO_CACHE.get(cache_key)
    if cached and time.time() - cached[0] < SCENARIO_CACHE_SECONDS:
        return cached[1]

    pool = await discover_market_pool()
    roots = await choose_dynamic_roots(pool, count=3)

    async def build_for_root(root: dict[str, Any]) -> ScenarioPreset:
        related = await related_markets_for_root(root, pool, count=6)
        evidence_query = f"{root.get('question', '')} {_event_title(root)}"
        evidence = await fetch_news_evidence(evidence_query, limit=5)
        scenario = build_dynamic_scenario(root, related, evidence)
        if use_ai:
            return await analyze_with_ai(scenario)
        return scenario

    scenarios = await asyncio.gather(*(build_for_root(root) for root in roots))
    result = list(scenarios)
    SCENARIO_CACHE[cache_key] = (time.time(), result)
    return result


@app.get("/api/graph/scripted-scenarios", response_model=list[ScenarioPreset])
async def scripted_scenario_presets(use_ai: bool = False):
    cache_key = f"scripted:{use_ai}"
    cached = SCENARIO_CACHE.get(cache_key)
    if cached and time.time() - cached[0] < SCENARIO_CACHE_SECONDS:
        return cached[1]

    seed_markets = await asyncio.gather(*(fetch_seed_markets(seed) for seed in SCENARIO_SEEDS.values()))
    scenarios = [
        build_scenario_from_markets(seed, markets)
        for seed, markets in zip(SCENARIO_SEEDS.values(), seed_markets, strict=True)
    ]
    if use_ai:
        scenarios = await asyncio.gather(*(analyze_with_ai(scenario) for scenario in scenarios))
    result = list(scenarios)
    SCENARIO_CACHE[cache_key] = (time.time(), result)
    return result


@app.post("/api/scenario/run", response_model=ScenarioPreset)
async def run_scenario(request: ScenarioRunRequest):
    seed = SCENARIO_SEEDS.get(request.scenario_id)
    if not seed:
        raise HTTPException(status_code=404, detail="Unknown scenario_id")
    markets = await fetch_seed_markets(seed)
    scenario = build_scenario_from_markets(seed, markets)
    if request.use_ai:
        scenario = await analyze_with_ai(scenario)
    return scenario


@app.get("/api/scenario/{scenario_id}/stream")
async def stream_scenario(scenario_id: str, use_ai: bool = False):
    scenario = await run_scenario(ScenarioRunRequest(scenario_id=scenario_id, use_ai=use_ai))

    async def event_stream():
        yield f"event: scenario\ndata: {scenario.model_dump_json()}\n\n"
        for step in scenario.steps:
            await asyncio.sleep(0.8)
            yield f"event: step\ndata: {step.model_dump_json()}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/node/{node_id}")
async def node_detail(node_id: str):
    markets = await fetch_active_markets(limit=300)
    raw_id = node_id.removeprefix("pm-")
    for market in markets:
        if str(market.get("id")) == raw_id:
            return market
    raise HTTPException(status_code=404, detail="Node not found in latest Gamma pull")


@app.get("/api/edge/{edge_id}")
async def edge_detail(edge_id: str):
    for seed in SCENARIO_SEEDS.values():
        scenario = build_scenario_from_markets(seed, await fetch_active_markets(limit=300))
        for edge in scenario.edges:
            if edge.id == edge_id:
                return edge
    raise HTTPException(status_code=404, detail="Edge not found")
