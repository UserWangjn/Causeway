from __future__ import annotations

import json
import math
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "causeway.sqlite3"
GAMMA_MARKETS_URL = "https://gamma-api.polymarket.com/markets"
MAX_NETWORK_MARKETS = 25
DEFAULT_SYNC_LIMIT = 1000
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


def official_terms(item: dict[str, Any]) -> list[str]:
    terms: list[str] = []
    for source in (item, first_event(item)):
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


def extract_official_category(item: dict[str, Any]) -> str | None:
    terms = official_terms(item)
    return terms[0] if terms else None


def keyword_matches(text: str, keyword: str) -> bool:
    if len(keyword) <= 3 and keyword.isalnum():
        return re.search(rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])", text) is not None
    return keyword in text


def classify_market(item: dict[str, Any], terms: list[str]) -> tuple[str, str]:
    official_text = " ".join(normalize_term(term) for term in terms)
    fallback_text = normalize_term(
        " ".join(
            str(part or "")
            for part in (
                item.get("question"),
                item.get("title"),
                first_event(item).get("title"),
            )
        )
    )
    combined = f"{official_text} {fallback_text}"
    for definition in CATEGORY_DEFS:
        if any(keyword_matches(combined, keyword) for keyword in definition["keywords"]):
            return definition["key"], definition["label"]
    return "other", "其他"


def market_record(item: dict[str, Any]) -> tuple[Any, ...]:
    event = first_event(item)
    terms = official_terms(item)
    category_key, category_label = classify_market(item, terms)
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
        extract_official_category(item),
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
    items = fetch_gamma_markets(limit)
    with db() as conn:
        conn.execute("UPDATE markets SET active = 0 WHERE active = 1")
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
            [market_record(item) for item in items],
        )
        build_edges(conn)
    return {"synced": len(items), "elapsedSeconds": round(time.time() - started, 2), "source": GAMMA_MARKETS_URL}


def ensure_seed_data() -> None:
    init_db()
    with db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM markets").fetchone()[0]
        missing_category_count = conn.execute(
            "SELECT COUNT(*) FROM markets WHERE active = 1 AND closed = 0 AND category_key IS NULL"
        ).fetchone()[0]
        missing_event_slug_count = conn.execute(
            "SELECT COUNT(*) FROM markets WHERE active = 1 AND closed = 0 AND event_id IS NOT NULL AND event_slug IS NULL"
        ).fetchone()[0]
    if count == 0 or missing_category_count or missing_event_slug_count:
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

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        try:
            if parsed.path == "/api/health":
                init_db()
                self.json_response(200, {"ok": True, "db": str(DB_PATH)})
            elif parsed.path == "/api/markets/categories":
                self.json_response(200, {"data": market_categories(), "requestId": f"req_{int(time.time() * 1000)}"})
            elif parsed.path == "/api/markets/search":
                self.json_response(200, {"data": market_search(query), "requestId": f"req_{int(time.time() * 1000)}"})
            elif parsed.path == "/api/markets/network":
                self.json_response(200, {"data": market_network(query), "requestId": f"req_{int(time.time() * 1000)}"})
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
