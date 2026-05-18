from __future__ import annotations

import html
import json
import math
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "causeway.sqlite3"
GAMMA_MARKETS_URL = "https://gamma-api.polymarket.com/markets"
GAMMA_EVENTS_URL = "https://gamma-api.polymarket.com/events"
CLOB_PRICES_HISTORY_URL = "https://clob.polymarket.com/batch-prices-history"
MAX_NETWORK_MARKETS = 25
DEFAULT_SYNC_LIMIT = 1000
DEFAULT_AI_CONFIG = {
    "baseUrls": ["https://api.deepseek.com"],
    "apiKey": "",
    "apiFormat": "openai",
    "modelPriority": ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-reasoner", "deepseek-chat"],
    "reasoningEffort": "high",
    "thinking": {"type": "enabled"},
    "timeoutSeconds": 90,
    "enableWebSearch": True,
}
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)
STOPWORDS = {
    "the",
    "and",
    "will",
    "what",
    "when",
    "with",
    "this",
    "that",
    "before",
    "after",
    "from",
    "have",
    "does",
    "may",
    "june",
    "july",
    "august",
    "2024",
    "2025",
    "2026",
}

CATEGORY_DEFS = [
    {
        "key": "politics",
        "label": "政治",
        "keywords": (
            "politics",
            "political",
            "election",
            "elections",
            "trump",
            "biden",
            "president",
            "senate",
            "congress",
            "government",
            "geopolitics",
        ),
    },
    {
        "key": "macro",
        "label": "宏观",
        "keywords": (
            "economy",
            "economics",
            "finance",
            "markets",
            "stocks",
            "fed",
            "federal reserve",
            "inflation",
            "cpi",
            "gdp",
            "rates",
            "recession",
        ),
    },
    {
        "key": "crypto",
        "label": "加密",
        "keywords": (
            "crypto",
            "cryptocurrency",
            "bitcoin",
            "btc",
            "ethereum",
            "eth",
            "solana",
            "xrp",
            "doge",
            "token",
            "blockchain",
        ),
    },
    {
        "key": "tech",
        "label": "科技",
        "keywords": (
            "technology",
            "tech",
            "ai",
            "artificial intelligence",
            "openai",
            "nvidia",
            "apple",
            "google",
            "tesla",
            "spacex",
            "software",
        ),
    },
    {
        "key": "sports",
        "label": "体育",
        "keywords": (
            "sports",
            "soccer",
            "football",
            "basketball",
            "baseball",
            "tennis",
            "nba",
            "nfl",
            "mlb",
            "ufc",
            "fifa",
            "league",
            "premier league",
            "champions league",
            "counter-strike",
            "cs2",
            "lol",
            "lck",
            "esports",
        ),
    },
    {
        "key": "entertainment",
        "label": "娱乐",
        "keywords": (
            "entertainment",
            "pop culture",
            "celebrity",
            "music",
            "movie",
            "movies",
            "film",
            "tv",
            "oscars",
            "grammy",
            "culture",
        ),
    },
]

