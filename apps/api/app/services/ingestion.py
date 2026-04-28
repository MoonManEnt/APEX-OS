from __future__ import annotations

from datetime import datetime
from email.utils import parsedate_to_datetime
from hashlib import sha256
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.models.ingestion import RawScrapePayload


TRACKING_QUERY_KEYS = {
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'gclid',
    'fbclid',
    'mc_cid',
    'mc_eid',
}


def _normalize_text(value: str | None) -> str:
    if not value:
        return ''
    return ' '.join(value.split()).strip()


def canonicalize_source_url(value: str) -> str:
    parsed = urlsplit(value)
    host = parsed.netloc.lower().replace('www.', '')
    filtered_query = [(key, query_value) for key, query_value in parse_qsl(parsed.query, keep_blank_values=False) if key.lower() not in TRACKING_QUERY_KEYS]
    normalized_query = urlencode(filtered_query)
    normalized_path = parsed.path.rstrip('/') or '/'
    return urlunsplit((parsed.scheme.lower(), host, normalized_path, normalized_query, ''))


def build_content_fingerprint(payload: RawScrapePayload) -> str:
    material = '|'.join(
        [
            _normalize_text(payload.title),
            _normalize_text(payload.raw_text)[:400],
            payload.published_at or '',
        ]
    )
    return sha256(material.encode('utf-8')).hexdigest()


def build_source_hash(payload: RawScrapePayload) -> str:
    canonical_url = canonicalize_source_url(str(payload.source_url))
    normalized_title = _normalize_text(payload.title)
    content_fingerprint = build_content_fingerprint(payload)
    material = "|".join(
        [
            payload.source_name.strip().lower(),
            canonical_url,
            normalized_title,
        ]
    )

    if canonical_url == '/':
        material = "|".join(
            [
                payload.source_name.strip().lower(),
                normalized_title,
                content_fingerprint,
            ]
        )

    return sha256(material.encode("utf-8")).hexdigest()


async def normalize_raw_scrape(payload: RawScrapePayload) -> dict:
    """WS-1 normalization stub before DB persistence is wired."""

    published_at = None
    if payload.published_at:
        try:
            normalized = payload.published_at.replace('Z', '+00:00')
            published_at = datetime.fromisoformat(normalized)
        except ValueError:
            published_at = parsedate_to_datetime(payload.published_at)

    return {
        "source_name": payload.source_name.strip().lower(),
        "source_url": canonicalize_source_url(str(payload.source_url)),
        "source_hash": build_source_hash(payload),
        "title": _normalize_text(payload.title) or None,
        "raw_text": _normalize_text(payload.raw_text) or None,
        "published_at": published_at,
        "payload": {
            **payload.payload,
            'canonical_source_url': canonicalize_source_url(str(payload.source_url)),
            'content_fingerprint': build_content_fingerprint(payload),
        },
    }