CATEGORY_LABEL_BY_KEY = {definition["key"]: definition["label"] for definition in CATEGORY_DEFS}
CATEGORY_KEY_BY_LABEL = {definition["label"]: definition["key"] for definition in CATEGORY_DEFS}
CATEGORY_KEY_BY_LABEL.update({"全部": "all", "热门": "hot", "其他": "other"})
QUERY_ALIASES = {
    "以色列": ("israel",),
    "巴勒斯坦": ("palestine", "gaza"),
    "加沙": ("gaza",),
    "伊朗": ("iran",),
    "叙利亚": ("syria",),
    "特朗普": ("trump",),
    "拜登": ("biden",),
    "美国": ("us", "usa", "america"),
    "总统": ("president",),
    "选举": ("election",),
    "比特币": ("bitcoin", "btc"),
    "以太坊": ("ethereum", "eth"),
    "加密": ("crypto",),
    "科技": ("technology", "tech"),
    "人工智能": ("ai", "artificial intelligence"),
    "体育": ("sports",),
    "足球": ("soccer", "football"),
    "娱乐": ("entertainment", "culture"),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS markets (
              id TEXT PRIMARY KEY,
              slug TEXT,
              question TEXT NOT NULL,
              event_id TEXT,
              event_slug TEXT,
              event_title TEXT,
              category TEXT,
              category_key TEXT,
              category_label TEXT,
              tags_json TEXT,
              icon TEXT,
              image TEXT,
              end_date TEXT,
              volume REAL,
              volume_24hr REAL,
              liquidity REAL,
              price REAL,
              outcomes_json TEXT,
              description TEXT,
              rules TEXT,
              accepting_orders INTEGER,
              active INTEGER,
              closed INTEGER,
              updated_at TEXT,
              synced_at TEXT NOT NULL,
              raw_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS events (
              id TEXT PRIMARY KEY,
              slug TEXT,
              title TEXT NOT NULL,
              category TEXT,
              category_key TEXT,
              category_label TEXT,
              tags_json TEXT,
              icon TEXT,
              image TEXT,
              end_date TEXT,
              volume REAL,
              volume_24hr REAL,
              liquidity REAL,
              description TEXT,
              rules TEXT,
              markets_count INTEGER,
              active INTEGER,
              closed INTEGER,
              updated_at TEXT,
              synced_at TEXT NOT NULL,
              raw_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS market_edges (
              id TEXT PRIMARY KEY,
              source TEXT NOT NULL,
              target TEXT NOT NULL,
              relation_type TEXT NOT NULL,
              weight REAL NOT NULL,
              reason TEXT NOT NULL,
              FOREIGN KEY(source) REFERENCES markets(id),
              FOREIGN KEY(target) REFERENCES markets(id)
            );

            """
        )
        existing_columns = {row["name"] for row in conn.execute("PRAGMA table_info(markets)").fetchall()}
        migrations = {
            "event_slug": "ALTER TABLE markets ADD COLUMN event_slug TEXT",
            "category_key": "ALTER TABLE markets ADD COLUMN category_key TEXT",
            "category_label": "ALTER TABLE markets ADD COLUMN category_label TEXT",
            "tags_json": "ALTER TABLE markets ADD COLUMN tags_json TEXT",
        }
        for column, statement in migrations.items():
            if column not in existing_columns:
                conn.execute(statement)
        conn.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_markets_active_category
              ON markets(active, closed, category_key, volume_24hr, volume);
            CREATE INDEX IF NOT EXISTS idx_market_edges_weight
              ON market_edges(weight);
            CREATE INDEX IF NOT EXISTS idx_markets_event
              ON markets(active, closed, event_id, event_slug);
            CREATE INDEX IF NOT EXISTS idx_markets_slug
              ON markets(slug);
            CREATE INDEX IF NOT EXISTS idx_events_slug
              ON events(slug);
            CREATE INDEX IF NOT EXISTS idx_events_active
              ON events(active, closed, category_key, volume_24hr, volume);
            """
        )


def parse_jsonish(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return fallback
    return fallback


def as_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def first_event(item: dict[str, Any]) -> dict[str, Any]:
    events = item.get("events")
    if isinstance(events, list) and events:
        return events[0] if isinstance(events[0], dict) else {}
    return {}


def normalize_term(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def expand_query_terms(value: str) -> list[str]:
    normalized = normalize_term(value)
    terms = [normalized] if normalized else []
    lowered_source = str(value or "").lower()
    for needle, aliases in QUERY_ALIASES.items():
        if needle in value or needle.lower() in lowered_source or normalized == normalize_term(needle):
            terms.extend(normalize_term(alias) for alias in aliases)
    deduped: list[str] = []
    seen: set[str] = set()
    for term in terms:
        if term and term not in seen:
            seen.add(term)
            deduped.append(term)
    return deduped


def tag_label(tag: Any) -> str | None:
    if isinstance(tag, dict):
        for key in ("label", "name", "slug"):
            value = tag.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    if isinstance(tag, str) and tag.strip():
        return tag.strip()
    return None


def official_terms(item: dict[str, Any], event: dict[str, Any] | None = None) -> list[str]:
    terms: list[str] = []
    for source in (item, event or first_event(item)):
        tags = source.get("tags")
        if isinstance(tags, list):
            for tag in tags:
                label = tag_label(tag)
                if label:
                    terms.append(label)
        category = source.get("category")
        if isinstance(category, str) and category:
            terms.append(category)
    deduped: list[str] = []
    seen: set[str] = set()
    for term in terms:
        normalized = normalize_term(term)
        if normalized and normalized not in seen:
            seen.add(normalized)
            deduped.append(term)
    return deduped


def extract_official_category(item: dict[str, Any], event: dict[str, Any] | None = None) -> str | None:
    terms = official_terms(item, event)
    return terms[0] if terms else None


def keyword_matches(text: str, keyword: str) -> bool:
    if len(keyword) <= 3 and keyword.isalnum():
        return re.search(rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])", text) is not None
    return keyword in text


def classify_market(item: dict[str, Any], terms: list[str], event: dict[str, Any] | None = None) -> tuple[str, str]:
    event_item = event or first_event(item)
    official_text = " ".join(normalize_term(term) for term in terms)
    fallback_text = normalize_term(
        " ".join(
            str(part or "")
            for part in (
                item.get("question"),
                item.get("title"),
                event_item.get("title"),
            )
        )
    )
    combined = f"{official_text} {fallback_text}"
    for definition in CATEGORY_DEFS:
        if any(keyword_matches(combined, keyword) for keyword in definition["keywords"]):
            return definition["key"], definition["label"]
    return "other", "其他"


def event_record(item: dict[str, Any]) -> tuple[Any, ...]:
    terms = official_terms(item)
    category_key, category_label = classify_market(item, terms)
    event_payload = {key: value for key, value in item.items() if key != "markets"}
    return (
        str(item.get("id")),
        item.get("slug") or item.get("ticker"),
        item.get("title") or "Untitled event",
        extract_official_category(item),
        category_key,
        category_label,
        json.dumps(terms, ensure_ascii=False),
        item.get("icon") or item.get("image"),
        item.get("image") or item.get("icon"),
        item.get("endDate"),
        as_float(item.get("volume")),
        as_float(item.get("volume24hr")),
        as_float(item.get("liquidity") or item.get("liquidityClob")),
        item.get("description"),
        item.get("resolutionSource"),
        len(item.get("markets") or []),
        1 if item.get("active") else 0,
        1 if item.get("closed") else 0,
        item.get("updatedAt"),
        utc_now(),
        json.dumps(event_payload, ensure_ascii=False),
    )


def market_record(item: dict[str, Any], parent_event: dict[str, Any] | None = None) -> tuple[Any, ...]:
    event = parent_event or first_event(item)
    terms = official_terms(item, event)
    category_key, category_label = classify_market(item, terms, event)
    outcomes = parse_jsonish(item.get("outcomes"), [])
    prices = parse_jsonish(item.get("outcomePrices"), [])
    clob_ids = parse_jsonish(item.get("clobTokenIds"), [])
    normalized_outcomes = []
    for index, label in enumerate(outcomes):
        price = as_float(prices[index]) if index < len(prices) else None
        normalized_outcomes.append(
            {
                "label": label,
                "price": price,
                "tokenId": clob_ids[index] if index < len(clob_ids) else None,
            }
        )
    first_price = normalized_outcomes[0]["price"] if normalized_outcomes else None
    return (
        str(item.get("id")),
        item.get("slug"),
        item.get("question") or item.get("title") or "Untitled market",
        str(event.get("id")) if event.get("id") is not None else None,
        event.get("slug") or event.get("ticker"),
        event.get("title"),
        extract_official_category(item, event),
        category_key,
        category_label,
        json.dumps(terms, ensure_ascii=False),
        item.get("icon") or event.get("icon"),
        item.get("image") or event.get("image"),
        item.get("endDate") or item.get("endDateIso") or event.get("endDate"),
        as_float(item.get("volumeNum") or item.get("volume")),
        as_float(item.get("volume24hr") or item.get("volume24hrClob")),
        as_float(item.get("liquidityNum") or item.get("liquidity")),
        first_price,
        json.dumps(normalized_outcomes, ensure_ascii=False),
        item.get("description") or event.get("description"),
        item.get("rules") or item.get("resolutionSource") or event.get("resolutionSource"),
        1 if item.get("acceptingOrders") else 0,
        1 if item.get("active") else 0,
        1 if item.get("closed") else 0,
        item.get("updatedAt") or event.get("updatedAt"),
        utc_now(),
        json.dumps(item, ensure_ascii=False),
    )


def fetch_gamma_markets(limit: int) -> list[dict[str, Any]]:
    requested = min(max(limit, 20), 2500)
    page_size = 500
    offset = 0
    items: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    while len(items) < requested:
        page_limit = min(page_size, requested - len(items))
        params = urllib.parse.urlencode(
            {
                "active": "true",
                "closed": "false",
                "limit": page_limit,
                "offset": offset,
                "order": "volume24hr",
                "ascending": "false",
            }
        )
        request = urllib.request.Request(
            f"{GAMMA_MARKETS_URL}?{params}",
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if not isinstance(payload, list):
            raise RuntimeError("Unexpected Polymarket Gamma response")
        page = [item for item in payload if isinstance(item, dict)]
        if not page:
            break
        new_items = []
        for item in page:
            item_id = str(item.get("id"))
            if item_id in seen_ids:
                continue
            seen_ids.add(item_id)
            new_items.append(item)
        if not new_items:
            break
        items.extend(new_items)
        offset += len(page)
    return items[:requested]


def fetch_gamma_events(limit: int) -> list[dict[str, Any]]:
    requested = min(max(limit, 20), 2500)
    page_size = 200
    offset = 0
    items: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    while len(items) < requested:
        page_limit = min(page_size, requested - len(items))
        params = urllib.parse.urlencode(
            {
                "active": "true",
                "closed": "false",
                "limit": page_limit,
                "offset": offset,
                "order": "volume24hr",
                "ascending": "false",
            }
        )
        request = urllib.request.Request(
            f"{GAMMA_EVENTS_URL}?{params}",
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if not isinstance(payload, list):
            raise RuntimeError("Unexpected Polymarket Gamma events response")
        page = [item for item in payload if isinstance(item, dict)]
        if not page:
            break
        new_items = []
        for item in page:
            item_id = str(item.get("id"))
            if item_id in seen_ids:
                continue
            seen_ids.add(item_id)
            new_items.append(item)
        if not new_items:
            break
        items.extend(new_items)
        offset += len(page)
    return items[:requested]


def words(text: str) -> set[str]:
    return {part for part in re.findall(r"[a-zA-Z0-9]+", text.lower()) if len(part) > 2 and part not in STOPWORDS}


def end_ts(row: sqlite3.Row) -> float:
    value = row["end_date"]
    if not value:
        return math.inf
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return math.inf


def build_edges(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        """
        SELECT id, question, event_title, event_id, category, category_key, tags_json, volume, liquidity, price, end_date
        FROM markets
        WHERE active = 1 AND closed = 0
        ORDER BY COALESCE(volume_24hr, 0) DESC, COALESCE(volume, 0) DESC
        LIMIT 260
        """
    ).fetchall()
    conn.execute("DELETE FROM market_edges")
    inserted = 0
    seen: set[tuple[str, str]] = set()
    token_map = {
        row["id"]: words(
            " ".join(
                [
                    row["question"] or "",
                    row["event_title"] or "",
                    " ".join(str(tag) for tag in parse_jsonish(row["tags_json"], [])),
                ]
            )
        )
        for row in rows
    }
    tag_map = {
        row["id"]: {normalize_term(tag) for tag in parse_jsonish(row["tags_json"], []) if normalize_term(tag)}
        for row in rows
    }
    for i, left in enumerate(rows):
        scored: list[tuple[float, sqlite3.Row, str, str]] = []
        for j, right in enumerate(rows):
            if i == j:
                continue
            relation = "semantic"
            reason = "标题语义关键词重叠"
            score = 0.0
            if left["event_id"] and left["event_id"] == right["event_id"]:
                relation = "event"
                reason = "同一个 Polymarket Event"
                score += 0.66
            tag_overlap = tag_map[left["id"]] & tag_map[right["id"]]
            if tag_overlap:
                relation = "tag" if relation == "semantic" else relation
                reason = "官方标签重叠"
                score += min(0.3, len(tag_overlap) * 0.12)
            if left["category_key"] and left["category_key"] == right["category_key"]:
                relation = "tag" if relation == "semantic" else relation
                if not tag_overlap and relation == "tag":
                    reason = "同一官方分类"
                score += 0.16
            overlap = token_map[left["id"]] & token_map[right["id"]]
            if overlap:
                score += min(0.28, len(overlap) * 0.07)
            left_price = left["price"] if left["price"] is not None else 0.5
            right_price = right["price"] if right["price"] is not None else 0.5
            score += max(0, 0.12 - abs(left_price - right_price) * 0.14)
            if score >= 0.26:
                scored.append((score, right, relation, reason))
        for score, right, relation, reason in sorted(scored, key=lambda item: item[0], reverse=True)[:3]:
            source, target = left, right
            if end_ts(right) < end_ts(left):
                source, target = right, left
            elif (right["volume"] or 0) > (left["volume"] or 0) * 1.8:
                source, target = right, left
            key = (source["id"], target["id"])
            if source["id"] == target["id"] or key in seen:
                continue
            seen.add(key)
            conn.execute(
                """
                INSERT OR REPLACE INTO market_edges
                  (id, source, target, relation_type, weight, reason)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    f"{source['id']}->{target['id']}",
                    source["id"],
                    target["id"],
                    relation,
                    round(min(score, 1.0), 3),
                    reason,
                ),
            )
            inserted += 1
    connected = {market_id for pair in seen for market_id in pair}
    ranked_rows = sorted(rows, key=lambda row: (row["volume"] or 0.0), reverse=True)
    if ranked_rows:
        hub = ranked_rows[0]
        for row in ranked_rows[1:]:
            if row["id"] in connected:
                continue
            source, target = hub, row
            if end_ts(row) < end_ts(hub):
                source, target = row, hub
            key = (source["id"], target["id"])
            if source["id"] == target["id"] or key in seen:
                continue
            seen.add(key)
            conn.execute(
                """
                INSERT OR REPLACE INTO market_edges
                  (id, source, target, relation_type, weight, reason)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    f"{source['id']}->{target['id']}",
                    source["id"],
                    target["id"],
                    "semantic",
                    0.18,
                    "焦点市场网络兜底连接",
                ),
            )
            inserted += 1
    conn.commit()
    print(f"rebuilt {inserted} market edges", file=sys.stderr)


def sync_markets(limit: int = DEFAULT_SYNC_LIMIT) -> dict[str, Any]:
    init_db()
    started = time.time()
    events = fetch_gamma_events(limit)
    top_markets = fetch_gamma_markets(min(limit, 1000))
    market_items: dict[str, tuple[dict[str, Any], dict[str, Any] | None]] = {}
    for event in events:
        for market in event.get("markets") or []:
            if not isinstance(market, dict) or market.get("id") is None:
                continue
            market_items[str(market.get("id"))] = (market, event)
    for market in top_markets:
        if not isinstance(market, dict) or market.get("id") is None:
            continue
        market_items.setdefault(str(market.get("id")), (market, None))
    with db() as conn:
        conn.execute("UPDATE events SET active = 0 WHERE active = 1")
        conn.execute("UPDATE markets SET active = 0 WHERE active = 1")
        conn.executemany(
            """
            INSERT OR REPLACE INTO events (
              id, slug, title, category, category_key, category_label, tags_json,
              icon, image, end_date, volume, volume_24hr, liquidity,
              description, rules, markets_count, active, closed, updated_at,
              synced_at, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [event_record(item) for item in events],
        )
        conn.executemany(
            """
            INSERT OR REPLACE INTO markets (
              id, slug, question, event_id, event_slug, event_title, category,
              category_key, category_label, tags_json, icon, image,
              end_date, volume, volume_24hr, liquidity, price, outcomes_json,
              description, rules, accepting_orders, active, closed, updated_at,
              synced_at, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [market_record(item, parent_event) for item, parent_event in market_items.values()],
        )
        build_edges(conn)
    return {
        "syncedEvents": len(events),
        "syncedMarkets": len(market_items),
        "elapsedSeconds": round(time.time() - started, 2),
        "source": {"events": GAMMA_EVENTS_URL, "markets": GAMMA_MARKETS_URL},
    }


def ensure_seed_data() -> None:
    init_db()
    with db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM markets").fetchone()[0]
        event_count = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
        missing_category_count = conn.execute(
            "SELECT COUNT(*) FROM markets WHERE active = 1 AND closed = 0 AND category_key IS NULL"
        ).fetchone()[0]
        missing_event_slug_count = conn.execute(
            "SELECT COUNT(*) FROM markets WHERE active = 1 AND closed = 0 AND event_id IS NOT NULL AND event_slug IS NULL"
        ).fetchone()[0]
    if count == 0 or event_count == 0 or missing_category_count or missing_event_slug_count:
        sync_markets(DEFAULT_SYNC_LIMIT)


def focus_network_positions(rows: list[sqlite3.Row], edges: list[Any]) -> dict[str, tuple[float, float]]:
    ids = [row["id"] for row in rows]
    id_set = set(ids)
    if not ids:
        return {}
    focus_id = ids[0]
    adjacency: dict[str, set[str]] = {market_id: set() for market_id in ids}
    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        if source in id_set and target in id_set and source != target:
            adjacency[source].add(target)
            adjacency[target].add(source)

    row_by_id = {row["id"]: row for row in rows}

    def priority(market_id: str) -> tuple[int, float, str]:
        row = row_by_id[market_id]
        return (len(adjacency[market_id]), row["volume"] or 0.0, row["question"])

    direct = [market_id for market_id in ids[1:] if market_id in adjacency[focus_id]]
    direct.sort(key=priority, reverse=True)
    if len(direct) < 8:
        for market_id in ids[1:]:
            if market_id not in direct:
                direct.append(market_id)
            if len(direct) >= 8:
                break
    inner = direct[:8]
    outer = [market_id for market_id in ids[1:] if market_id not in inner]
    outer.sort(key=priority, reverse=True)

    positions: dict[str, tuple[float, float]] = {focus_id: (50.0, 50.0)}

    def place_ring(market_ids: list[str], rx: float, ry: float, angle_offset: float) -> None:
        count = len(market_ids)
        if count == 0:
            return
        for index, market_id in enumerate(market_ids):
            angle = angle_offset + (2 * math.pi * index / count)
            x = 50.0 + math.cos(angle) * rx
            y = 50.0 + math.sin(angle) * ry
            positions[market_id] = (max(7.0, min(93.0, x)), max(14.0, min(86.0, y)))

    place_ring(inner, 27.0, 23.0, -math.pi / 2.0)
    place_ring(outer[:18], 42.0, 34.0, -math.pi / 2.0 + 0.22)

    # Small deterministic collision pass so same-event icons do not stack vertically.
    ordered = sorted([market_id for market_id in ids if market_id in positions], key=lambda market_id: positions[market_id][1])
    for left_index, left_id in enumerate(ordered):
        lx, ly = positions[left_id]
        for right_id in ordered[left_index + 1:]:
            rx, ry = positions[right_id]
            if abs(lx - rx) < 6.0 and abs(ly - ry) < 7.0:
                shift = 4.0 if ry >= ly else -4.0
                positions[right_id] = (rx, max(14.0, min(86.0, ry + shift)))
    return positions


def row_to_node(row: sqlite3.Row, position: tuple[float, float]) -> dict[str, Any]:
    x, y = position
    raw = parse_jsonish(row["raw_json"], {})
    return {
        "id": row["id"],
        "marketId": row["id"],
        "slug": row["slug"],
        "eventId": row["event_id"],
        "title": row["question"],
        "eventSlug": row["event_slug"],
        "eventTitle": row["event_title"],
        "category": row["category_label"] or row["category"] or "其他",
        "categoryKey": row["category_key"] or "other",
        "officialCategory": row["category"],
        "tags": parse_jsonish(row["tags_json"], []),
        "icon": row["icon"] or row["image"],
        "image": row["image"] or row["icon"],
        "price": row["price"],
        "volume": row["volume"],
        "volume24hr": row["volume_24hr"],
        "liquidity": row["liquidity"],
        "endDate": row["end_date"],
        "description": row["description"],
        "rules": row["rules"],
        "acceptingOrders": bool(row["accepting_orders"]),
        "outcomes": parse_jsonish(row["outcomes_json"], []),
        "groupItemTitle": raw.get("groupItemTitle") if isinstance(raw, dict) else None,
        "bestBid": as_float(raw.get("bestBid")) if isinstance(raw, dict) else None,
        "bestAsk": as_float(raw.get("bestAsk")) if isinstance(raw, dict) else None,
        "lastTradePrice": as_float(raw.get("lastTradePrice")) if isinstance(raw, dict) else None,
        "orderMinSize": as_float(raw.get("orderMinSize")) if isinstance(raw, dict) else None,
        "tickSize": as_float(raw.get("orderPriceMinTickSize")) if isinstance(raw, dict) else None,
        "updatedAt": row["updated_at"],
        "syncedAt": row["synced_at"],
        "x": round(max(5, min(95, x)), 2),
        "y": round(max(12, min(88, y)), 2),
    }


def resolve_category_key(value: str | None) -> str:
    normalized = (value or "").strip()
    if not normalized:
        return ""
    lowered = normalized.lower()
    if lowered in ("all", "hot"):
        return lowered
    if lowered in CATEGORY_LABEL_BY_KEY:
        return lowered
    return CATEGORY_KEY_BY_LABEL.get(normalized, lowered)


def market_categories() -> dict[str, Any]:
    ensure_seed_data()
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM markets WHERE active = 1 AND closed = 0").fetchone()[0]
        rows = conn.execute(
            """
            SELECT COALESCE(category_key, 'other') AS key, COUNT(*) AS count
            FROM markets
            WHERE active = 1 AND closed = 0
            GROUP BY COALESCE(category_key, 'other')
            """
        ).fetchall()
    counts = {row["key"]: row["count"] for row in rows}
    categories = [
        {"key": "all", "label": "全部", "count": total},
        {"key": "hot", "label": "热门", "count": total},
    ]
    for definition in CATEGORY_DEFS:
        count = counts.get(definition["key"], 0)
        if count:
            categories.append({"key": definition["key"], "label": definition["label"], "count": count})
    other_count = counts.get("other", 0)
    if other_count:
        categories.append({"key": "other", "label": "其他", "count": other_count})
    return {"categories": categories, "generatedAt": utc_now(), "source": GAMMA_MARKETS_URL}


def extract_url_token(value: str) -> tuple[str, str]:
    raw = urllib.parse.unquote((value or "").strip())
    if not raw:
        return "", ""
    parsed = urllib.parse.urlparse(raw if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", raw) else f"https://{raw}")
    if not parsed.netloc and "/" not in raw:
        return raw, ""
    parts = [part for part in parsed.path.split("/") if part and part not in {"zh", "en"}]
    for marker, kind in (("event", "event"), ("market", "market"), ("markets", "market")):
        if marker in parts:
            index = parts.index(marker)
            if index + 1 < len(parts):
                return parts[index + 1], kind
    if parts:
        return parts[-1], ""
    return raw, ""


def compact_search_result(row: sqlite3.Row, result_type: str, score: float, *, count: int | None = None) -> dict[str, Any]:
    outcomes = parse_jsonish(row["outcomes_json"], [])
    top_outcome = outcomes[0] if outcomes else None
    top_price = top_outcome.get("price") if isinstance(top_outcome, dict) else row["price"]
    return {
        "type": result_type,
        "id": row["id"] if result_type == "market" else row["event_id"] or row["event_slug"] or row["id"],
        "marketId": row["id"],
        "eventId": row["event_id"],
        "eventSlug": row["event_slug"],
        "slug": row["slug"],
        "title": row["question"] if result_type == "market" else row["event_title"] or row["question"],
        "subtitle": row["event_title"] if result_type == "market" else f"{count or 1} 个相关市场",
        "category": row["category_label"] or row["category"] or "其他",
        "categoryKey": row["category_key"] or "other",
        "icon": row["icon"] or row["image"],
        "image": row["image"] or row["icon"],
        "price": top_price,
        "volume": row["volume"],
        "liquidity": row["liquidity"],
        "endDate": row["end_date"],
        "score": round(score, 4),
        "matchedBy": result_type,
    }


def score_market_row(row: sqlite3.Row, query_text: str, token: str, token_kind: str) -> float:
    query_terms = expand_query_terms(query_text)
    normalized_token = normalize_term(token)
    question = normalize_term(row["question"])
    event_title = normalize_term(row["event_title"])
    slug = normalize_term(row["slug"])
    event_slug = normalize_term(row["event_slug"])
    category = normalize_term(row["category_label"] or row["category"])
    tags = normalize_term(" ".join(str(tag) for tag in parse_jsonish(row["tags_json"], [])))
    score = 0.0
    if normalized_token:
        if normalized_token == normalize_term(row["id"]):
            score += 1.6
        if normalized_token == slug:
            score += 1.45 if token_kind != "event" else 1.1
        if normalized_token == event_slug:
            score += 1.42 if token_kind == "event" else 1.2
        if normalized_token and normalized_token in slug:
            score += 0.75
        if normalized_token and normalized_token in event_slug:
            score += 0.72
    for index, normalized_query in enumerate(query_terms):
        alias_weight = 1.0 if index == 0 else 0.92
        if question.startswith(normalized_query):
            score += 0.72 * alias_weight
        elif normalized_query in question:
            score += 0.54 * alias_weight
        if event_title.startswith(normalized_query):
            score += 0.58 * alias_weight
        elif normalized_query in event_title:
            score += 0.42 * alias_weight
        if normalized_query in tags:
            score += 0.34 * alias_weight
        if normalized_query in category:
            score += 0.22 * alias_weight
        overlap = words(normalized_query) & words(f"{question} {event_title} {tags}")
        score += min(0.4, len(overlap) * 0.08) * alias_weight
    score += min(0.22, math.log10(max(row["volume"] or 0.0, 1.0)) * 0.026)
    score += min(0.12, math.log10(max(row["volume_24hr"] or 0.0, 1.0)) * 0.018)
    return score


def market_search(query: dict[str, list[str]]) -> dict[str, Any]:
    ensure_seed_data()
    raw_q = query.get("q", [""])[0].strip()
    limit = min(max(int(query.get("limit", ["8"])[0]), 3), 12)
    if not raw_q:
        return {"results": [], "generatedAt": utc_now(), "source": GAMMA_MARKETS_URL}
    token, token_kind = extract_url_token(raw_q)
    query_terms = expand_query_terms(raw_q)
    normalized_query = query_terms[0] if query_terms else normalize_term(raw_q)
    normalized_token = normalize_term(token)
    like_terms = [*query_terms]
    if normalized_token and normalized_token != normalized_query:
        like_terms.append(normalized_token)

    where = ["active = 1", "closed = 0"]
    params: list[Any] = []
    searchable_parts = []
    for term in like_terms:
        searchable_parts.extend(
            [
                "id = ?",
                "lower(slug) = ?",
                "lower(event_slug) = ?",
                "lower(question) LIKE ?",
                "lower(event_title) LIKE ?",
                "lower(category_label) LIKE ?",
                "lower(category) LIKE ?",
                "lower(tags_json) LIKE ?",
            ]
        )
        params.extend([term, term, term, f"%{term}%", f"%{term}%", f"%{term}%", f"%{term}%", f"%{term}%"])
    where.append(f"({' OR '.join(searchable_parts)})")
    with db() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM markets
            WHERE {' AND '.join(where)}
            ORDER BY COALESCE(volume_24hr, 0) DESC, COALESCE(volume, 0) DESC
            LIMIT 120
            """,
            params,
        ).fetchall()

    scored_rows = sorted(
        ((score_market_row(row, raw_q, token, token_kind), row) for row in rows),
        key=lambda item: item[0],
        reverse=True,
    )

    results: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    def add_result(result: dict[str, Any]) -> None:
        key = (result["type"], str(result["id"]))
        if key in seen:
            return
        seen.add(key)
        results.append(result)

    event_groups: dict[str, list[tuple[float, sqlite3.Row]]] = {}
    for score, row in scored_rows:
        if row["event_id"] or row["event_slug"]:
            event_key = row["event_id"] or row["event_slug"]
            event_groups.setdefault(event_key, []).append((score, row))
    for event_key, group in event_groups.items():
        best_score, best_row = max(group, key=lambda item: item[0])
        event_boost = 0.22 if normalized_token and normalized_token == normalize_term(best_row["event_slug"]) else 0.0
        add_result(compact_search_result(best_row, "event", best_score + event_boost, count=len(group)))

    for score, row in scored_rows:
        add_result(compact_search_result(row, "market", score))
        if len(results) >= limit * 2:
            break

    for definition in CATEGORY_DEFS:
        text = normalize_term(f"{definition['key']} {definition['label']} {' '.join(definition['keywords'])}")
        if normalized_query and normalized_query in text:
            results.append(
                {
                    "type": "topic",
                    "id": definition["key"],
                    "topic": definition["key"],
                    "title": definition["label"],
                    "subtitle": "主题分类",
                    "category": definition["label"],
                    "categoryKey": definition["key"],
                    "icon": None,
                    "image": None,
                    "price": None,
                    "volume": None,
                    "liquidity": None,
                    "endDate": None,
                    "score": 0.7,
                    "matchedBy": "topic",
                }
            )

    ordered = sorted(results, key=lambda item: item["score"], reverse=True)[:limit]
    return {"results": ordered, "generatedAt": utc_now(), "source": GAMMA_MARKETS_URL}


def unique_rows(rows: list[sqlite3.Row], limit: int) -> list[sqlite3.Row]:
    unique: list[sqlite3.Row] = []
    seen: set[str] = set()
    for row in rows:
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        unique.append(row)
        if len(unique) >= limit:
            break
    return unique


def fetch_edges_for_rows(conn: sqlite3.Connection, rows: list[sqlite3.Row]) -> list[sqlite3.Row]:
    ids = [row["id"] for row in rows]
    if len(ids) < 2:
        return []
    placeholders = ",".join("?" for _ in ids)
    return conn.execute(
        f"""
        SELECT * FROM market_edges
        WHERE source IN ({placeholders}) AND target IN ({placeholders})
        ORDER BY weight DESC
        LIMIT 180
        """,
        [*ids, *ids],
    ).fetchall()


def select_network_rows(
    candidate_rows: list[sqlite3.Row],
    edge_rows: list[sqlite3.Row],
    limit: int,
) -> tuple[list[sqlite3.Row], list[sqlite3.Row]]:
    if not candidate_rows:
        return [], []

    row_by_id = {row["id"]: row for row in candidate_rows}
    selected_ids: set[str] = {candidate_rows[0]["id"]}
    selected_edges: list[sqlite3.Row] = []
    seen_edges: set[str] = set()

    def can_add(edge: sqlite3.Row) -> bool:
        next_ids = set(selected_ids)
        next_ids.add(edge["source"])
        next_ids.add(edge["target"])
        return len(next_ids) <= limit

    def add_edge(edge: sqlite3.Row) -> None:
        if edge["id"] in seen_edges or not can_add(edge):
            return
        if edge["source"] not in row_by_id or edge["target"] not in row_by_id:
            return
        seen_edges.add(edge["id"])
        selected_edges.append(edge)
        selected_ids.add(edge["source"])
        selected_ids.add(edge["target"])

    focus_id = candidate_rows[0]["id"]
    direct_edges = [edge for edge in edge_rows if edge["source"] == focus_id or edge["target"] == focus_id]
    for edge in direct_edges[:8]:
        add_edge(edge)

    for edge in edge_rows:
        if len(selected_ids) >= limit and len(selected_edges) >= min(32, limit + 7):
            break
        add_edge(edge)

    if len(selected_ids) < min(8, len(candidate_rows)):
        for row in candidate_rows:
            if len(selected_ids) >= min(limit, len(candidate_rows)):
                break
            selected_ids.add(row["id"])

    selected_row_list = [row for row in candidate_rows if row["id"] in selected_ids][:limit]
    allowed_ids = {row["id"] for row in selected_row_list}
    selected_edge_list = [
        edge
        for edge in selected_edges
        if edge["source"] in allowed_ids and edge["target"] in allowed_ids
    ][:36]
    return selected_row_list, selected_edge_list


def market_network(query: dict[str, list[str]]) -> dict[str, Any]:
    ensure_seed_data()
    limit = min(max(int(query.get("limit", [str(MAX_NETWORK_MARKETS)])[0]), 8), MAX_NETWORK_MARKETS)
    q = query.get("q", [""])[0].strip().lower()
    focus_market_id = query.get("focusMarketId", [""])[0].strip()
    event_focus = query.get("eventId", [""])[0].strip()
    topic = query.get("topic", [""])[0].strip()
    category = resolve_category_key(
        query.get("categoryKey", [""])[0]
        or query.get("category", [""])[0]
    )

    with db() as conn:
        if not focus_market_id and not event_focus and q:
            token, token_kind = extract_url_token(q)
            if token and (token_kind or token != q):
                resolved = conn.execute(
                    """
                    SELECT id, event_id, event_slug
                    FROM markets
                    WHERE active = 1 AND closed = 0
                      AND (id = ? OR lower(slug) = ? OR lower(event_slug) = ?)
                    ORDER BY COALESCE(volume_24hr, 0) DESC, COALESCE(volume, 0) DESC
                    LIMIT 1
                    """,
                    [token, normalize_term(token), normalize_term(token)],
                ).fetchone()
                if resolved:
                    if token_kind == "event" and (resolved["event_id"] or resolved["event_slug"]):
                        event_focus = resolved["event_id"] or resolved["event_slug"]
                    else:
                        focus_market_id = resolved["id"]

        if focus_market_id:
            focus_row = conn.execute(
                """
                SELECT *
                FROM markets
                WHERE active = 1 AND closed = 0
                  AND (id = ? OR lower(slug) = ?)
                ORDER BY COALESCE(volume_24hr, 0) DESC, COALESCE(volume, 0) DESC
                LIMIT 1
                """,
                [focus_market_id, normalize_term(focus_market_id)],
            ).fetchone()
            candidate_rows = []
            if focus_row:
                related_rows = conn.execute(
                    """
                    SELECT m.*
                    FROM market_edges e
                    JOIN markets m
                      ON m.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
                    WHERE ? IN (e.source, e.target)
                      AND m.active = 1 AND m.closed = 0
                    ORDER BY e.weight DESC, COALESCE(m.volume_24hr, 0) DESC, COALESCE(m.volume, 0) DESC
                    LIMIT 80
                    """,
                    [focus_row["id"], focus_row["id"]],
                ).fetchall()
                same_event_rows: list[sqlite3.Row] = []
                if focus_row["event_id"]:
                    same_event_rows = conn.execute(
                        """
                        SELECT *
                        FROM markets
                        WHERE active = 1 AND closed = 0 AND event_id = ?
                        ORDER BY COALESCE(volume_24hr, 0) DESC, COALESCE(volume, 0) DESC
                        LIMIT 40
                        """,
                        [focus_row["event_id"]],
                    ).fetchall()
                same_category_rows = conn.execute(
                    """
                    SELECT *
                    FROM markets
                    WHERE active = 1 AND closed = 0
                      AND COALESCE(category_key, 'other') = COALESCE(?, 'other')
                    ORDER BY COALESCE(volume_24hr, 0) DESC, COALESCE(volume, 0) DESC
                    LIMIT 40
                    """,
                    [focus_row["category_key"]],
                ).fetchall()
                candidate_rows = unique_rows([focus_row, *related_rows, *same_event_rows, *same_category_rows], max(80, limit * 4))
        elif event_focus:
            candidate_rows = conn.execute(
                """
                SELECT *
                FROM markets
                WHERE active = 1 AND closed = 0
                  AND (event_id = ? OR lower(event_slug) = ?)
                ORDER BY COALESCE(volume_24hr, 0) DESC, COALESCE(volume, 0) DESC
                LIMIT ?
                """,
                [event_focus, normalize_term(event_focus), max(80, limit * 4)],
            ).fetchall()
        else:
            effective_q = topic or q
            topic_category = resolve_category_key(topic)
            effective_category = category
            if topic_category and topic_category not in ("all", "hot"):
                effective_category = topic_category
                effective_q = ""
            params: list[Any] = []
            where = ["active = 1", "closed = 0"]
            if effective_q:
                query_terms = expand_query_terms(effective_q)
                term_clauses: list[str] = []
                for term in query_terms:
                    term_clauses.append(
                        "(lower(question) LIKE ? OR lower(event_title) LIKE ? OR lower(tags_json) LIKE ? OR lower(category_label) LIKE ? OR lower(category) LIKE ?)"
                    )
                    params.extend([f"%{term}%", f"%{term}%", f"%{term}%", f"%{term}%", f"%{term}%"])
                where.append(f"({' OR '.join(term_clauses)})")
            if effective_category and effective_category not in ("全部", "all", "热门", "hot"):
                where.append("COALESCE(category_key, 'other') = ?")
                params.append(effective_category)
            sql = f"""
                SELECT *
                FROM markets
                WHERE {' AND '.join(where)}
                ORDER BY COALESCE(volume_24hr, 0) DESC, COALESCE(volume, 0) DESC
                LIMIT ?
            """
            params.append(max(80, limit * 4))
            candidate_rows = conn.execute(sql, params).fetchall()

        edge_rows = fetch_edges_for_rows(conn, candidate_rows)
    rows, selected_edge_rows = select_network_rows(candidate_rows, edge_rows, limit)
    edge_items = [
        {
            "id": row["id"],
            "source": row["source"],
            "target": row["target"],
            "relationType": row["relation_type"],
            "weight": row["weight"],
            "reason": row["reason"],
        }
        for row in selected_edge_rows
    ]
    ids = [row["id"] for row in rows]
    if len(ids) >= 2 and len(edge_items) < max(3, len(ids) // 2):
        covered = {market_id for edge in edge_items for market_id in (edge["source"], edge["target"])}
        focus_id = ids[0]
        seen_edges = {(edge["source"], edge["target"]) for edge in edge_items}
        for market_id in ids[1:]:
            if market_id in covered:
                continue
            pair = (focus_id, market_id)
            reverse_pair = (market_id, focus_id)
            if pair in seen_edges or reverse_pair in seen_edges:
                continue
            edge_items.append(
                {
                    "id": f"{focus_id}->{market_id}:visible",
                    "source": focus_id,
                    "target": market_id,
                    "relationType": "semantic",
                    "weight": 0.14,
                    "reason": "可视网络兜底连接",
                }
            )
            seen_edges.add(pair)
    layout_edges = []
    for edge in edge_items:
        layout_edges.append(
            {
                "source": edge["source"],
                "target": edge["target"],
            }
        )
    positions = focus_network_positions(rows, layout_edges)
    nodes = [row_to_node(row, positions[row["id"]]) for row in rows]
    return {
        "nodes": nodes,
        "edges": edge_items,
        "source": GAMMA_MARKETS_URL,
        "generatedAt": utc_now(),
    }


def event_detail(query: dict[str, list[str]]) -> dict[str, Any]:
    ensure_seed_data()
    market_id = query.get("marketId", [""])[0].strip()
    event_focus = query.get("eventId", [""])[0].strip() or query.get("eventSlug", [""])[0].strip()
    with db() as conn:
        focus_row = None
        if market_id:
            focus_row = conn.execute(
                """
                SELECT *
                FROM markets
                WHERE id = ? OR lower(slug) = ?
                LIMIT 1
                """,
                [market_id, normalize_term(market_id)],
            ).fetchone()
            if focus_row:
                event_focus = focus_row["event_id"] or focus_row["event_slug"] or event_focus
        event_row = None
        if event_focus:
            event_row = conn.execute(
                """
                SELECT *
                FROM events
                WHERE id = ? OR lower(slug) = ?
                LIMIT 1
                """,
                [event_focus, normalize_term(event_focus)],
            ).fetchone()
        if event_focus:
            market_rows = conn.execute(
                """
                SELECT *
                FROM markets
                WHERE active = 1 AND closed = 0
                  AND (event_id = ? OR lower(event_slug) = ?)
                ORDER BY COALESCE(price, 0) DESC, COALESCE(volume, 0) DESC
                LIMIT 80
                """,
                [event_focus, normalize_term(event_focus)],
            ).fetchall()
        elif focus_row:
            market_rows = [focus_row]
        else:
            market_rows = []

    event_payload: dict[str, Any] | None = None
    if event_row:
        event_payload = {
            "id": event_row["id"],
            "slug": event_row["slug"],
            "title": event_row["title"],
            "category": event_row["category_label"] or event_row["category"] or "其他",
            "categoryKey": event_row["category_key"] or "other",
            "officialCategory": event_row["category"],
            "tags": parse_jsonish(event_row["tags_json"], []),
            "icon": event_row["icon"] or event_row["image"],
            "image": event_row["image"] or event_row["icon"],
            "endDate": event_row["end_date"],
            "volume": event_row["volume"],
            "volume24hr": event_row["volume_24hr"],
            "liquidity": event_row["liquidity"],
            "description": event_row["description"],
            "rules": event_row["rules"],
            "marketsCount": event_row["markets_count"],
            "updatedAt": event_row["updated_at"],
            "syncedAt": event_row["synced_at"],
        }
    elif market_rows:
        first = market_rows[0]
        event_payload = {
            "id": first["event_id"],
            "slug": first["event_slug"],
            "title": first["event_title"] or first["question"],
            "category": first["category_label"] or first["category"] or "其他",
            "categoryKey": first["category_key"] or "other",
            "officialCategory": first["category"],
            "tags": parse_jsonish(first["tags_json"], []),
            "icon": first["icon"] or first["image"],
            "image": first["image"] or first["icon"],
            "endDate": first["end_date"],
            "volume": sum(row["volume"] or 0 for row in market_rows),
            "volume24hr": sum(row["volume_24hr"] or 0 for row in market_rows),
            "liquidity": sum(row["liquidity"] or 0 for row in market_rows),
            "description": first["description"],
            "rules": first["rules"],
            "marketsCount": len(market_rows),
            "updatedAt": first["updated_at"],
            "syncedAt": first["synced_at"],
        }

    nodes = [row_to_node(row, (50.0, 50.0)) for row in market_rows]
    return {
        "event": event_payload,
        "markets": nodes,
        "source": GAMMA_EVENTS_URL,
        "generatedAt": utc_now(),
    }


def market_price_history(query: dict[str, list[str]]) -> dict[str, Any]:
    token_ids_raw = query.get("tokenIds", [""])[0].strip()
    token_ids = [
        token.strip()
        for token in token_ids_raw.split(",")
        if token.strip() and re.fullmatch(r"\d{20,}", token.strip())
    ][:12]
    if not token_ids:
        return {"history": {}, "source": CLOB_PRICES_HISTORY_URL, "generatedAt": utc_now()}
    interval = query.get("interval", ["all"])[0].strip().lower()
    if interval not in {"1h", "6h", "1d", "1w", "1m", "all"}:
        interval = "all"
    try:
        fidelity = int(query.get("fidelity", ["1440"])[0])
    except ValueError:
        fidelity = 1440
    fidelity = max(1, min(fidelity, 1440))
    body = json.dumps(
        {
            "markets": token_ids,
            "interval": interval,
            "fidelity": fidelity,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        CLOB_PRICES_HISTORY_URL,
        data=body,
        method="POST",
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    history = payload.get("history") if isinstance(payload, dict) else {}
    if not isinstance(history, dict):
        history = {}
    return {"history": history, "source": CLOB_PRICES_HISTORY_URL, "generatedAt": utc_now()}


def load_ai_config() -> dict[str, Any]:
    config = dict(DEFAULT_AI_CONFIG)
    for path in (ROOT / "config.local.json", ROOT / "backend" / "config.local.json"):
        if not path.exists():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        ai_payload = payload.get("ai") if isinstance(payload, dict) else None
        if isinstance(ai_payload, dict):
            config.update({key: value for key, value in ai_payload.items() if value not in (None, "")})

    if os.environ.get("CAUSEWAY_AI_API_KEY"):
        config["apiKey"] = os.environ["CAUSEWAY_AI_API_KEY"]
    if os.environ.get("CAUSEWAY_AI_BASE_URL"):
        config["baseUrls"] = [item.strip() for item in os.environ["CAUSEWAY_AI_BASE_URL"].split(",") if item.strip()]
    if os.environ.get("CAUSEWAY_AI_MODEL"):
        config["modelPriority"] = [item.strip() for item in os.environ["CAUSEWAY_AI_MODEL"].split(",") if item.strip()]
    if os.environ.get("CAUSEWAY_AI_WEB_SEARCH"):
        config["enableWebSearch"] = os.environ["CAUSEWAY_AI_WEB_SEARCH"].strip().lower() not in {"0", "false", "no"}
    return config


def ai_status() -> dict[str, Any]:
    config = load_ai_config()
    return {
        "configured": bool(config.get("apiKey")),
        "baseUrls": config.get("baseUrls") or [],
        "apiFormat": config.get("apiFormat") or "openai",
        "modelPriority": config.get("modelPriority") or [],
        "enableWebSearch": bool(config.get("enableWebSearch", True)),
        "generatedAt": utc_now(),
    }


def row_to_inference_market(row: sqlite3.Row) -> dict[str, Any]:
    node = row_to_node(row, (50.0, 50.0))
    node["url"] = polymarket_url(node)
    node["ruleText"] = row["rules"] or row["description"] or ""
    return node


def polymarket_url(market: dict[str, Any]) -> str:
    event_slug = market.get("eventSlug")
    slug = market.get("slug")
    if event_slug:
        return f"https://polymarket.com/event/{event_slug}"
    if slug:
        return f"https://polymarket.com/market/{slug}"
    return "https://polymarket.com"


def inference_context(market_id: str) -> dict[str, Any]:
    ensure_seed_data()
    with db() as conn:
        focus_row = conn.execute(
            """
            SELECT *
            FROM markets
            WHERE id = ? OR lower(slug) = ?
            LIMIT 1
            """,
            [market_id, normalize_term(market_id)],
        ).fetchone()
        if not focus_row:
            raise ValueError("未找到要推演的市场节点")

        event_row = None
        if focus_row["event_id"] or focus_row["event_slug"]:
            event_row = conn.execute(
                """
                SELECT *
                FROM events
                WHERE id = ? OR lower(slug) = ?
                LIMIT 1
                """,
                [focus_row["event_id"], normalize_term(focus_row["event_slug"])],
            ).fetchone()

        event_rows: list[sqlite3.Row] = []
        if focus_row["event_id"] or focus_row["event_slug"]:
            event_rows = conn.execute(
                """
                SELECT *
                FROM markets
                WHERE active = 1 AND closed = 0
                  AND (event_id = ? OR lower(event_slug) = ?)
                ORDER BY COALESCE(volume, 0) DESC, COALESCE(price, 0) DESC
                LIMIT 25
                """,
                [focus_row["event_id"], normalize_term(focus_row["event_slug"])],
            ).fetchall()

        related_rows = conn.execute(
            """
            SELECT m.*, e.weight AS edge_weight, e.reason AS edge_reason, e.relation_type AS edge_relation_type
            FROM market_edges e
            JOIN markets m
              ON m.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
            WHERE ? IN (e.source, e.target)
              AND m.active = 1 AND m.closed = 0
            ORDER BY e.weight DESC, COALESCE(m.volume_24hr, 0) DESC, COALESCE(m.volume, 0) DESC
            LIMIT 24
            """,
            [focus_row["id"], focus_row["id"]],
        ).fetchall()

        same_category_rows = conn.execute(
            """
            SELECT *
            FROM markets
            WHERE active = 1 AND closed = 0
              AND id <> ?
              AND COALESCE(category_key, 'other') = COALESCE(?, 'other')
            ORDER BY COALESCE(volume_24hr, 0) DESC, COALESCE(volume, 0) DESC
            LIMIT 18
            """,
            [focus_row["id"], focus_row["category_key"]],
        ).fetchall()

        candidate_rows = unique_rows([focus_row, *event_rows, *related_rows, *same_category_rows], 32)
        edge_rows = fetch_edges_for_rows(conn, candidate_rows)

    event_payload = None
    if event_row:
        event_payload = {
            "id": event_row["id"],
            "slug": event_row["slug"],
            "title": event_row["title"],
            "category": event_row["category_label"] or event_row["category"] or "其他",
            "categoryKey": event_row["category_key"] or "other",
            "tags": parse_jsonish(event_row["tags_json"], []),
            "endDate": event_row["end_date"],
            "volume": event_row["volume"],
            "volume24hr": event_row["volume_24hr"],
            "liquidity": event_row["liquidity"],
            "description": event_row["description"],
            "rules": event_row["rules"],
            "marketsCount": event_row["markets_count"],
            "url": f"https://polymarket.com/event/{event_row['slug']}" if event_row["slug"] else "https://polymarket.com",
        }

    return {
        "focus": row_to_inference_market(focus_row),
        "event": event_payload,
        "eventMarkets": [row_to_inference_market(row) for row in event_rows[:25]],
        "relatedMarkets": [row_to_inference_market(row) for row in candidate_rows if row["id"] != focus_row["id"]][:24],
        "edges": [
            {
                "source": row["source"],
                "target": row["target"],
                "weight": row["weight"],
                "relationType": row["relation_type"],
                "reason": row["reason"],
            }
            for row in edge_rows[:36]
        ],
    }


def compact_market_for_prompt(market: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": market.get("id"),
        "title": market.get("title"),
        "eventTitle": market.get("eventTitle"),
        "category": market.get("category"),
        "price": market.get("price"),
        "volume": market.get("volume"),
        "liquidity": market.get("liquidity"),
        "endDate": market.get("endDate"),
        "url": market.get("url"),
        "rules": str(market.get("ruleText") or market.get("rules") or market.get("description") or "")[:1400],
    }


def bing_rss_search(query: str, limit: int = 5) -> list[dict[str, str]]:
    params = urllib.parse.urlencode({"q": query, "format": "rss"})
    request = urllib.request.Request(
        f"https://www.bing.com/search?{params}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml,text/xml,*/*"},
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        body = response.read().decode("utf-8", errors="ignore")
    items: list[dict[str, str]] = []
    for raw_item in re.findall(r"<item>(.*?)</item>", body, flags=re.S | re.I)[:limit]:
        title_match = re.search(r"<title>(.*?)</title>", raw_item, flags=re.S | re.I)
        link_match = re.search(r"<link>(.*?)</link>", raw_item, flags=re.S | re.I)
        desc_match = re.search(r"<description>(.*?)</description>", raw_item, flags=re.S | re.I)
        title = re.sub(r"\s+", " ", html.unescape(re.sub(r"<.*?>", "", title_match.group(1) if title_match else ""))).strip()
        url = html.unescape(link_match.group(1).strip()) if link_match else ""
        snippet = re.sub(r"\s+", " ", html.unescape(re.sub(r"<.*?>", "", desc_match.group(1) if desc_match else ""))).strip()
        if title and url:
            items.append(
                {
                    "source": urllib.parse.urlparse(url).netloc or "bing",
                    "title": title,
                    "url": url,
                    "snippet": snippet,
                }
            )
    return items


def ddg_search(query: str, limit: int = 5) -> list[dict[str, str]]:
    params = urllib.parse.urlencode({"q": query})
    request = urllib.request.Request(
        f"https://duckduckgo.com/html/?{params}",
        headers={"User-Agent": USER_AGENT, "Accept": "text/html"},
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            body = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return bing_rss_search(query, limit)

    titles = re.findall(r'<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', body, re.S)
    snippets = re.findall(r'<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</a>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</div>', body, re.S)
    cleaned_snippets = [
        re.sub(r"\s+", " ", html.unescape(re.sub(r"<.*?>", "", first or second))).strip()
        for first, second in snippets
    ]
    items: list[dict[str, str]] = []
    for index, (href, raw_title) in enumerate(titles[:limit]):
        title = re.sub(r"\s+", " ", html.unescape(re.sub(r"<.*?>", "", raw_title))).strip()
        url = html.unescape(href)
        parsed = urllib.parse.urlparse(url)
        nested = urllib.parse.parse_qs(parsed.query).get("uddg", [""])[0]
        if nested:
            url = nested
        if title:
            items.append(
                {
                    "source": urllib.parse.urlparse(url).netloc or "web",
                    "title": title,
                    "url": url,
                    "snippet": cleaned_snippets[index] if index < len(cleaned_snippets) else "",
                }
            )
    if not items:
        return bing_rss_search(query, limit)
    return items


def collect_inference_evidence(
    context: dict[str, Any],
    config: dict[str, Any],
    logs: list[str],
    settings: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    focus = context["focus"]
    event = context.get("event") or {}
    evidence: list[dict[str, Any]] = [
        {
            "source": "Polymarket",
            "title": event.get("title") or focus.get("eventTitle") or focus.get("title"),
            "url": event.get("url") or focus.get("url"),
            "snippet": str(event.get("description") or focus.get("description") or focus.get("ruleText") or "")[:420],
        }
    ]
    for market in context["relatedMarkets"][:5]:
        evidence.append(
            {
                "source": "Polymarket related market",
                "title": market.get("title"),
                "url": market.get("url"),
                "snippet": f"{market.get('category')} · 当前价格 {market.get('price')}% · 成交量 {format_money(market.get('volume'))}",
            }
        )

    include_web_search = True
    if isinstance(settings, dict) and settings.get("includeWebSearch") is False:
        include_web_search = False
    if not config.get("enableWebSearch", True) or not include_web_search:
        logs.append("已跳过网络搜索，使用 Polymarket 本地数据完成推演。")
        return evidence

    search_terms = [
        str(focus.get("title") or ""),
        str(event.get("title") or focus.get("eventTitle") or ""),
        f"{focus.get('title')} latest news",
    ]
    seen_urls = {item.get("url") for item in evidence if item.get("url")}
    for query in [term for term in search_terms if term.strip()][:3]:
        try:
            items = ddg_search(query, 4)
            logs.append(f"网络搜索完成：{query}，返回 {len(items)} 条候选信息。")
        except Exception as exc:
            logs.append(f"网络搜索失败：{query}（{exc}）")
            continue
        for item in items:
            if item.get("url") in seen_urls:
                continue
            seen_urls.add(item.get("url"))
            evidence.append(item)
            if len(evidence) >= 12:
                return evidence
    return evidence


def display_market_price(value: Any) -> float | None:
    price = as_float(value)
    if price is None:
        return None
    return round(price * 100, 2) if price <= 1 else round(price, 2)


def candidate_limit_for_settings(settings: dict[str, Any]) -> int:
    return {1: 6, 2: 10, 3: 14}[settings_depth(settings)]


def compact_text(value: Any, limit: int = 260) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1]}…"


def market_terms(market: dict[str, Any]) -> set[str]:
    raw_terms = [
        market.get("title"),
        market.get("eventTitle"),
        market.get("category"),
        market.get("officialCategory"),
        " ".join(str(tag) for tag in market.get("tags") or []),
    ]
    words: set[str] = set()
    for raw in raw_terms:
        for token in re.findall(r"[a-zA-Z0-9]{3,}", normalize_term(raw)):
            words.add(token)
    return words


def edge_hint_for_market(context: dict[str, Any], market_id: str) -> dict[str, Any] | None:
    focus_id = context["focus"]["id"]
    for edge in context.get("edges", []):
        if {edge.get("source"), edge.get("target")} == {focus_id, market_id}:
            return edge
    return None


def local_relation_score(context: dict[str, Any], market: dict[str, Any]) -> tuple[float, str, str]:
    focus = context["focus"]
    score = 0.18
    relation = "相关主题市场"
    direction = "unknown"

    if market.get("eventId") and market.get("eventId") == focus.get("eventId"):
        score += 0.42
        relation = "同事件盘口"
        direction = "conditional"

    edge = edge_hint_for_market(context, market["id"])
    if edge:
        score += min(0.28, max(0.0, as_float(edge.get("weight")) or 0.0))
        relation = edge.get("reason") or "直接关联市场"
        direction = "conditional" if edge.get("relationType") == "same_event" else "positive"

    if market.get("categoryKey") and market.get("categoryKey") == focus.get("categoryKey"):
        score += 0.12

    focus_terms = market_terms(focus)
    candidate_terms = market_terms(market)
    overlap = focus_terms & candidate_terms
    if overlap:
        score += min(0.16, len(overlap) * 0.04)

    volume = as_float(market.get("volume")) or 0
    if volume >= 1_000_000:
        score += 0.05
    if volume >= 10_000_000:
        score += 0.04

    score = round(max(0.05, min(0.98, score)), 2)
    return score, relation, direction


def build_market_evidence_item(
    market: dict[str, Any],
    source: str,
    title: str,
    snippet: str,
    url: str | None = None,
    kind: str = "market",
) -> dict[str, Any]:
    return {
        "id": f"{market['id']}:{kind}:{abs(hash((title, snippet))) % 1_000_000}",
        "marketId": market["id"],
        "source": source,
        "title": title,
        "url": url or market.get("url"),
        "snippet": compact_text(snippet, 520),
    }


def collect_candidate_evidence(
    context: dict[str, Any],
    config: dict[str, Any],
    logs: list[str],
    settings: dict[str, Any],
) -> list[dict[str, Any]]:
    candidates = context["relatedMarkets"][: candidate_limit_for_settings(settings)]
    focus = context["focus"]
    include_web_search = bool(config.get("enableWebSearch", True)) and settings.get("includeWebSearch") is not False
    include_external = include_web_search and settings.get("scope", "all") in ("news", "social", "all")
    candidate_evidence: list[dict[str, Any]] = []

    logs.append(f"候选市场召回完成：准备逐项核实 {len(candidates)} 个候选市场。")
    for index, market in enumerate(candidates, start=1):
        score, relation, direction = local_relation_score(context, market)
        edge = edge_hint_for_market(context, market["id"])
        snippets = [
            f"候选 {index}/{len(candidates)}：{market.get('title')}。",
            f"本地关系：{relation}；方向初判：{direction}；启发式相关度 {score:.2f}。",
            f"市场价格 {display_market_price(market.get('price'))}%，成交量 {format_money(market.get('volume'))}，流动性 {format_money(market.get('liquidity'))}。",
        ]
        if market.get("eventTitle"):
            snippets.append(f"所属事件：{market.get('eventTitle')}。")
        if edge and edge.get("reason"):
            snippets.append(f"本地边原因：{edge.get('reason')}。")
        rule_text = market.get("ruleText") or market.get("rules") or market.get("description")
        if rule_text:
            snippets.append(f"规则摘要：{compact_text(rule_text, 260)}")
        candidate_evidence.append(
            build_market_evidence_item(
                market,
                "Polymarket market",
                str(market.get("title") or "Polymarket market"),
                " ".join(snippets),
                market.get("url"),
                "polymarket",
            )
        )

        if include_external:
            query = f"{focus.get('title')} {market.get('title')} Polymarket news"
            try:
                search_items = ddg_search(query, 2)
                logs.append(f"外部信息核实：{market.get('title')}，返回 {len(search_items)} 条候选证据。")
            except Exception as exc:
                logs.append(f"外部信息核实失败：{market.get('title')}（{exc}）")
                search_items = []
            for item in search_items:
                candidate_evidence.append(
                    build_market_evidence_item(
                        market,
                        item.get("source") or "web",
                        item.get("title") or query,
                        item.get("snippet") or "",
                        item.get("url"),
                        "web",
                    )
                )
        else:
            logs.append(f"候选市场核实：{market.get('title')}，已使用 Polymarket 规则、盘口和本地关联边。")

    return candidate_evidence


def verification_prompt(
    context: dict[str, Any],
    candidate_evidence: list[dict[str, Any]],
    settings: dict[str, Any],
) -> list[dict[str, str]]:
    candidates = []
    evidence_by_market: dict[str, list[dict[str, Any]]] = {}
    for item in candidate_evidence:
        evidence_by_market.setdefault(str(item.get("marketId")), []).append(item)

    for market in context["relatedMarkets"][: candidate_limit_for_settings(settings)]:
        candidates.append(
            {
                **compact_market_for_prompt(market),
                "heuristic": {
                    "score": local_relation_score(context, market)[0],
                    "relation": local_relation_score(context, market)[1],
                    "direction": local_relation_score(context, market)[2],
                },
                "evidence": [
                    {
                        "id": evidence.get("id"),
                        "source": evidence.get("source"),
                        "title": evidence.get("title"),
                        "snippet": evidence.get("snippet"),
                        "url": evidence.get("url"),
                    }
                    for evidence in evidence_by_market.get(market["id"], [])[:4]
                ],
            }
        )

    schema = {
        "verifiedMarkets": [
            {
                "id": "必须使用输入候选市场 id",
                "include": True,
                "score": 0.0,
                "relation": "同事件盘口|直接关联市场|新闻关联|主题关联|低相关",
                "direction": "positive|negative|conditional|unknown",
                "impact": "+x%/-x%/待观察",
                "reason": "为什么这个市场与根市场有因果或条件传导关系",
                "evidenceSummary": "引用 Polymarket/新闻/社交证据的简短总结",
                "evidenceIds": ["证据 id"],
                "checkedSources": ["Polymarket", "web/news/social"],
            }
        ],
        "excludedMarkets": [
            {
                "id": "候选市场 id",
                "score": 0.0,
                "reason": "为什么不纳入因果链路",
            }
        ],
        "summary": "本轮市场相关性核实总结",
    }
    payload = {
        "rootMarket": compact_market_for_prompt(context["focus"]),
        "event": context.get("event"),
        "settings": settings,
        "candidates": candidates,
    }
    return [
        {
            "role": "system",
            "content": (
                "你是 Causeway 的 Polymarket 市场相关性审查员。"
                "你的任务不是直接生成脚本，而是逐个候选市场核实它与根市场是否有因果、条件、互斥或信息传导关系。"
                "必须基于输入 evidence 判断；没有证据就降低分数或排除。"
                "每个候选市场都必须出现在 verifiedMarkets 或 excludedMarkets 之一。"
                "只输出严格 json 对象，不要 Markdown，不要编造市场 id，不要生成交易建议。"
            ),
        },
        {
            "role": "user",
            "content": (
                "请逐个候选市场做相关度核实。输出必须是合法 json，字段匹配 schema：\n"
                f"schema={json.dumps(schema, ensure_ascii=False)}\n"
                f"data={json.dumps(payload, ensure_ascii=False)}"
            ),
        },
    ]


def market_payload_from_verified(
    market: dict[str, Any],
    verified: dict[str, Any],
    evidence_count: int,
) -> dict[str, Any]:
    price = display_market_price(market.get("price"))
    score = clamp_confidence(verified.get("score"), 0.45)
    return {
        "id": market["id"],
        "title": market["title"],
        "slug": market.get("slug"),
        "eventTitle": market.get("eventTitle"),
        "category": market["category"],
        "price": price,
        "volume": format_money(market.get("volume")),
        "icon": market.get("icon"),
        "image": market.get("image"),
        "confidence": score,
        "verificationScore": score,
        "relation": str(verified.get("relation") or "AI 核实相关市场"),
        "direction": str(verified.get("direction") or "unknown"),
        "impact": str(verified.get("impact") or "待观察"),
        "reason": str(verified.get("reason") or ""),
        "evidenceSummary": str(verified.get("evidenceSummary") or ""),
        "evidenceIds": [str(item) for item in verified.get("evidenceIds", [])] if isinstance(verified.get("evidenceIds"), list) else [],
        "checkedSources": [str(item) for item in verified.get("checkedSources", [])] if isinstance(verified.get("checkedSources"), list) else [],
        "evidenceCount": evidence_count,
        "url": market.get("url"),
    }


def normalize_verification_result(
    raw: dict[str, Any] | None,
    context: dict[str, Any],
    candidate_evidence: list[dict[str, Any]],
    logs: list[str],
    settings: dict[str, Any],
    meta: dict[str, str] | None = None,
) -> dict[str, Any]:
    threshold = settings_threshold(settings)
    candidates = context["relatedMarkets"][: candidate_limit_for_settings(settings)]
    market_by_id = {market["id"]: market for market in candidates}
    evidence_count_by_market: dict[str, int] = {}
    for evidence in candidate_evidence:
        market_id = str(evidence.get("marketId") or "")
        if market_id:
            evidence_count_by_market[market_id] = evidence_count_by_market.get(market_id, 0) + 1

    raw_verified = raw.get("verifiedMarkets") if isinstance(raw, dict) else None
    raw_excluded = raw.get("excludedMarkets") if isinstance(raw, dict) else None
    verified_items: list[dict[str, Any]] = []
    seen: set[str] = set()
    if isinstance(raw_verified, list):
        for item in raw_verified:
            if not isinstance(item, dict):
                continue
            market_id = str(item.get("id") or "")
            if market_id not in market_by_id or market_id in seen:
                continue
            seen.add(market_id)
            include = item.get("include", True) is not False
            score = clamp_confidence(item.get("score"), local_relation_score(context, market_by_id[market_id])[0])
            if include and score >= threshold:
                verified_items.append(
                    market_payload_from_verified(
                        market_by_id[market_id],
                        {**item, "score": score},
                        evidence_count_by_market.get(market_id, 0),
                    )
                )

    if not verified_items:
        local_candidates = []
        for market in candidates:
            score, relation, direction = local_relation_score(context, market)
            local_candidates.append(
                market_payload_from_verified(
                    market,
                    {
                        "score": score,
                        "relation": relation,
                        "direction": direction,
                        "impact": "待观察",
                        "reason": "AI 未返回可用相关性评分，使用本地事件/边/标签/成交量启发式兜底。",
                        "evidenceSummary": "Polymarket 盘口、规则、事件归属和本地候选边。",
                        "checkedSources": ["Polymarket", "local graph"],
                    },
                    evidence_count_by_market.get(market["id"], 0),
                )
            )
        verified_items = sorted(local_candidates, key=lambda item: item["verificationScore"], reverse=True)[: max(3, min(6, len(local_candidates)))]
        logs.append("AI 相关度核实未返回足够高置信市场，已启用本地相关度兜底排序。")

    excluded_items: list[dict[str, Any]] = []
    if isinstance(raw_excluded, list):
        for item in raw_excluded:
            if not isinstance(item, dict):
                continue
            market_id = str(item.get("id") or "")
            market = market_by_id.get(market_id)
            if not market:
                continue
            excluded_items.append(
                {
                    "id": market_id,
                    "title": market.get("title"),
                    "score": clamp_confidence(item.get("score"), 0.2),
                    "reason": str(item.get("reason") or "AI 判断证据不足，暂不纳入因果链路。"),
                }
            )

    verified_ids = {item["id"] for item in verified_items}
    for market in candidates:
        if market["id"] in verified_ids or any(item["id"] == market["id"] for item in excluded_items):
            continue
        score, relation, _direction = local_relation_score(context, market)
        excluded_items.append(
            {
                "id": market["id"],
                "title": market.get("title"),
                "score": score,
                "reason": f"未达到当前置信阈值 {threshold:.2f}；本地关系为 {relation}。",
            }
        )

    verified_items = sorted(verified_items, key=lambda item: item["verificationScore"], reverse=True)
    logs.append(f"AI 相关度核实完成：保留 {len(verified_items)} 个市场，排除 {len(excluded_items)} 个候选市场。")
    summary = ""
    if isinstance(raw, dict):
        summary = str(raw.get("summary") or "")
    return {
        "verifiedMarkets": verified_items,
        "excludedMarkets": excluded_items,
        "candidateEvidence": candidate_evidence,
        "summary": summary or "已完成候选市场相关性核实。",
        "model": (meta or {}).get("model"),
        "baseUrl": (meta or {}).get("baseUrl"),
    }


def format_money(value: Any) -> str:
    amount = as_float(value)
    if amount is None:
        return "N/A"
    if amount >= 1_000_000_000:
        return f"${amount / 1_000_000_000:.1f}B"
    if amount >= 1_000_000:
        return f"${amount / 1_000_000:.1f}M"
    if amount >= 1_000:
        return f"${amount / 1_000:.1f}K"
    return f"${amount:.0f}"


def normalize_ai_base_url(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return base[: -len("/chat/completions")]
    if urllib.parse.urlparse(base).netloc.endswith("deepseek.com"):
        return base
    if not base.endswith("/v1"):
        base = f"{base}/v1"
    return base


def chat_completions_endpoint(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    return f"{normalize_ai_base_url(base)}/chat/completions"


def extract_json_payload(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        payload = json.loads(cleaned)
        return payload if isinstance(payload, dict) else None
    except json.JSONDecodeError:
        pass
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        try:
            payload = json.loads(cleaned[start : end + 1])
            return payload if isinstance(payload, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def ai_prompt(
    context: dict[str, Any],
    evidence: list[dict[str, Any]],
    settings: dict[str, Any],
    verification: dict[str, Any],
) -> list[dict[str, str]]:
    focus = compact_market_for_prompt(context["focus"])
    verified = verification.get("verifiedMarkets") if isinstance(verification, dict) else []
    verified_markets = verified if isinstance(verified, list) else []
    event_markets = [compact_market_for_prompt(market) for market in context["eventMarkets"][:18]]
    user_payload = {
        "rootMarket": focus,
        "event": context.get("event"),
        "eventMarkets": event_markets,
        "verifiedRelatedMarkets": verified_markets,
        "excludedMarkets": verification.get("excludedMarkets", [])[:10] if isinstance(verification, dict) else [],
        "edges": context.get("edges", [])[:24],
        "evidence": evidence[:12],
        "candidateEvidence": verification.get("candidateEvidence", [])[:36] if isinstance(verification, dict) else [],
        "settings": settings,
    }
    schema = {
        "summary": "一句话总结推演结论",
        "thesis": "核心因果判断，中文，2-4 句",
        "confidence": 0.0,
        "causalLinks": [
            {
                "sourceMarketId": "根市场 id",
                "targetMarketId": "必须是 verifiedRelatedMarkets 中的市场 id",
                "source": "根市场标题",
                "target": "已核实相关市场标题",
                "direction": "positive|negative|conditional|unknown",
                "confidence": 0.0,
                "impact": "+x%/-x%/待观察",
                "rationale": "为什么存在因果/条件传导，必须引用市场证据",
                "evidenceSummary": "使用了哪些 Polymarket/新闻/社交证据",
                "evidenceIds": ["证据 id"],
            }
        ],
        "scenarios": [
            {
                "name": "情景名称",
                "probabilityShift": "+/-x%",
                "description": "触发条件和结果",
                "signals": ["需要观察的信号"],
            }
        ],
        "riskFactors": ["主要不确定性"],
    }
    return [
        {
            "role": "system",
            "content": (
                "你是 Causeway 的 Polymarket 因果推演分析员。"
                "你需要综合预测市场价格、同事件盘口、已核实相关市场、新闻和社交信息，分析 A 发生后 B 可能如何变化。"
                "因果图谱的节点必须是真实 Polymarket 市场。causalLinks.targetMarketId 只能引用 verifiedRelatedMarkets 中的 id。"
                "外部新闻、社交信息只能作为证据或情景信号，不能被当成图谱目标节点。"
                "如果证据不足，降低 confidence 或不要输出该链路。"
                "只输出严格 json 对象，不要输出 Markdown，不要给交易建议，不要编造来源。"
            ),
        },
        {
            "role": "user",
            "content": (
                "请基于已核实市场和证据生成中文因果脚本。输出必须是合法 json，字段必须匹配 schema：\n"
                f"schema={json.dumps(schema, ensure_ascii=False)}\n"
                f"data={json.dumps(user_payload, ensure_ascii=False)}"
            ),
        },
    ]


def call_ai(messages: list[dict[str, str]], config: dict[str, Any], logs: list[str]) -> tuple[dict[str, Any] | None, dict[str, str]]:
    api_key = str(config.get("apiKey") or "").strip()
    if not api_key:
        return None, {"error": "未配置 AI API key"}
    base_urls = [str(item).strip() for item in config.get("baseUrls") or [] if str(item).strip()]
    models = [str(item).strip() for item in config.get("modelPriority") or [] if str(item).strip()]
    timeout = int(config.get("timeoutSeconds") or 90)
    last_error = "未尝试模型"

    for base_url in base_urls:
        endpoint = chat_completions_endpoint(base_url)
        for model in models:
            request_payload: dict[str, Any] = {
                "model": model,
                "messages": messages,
                "temperature": 0.2,
                "max_tokens": 2200,
                "response_format": {"type": "json_object"},
            }
            thinking = config.get("thinking")
            if isinstance(thinking, dict) and "deepseek" in urllib.parse.urlparse(base_url).netloc:
                request_payload["thinking"] = thinking
            if config.get("reasoningEffort"):
                request_payload["reasoning_effort"] = config.get("reasoningEffort")
            body = json.dumps(request_payload, ensure_ascii=False).encode("utf-8")
            request = urllib.request.Request(
                endpoint,
                data=body,
                method="POST",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": USER_AGENT,
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=timeout) as response:
                    payload = json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="ignore")[:360]
                last_error = f"{base_url} {model} HTTP {exc.code}: {detail}"
                logs.append(f"模型调用失败：{model} @ {base_url}（HTTP {exc.code}）")
                continue
            except Exception as exc:
                last_error = f"{base_url} {model}: {exc}"
                logs.append(f"模型调用失败：{model} @ {base_url}（{exc}）")
                continue
            content = ""
            try:
                content = payload["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError):
                last_error = f"{base_url} {model}: 返回结构不符合 OpenAI Chat Completions"
                logs.append(f"模型返回结构异常：{model} @ {base_url}")
                continue
            parsed = extract_json_payload(str(content))
            if not parsed:
                last_error = f"{base_url} {model}: 模型未返回可解析 JSON"
                logs.append(f"模型未返回可解析 JSON：{model} @ {base_url}")
                continue
            logs.append(f"AI 模型调用成功：{model} @ {base_url}")
            return parsed, {"model": model, "baseUrl": base_url}
    return None, {"error": last_error}


def configured_ai_for_settings(config: dict[str, Any], settings: dict[str, Any]) -> dict[str, Any]:
    next_config = dict(config)
    preferred = str(settings.get("modelPreference") or "").strip()
    current_models = [str(item).strip() for item in config.get("modelPriority") or [] if str(item).strip()]
    if preferred and preferred != "auto":
        next_config["modelPriority"] = [preferred, *[model for model in current_models if model != preferred]]
    return next_config


def settings_depth(settings: dict[str, Any]) -> int:
    try:
        return max(1, min(3, int(settings.get("depth", 2))))
    except (TypeError, ValueError):
        return 2


def settings_threshold(settings: dict[str, Any]) -> float:
    return clamp_confidence(settings.get("confidenceThreshold"), 0.55)


def clamp_confidence(value: Any, default: float = 0.55) -> float:
    number = as_float(value)
    if number is None:
        return default
    return round(max(0.0, min(1.0, number)), 2)


def fallback_inference(
    context: dict[str, Any],
    evidence: list[dict[str, Any]],
    logs: list[str],
    ai_error: str | None = None,
    verification: dict[str, Any] | None = None,
) -> dict[str, Any]:
    focus = context["focus"]
    verified_markets = []
    if isinstance(verification, dict) and isinstance(verification.get("verifiedMarkets"), list):
        verified_markets = verification["verifiedMarkets"]
    event_markets = [market for market in context["eventMarkets"] if market["id"] != focus["id"]][:6]
    link_sources = verified_markets or event_markets or context["relatedMarkets"][:8]
    links = []
    for market in link_sources[:8]:
        relation = market.get("direction") or ("conditional" if market.get("eventId") == focus.get("eventId") else "positive")
        confidence = clamp_confidence(market.get("verificationScore") or market.get("confidence"), 0.68 if market.get("eventId") == focus.get("eventId") else 0.48)
        links.append(
            {
                "sourceMarketId": focus["id"],
                "targetMarketId": market.get("id"),
                "source": focus["title"],
                "target": market["title"],
                "direction": relation,
                "confidence": confidence,
                "impact": market.get("impact") or "待观察",
                "evidenceSummary": market.get("evidenceSummary") or "Polymarket 市场盘口、规则和本地关联边。",
                "evidenceIds": market.get("evidenceIds") or [],
                "rationale": (
                    market.get("reason")
                    or (
                        "同事件盘口会共享结算条件，价格变化通常体现概率在候选结果之间迁移。"
                        if relation == "conditional"
                        else "该市场在标签、类别或交易活跃度上与根节点接近，适合作为二阶传导观察对象。"
                    )
                ),
            }
        )
    if not links:
        links.append(
            {
                "source": focus["title"],
                "target": focus.get("eventTitle") or focus.get("category") or "相关主题",
                "direction": "unknown",
                "confidence": 0.36,
                "rationale": "当前数据库中直接相关市场较少，需等待更多市场或外部信息源补充。",
            }
        )

    scenarios = [
        {
            "name": "根节点利好兑现",
            "probabilityShift": "+5% 至 +15%",
            "description": "若相关新闻、官方数据或价格盘口继续支持根节点方向，直接相关市场可能出现同向或互斥重定价。",
            "signals": ["根节点成交量放大", "同事件其他盘口价格同步变化", "权威来源确认关键条件"],
        },
        {
            "name": "信号反转",
            "probabilityShift": "-5% 至 -20%",
            "description": "若出现与当前价格相反的官方消息或高可信市场流动性撤出，根节点及相邻盘口可能快速回撤。",
            "signals": ["盘口价差扩大", "相关市场出现反向成交", "规则来源更新或辟谣"],
        },
    ]
    return {
        "summary": f"围绕「{focus['title']}」的主要传导来自同事件盘口、同类别活跃市场和外部消息验证。",
        "thesis": (
            f"当前根节点价格为 {focus.get('price')}%，成交量 {format_money(focus.get('volume'))}。"
            "推演优先关注同事件盘口的概率迁移，其次观察同主题市场是否出现同步放量。"
            "由于 AI 模型当前不可用，本结果使用本地 Polymarket 数据和可抓取信息生成。"
        ),
        "confidence": 0.52 if ai_error else 0.58,
        "causalLinks": links,
        "scenarios": scenarios,
        "riskFactors": [
            "外部新闻源可能存在延迟或噪声",
            "Polymarket 盘口价格可能受短期流动性影响",
            "同事件盘口存在互斥关系，不能简单按同向相关解释",
            "市场规则或结算来源更新会改变推演路径",
        ],
        "evidence": evidence,
    }


def normalize_ai_result(
    raw: dict[str, Any],
    context: dict[str, Any],
    evidence: list[dict[str, Any]],
    logs: list[str],
    meta: dict[str, str],
    settings: dict[str, Any] | None = None,
    fallback: bool = False,
    verification: dict[str, Any] | None = None,
) -> dict[str, Any]:
    focus = context["focus"]
    settings = settings or {}
    verification = verification or {}
    depth = settings_depth(settings)
    threshold = settings_threshold(settings)
    max_links = {1: 4, 2: 8, 3: 12}[depth]
    related_limit = {1: 6, 2: 12, 3: 18}[depth]
    verified_related = verification.get("verifiedMarkets") if isinstance(verification.get("verifiedMarkets"), list) else []
    verified_related = verified_related[:related_limit]
    verified_by_id = {str(market.get("id")): market for market in verified_related if market.get("id")}
    verified_by_title = {normalize_term(market.get("title")): str(market.get("id")) for market in verified_related if market.get("title") and market.get("id")}
    links = raw.get("causalLinks")
    if not isinstance(links, list):
        links = []
    normalized_links = []
    for link in links[:12]:
        if not isinstance(link, dict):
            continue
        target_id = str(link.get("targetMarketId") or link.get("targetId") or "").strip()
        if not target_id:
            target_id = verified_by_title.get(normalize_term(link.get("target")), "")
        if verified_by_id and target_id not in verified_by_id:
            continue
        target_market = verified_by_id.get(target_id, {})
        confidence = clamp_confidence(link.get("confidence"), target_market.get("verificationScore") or 0.55)
        normalized_links.append(
            {
                "sourceMarketId": str(link.get("sourceMarketId") or focus["id"]),
                "targetMarketId": target_id or None,
                "source": str(link.get("source") or focus["title"]),
                "target": str(link.get("target") or target_market.get("title") or "相关市场"),
                "direction": str(link.get("direction") or "unknown"),
                "confidence": confidence,
                "impact": str(link.get("impact") or target_market.get("impact") or "待观察"),
                "rationale": str(link.get("rationale") or "未提供原因"),
                "evidenceSummary": str(link.get("evidenceSummary") or target_market.get("evidenceSummary") or ""),
                "evidenceIds": [str(item) for item in link.get("evidenceIds", [])] if isinstance(link.get("evidenceIds"), list) else [],
            }
        )
    if normalized_links:
        filtered_links = [link for link in normalized_links if link["confidence"] >= threshold]
        if filtered_links:
            normalized_links = filtered_links
    normalized_links = normalized_links[:max_links]
    if not normalized_links and verified_related:
        for market in verified_related[:max_links]:
            normalized_links.append(
                {
                    "sourceMarketId": focus["id"],
                    "targetMarketId": market.get("id"),
                    "source": focus["title"],
                    "target": market.get("title") or "相关市场",
                    "direction": market.get("direction") or "unknown",
                    "confidence": clamp_confidence(market.get("verificationScore") or market.get("confidence"), 0.55),
                    "impact": market.get("impact") or "待观察",
                    "rationale": market.get("reason") or "该市场通过 AI 相关度核实，保留为根市场的候选因果链路。",
                    "evidenceSummary": market.get("evidenceSummary") or "",
                    "evidenceIds": market.get("evidenceIds") or [],
                }
            )
    scenarios = raw.get("scenarios")
    if not isinstance(scenarios, list):
        scenarios = []
    normalized_scenarios = []
    for scenario in scenarios[:5]:
        if not isinstance(scenario, dict):
            continue
        signals = scenario.get("signals")
        normalized_scenarios.append(
            {
                "name": str(scenario.get("name") or "未命名情景"),
                "probabilityShift": str(scenario.get("probabilityShift") or "待观察"),
                "description": str(scenario.get("description") or ""),
                "signals": [str(item) for item in signals[:5]] if isinstance(signals, list) else [],
            }
        )
    risks = raw.get("riskFactors")
    normalized_risks = [str(item) for item in risks[:8]] if isinstance(risks, list) else []
    return {
        "runId": f"run_{uuid.uuid4().hex[:12]}",
        "status": "fallback" if fallback else "completed",
        "aiAvailable": not fallback,
        "model": meta.get("model") or ("local-fallback" if fallback else "unknown"),
        "providerBaseUrl": meta.get("baseUrl"),
        "rootMarket": compact_market_for_prompt(focus),
        "summary": str(raw.get("summary") or ""),
        "thesis": str(raw.get("thesis") or ""),
        "confidence": clamp_confidence(raw.get("confidence"), 0.52),
        "causalLinks": normalized_links,
        "scenarios": normalized_scenarios,
        "riskFactors": normalized_risks,
        "evidence": raw.get("evidence") if isinstance(raw.get("evidence"), list) else evidence,
        "relatedMarkets": verified_related,
        "excludedMarkets": verification.get("excludedMarkets", []),
        "verification": {
            "summary": verification.get("summary") or "",
            "candidateCount": len(context.get("relatedMarkets", [])),
            "verifiedCount": len(verified_related),
            "excludedCount": len(verification.get("excludedMarkets", []) if isinstance(verification.get("excludedMarkets"), list) else []),
            "model": verification.get("model"),
        },
        "logs": logs,
        "generatedAt": utc_now(),
        "error": meta.get("error"),
        "settings": {
            "scope": settings.get("scope") or "all",
            "depth": depth,
            "confidenceThreshold": threshold,
            "modelPreference": settings.get("modelPreference") or "auto",
            "timeRange": settings.get("timeRange") or "until_close",
        },
    }


def run_inference(payload: dict[str, Any]) -> dict[str, Any]:
    market_id = str(payload.get("marketId") or "").strip()
    if not market_id:
        raise ValueError("marketId 不能为空")
    settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
    logs = [
        "已读取根节点市场与同事件盘口。",
        "正在从 SQLite 召回直接关联边、同事件盘口和同分类候选市场。",
    ]
    config = configured_ai_for_settings(load_ai_config(), settings)
    context = inference_context(market_id)
    logs.append(f"候选市场召回完成：{len(context['relatedMarkets'])} 个市场、{len(context['edges'])} 条候选链路。")
    candidate_evidence = collect_candidate_evidence(context, config, logs, settings)
    logs.append(f"已整理 {len(candidate_evidence)} 条候选市场证据，准备请求 AI 做逐市场相关度判断。")
    verification_messages = verification_prompt(context, candidate_evidence, settings)
    verification_payload, verification_meta = call_ai(verification_messages, config, logs)
    if verification_payload is None:
        logs.append(f"AI 相关度核实失败，切换到本地候选评分：{verification_meta.get('error')}")
    verification = normalize_verification_result(verification_payload, context, candidate_evidence, logs, settings, verification_meta)
    evidence = collect_inference_evidence(context, config, logs, settings)
    evidence = [*evidence, *candidate_evidence[:24]]
    logs.append(f"已整理 {len(evidence)} 条新闻/市场/候选证据，用于生成最终因果脚本。")
    messages = ai_prompt(context, evidence, settings, verification)
    ai_payload, meta = call_ai(messages, config, logs)
    if ai_payload is None:
        logs.append(f"AI 模型暂不可用，切换到本地结构化推演：{meta.get('error')}")
        fallback_payload = fallback_inference(context, evidence, logs, meta.get("error"), verification)
        return normalize_ai_result(fallback_payload, context, evidence, logs, meta, settings, fallback=True, verification=verification)
    return normalize_ai_result(ai_payload, context, evidence, logs, meta, settings, fallback=False, verification=verification)


class Handler(BaseHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def json_response(self, status: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        body = self.rfile.read(min(length, 1_000_000)).decode("utf-8")
        payload = json.loads(body)
        return payload if isinstance(payload, dict) else {}

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        try:
            if parsed.path == "/api/health":
                init_db()
                self.json_response(200, {"ok": True, "db": str(DB_PATH)})
            elif parsed.path == "/api/ai/status":
                self.json_response(200, {"data": ai_status(), "requestId": f"req_{int(time.time() * 1000)}"})
            elif parsed.path == "/api/markets/categories":
                self.json_response(200, {"data": market_categories(), "requestId": f"req_{int(time.time() * 1000)}"})
            elif parsed.path == "/api/markets/search":
                self.json_response(200, {"data": market_search(query), "requestId": f"req_{int(time.time() * 1000)}"})
            elif parsed.path == "/api/markets/network":
                self.json_response(200, {"data": market_network(query), "requestId": f"req_{int(time.time() * 1000)}"})
            elif parsed.path == "/api/events/detail":
                self.json_response(200, {"data": event_detail(query), "requestId": f"req_{int(time.time() * 1000)}"})
            elif parsed.path == "/api/markets/history":
                self.json_response(200, {"data": market_price_history(query), "requestId": f"req_{int(time.time() * 1000)}"})
            else:
                self.json_response(404, {"error": {"code": "NOT_FOUND", "message": parsed.path}})
        except Exception as exc:
            self.json_response(500, {"error": {"code": "SERVER_ERROR", "message": str(exc)}})

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        try:
            if parsed.path == "/api/sync/polymarket":
                limit = int(query.get("limit", [str(DEFAULT_SYNC_LIMIT)])[0])
                self.json_response(200, {"data": sync_markets(limit), "requestId": f"req_{int(time.time() * 1000)}"})
            elif parsed.path == "/api/inference/run":
                self.json_response(200, {"data": run_inference(self.read_json_body()), "requestId": f"req_{int(time.time() * 1000)}"})
            else:
                self.json_response(404, {"error": {"code": "NOT_FOUND", "message": parsed.path}})
        except Exception as exc:
            self.json_response(500, {"error": {"code": "SYNC_FAILED", "message": str(exc)}})

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}", file=sys.stderr)


def main() -> None:
    init_db()
    host = "127.0.0.1"
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Causeway backend listening on http://{host}:{port}", file=sys.stderr)
    server.serve_forever()


if __name__ == "__main__":
    main()
