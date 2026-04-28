import json
import re
from typing import Optional

from anthropic import AsyncAnthropic

from app.core.settings import settings
from app.models.ingestion import ClassificationResult, RawScrapePayload


CLASSIFICATION_PROMPT_NOTES = """
Classify APEX raw scrape inputs into a structured CRE event.
Return deterministic JSON matching this schema:
{
  "title": str,
  "summary": str | null,
  "event_type": str,
  "market": str | null,
  "urgency_score": int,
  "relevance_score": int,
  "confidence_score": float,
  "primary_brand": str | null,
  "brand_relevance": string[],
  "badges": string[],
  "rationale": str | null,
  "extracted_entities": object
}
Honor property-centric, Revenue Intelligence Core-first doctrine.
Only use allowed brands: clean_scapes, partners_cc, scout_security, ecs_texas, revival_restoration.
Only use allowed event types: ownership_transfer, lease_signed, lease_expiring, personnel_change, construction_start, construction_completion, permit_filed, zoning_action, capital_raise, corporate_relocation, data_center_announcement, vendor_change_signal, market_news, other.
Return JSON only.
""".strip()


MARKET_PATTERNS = {
    'Dallas-Fort Worth': re.compile(r'\b(dallas(?:-fort worth)?|dfw|fort worth)\b', re.I),
    'Houston': re.compile(r'\bhouston\b', re.I),
    'Austin': re.compile(r'\baustin\b', re.I),
    'San Antonio': re.compile(r'\bsan antonio\b', re.I),
}


def _combined_text(payload: RawScrapePayload) -> str:
    return ' '.join(filter(None, [payload.title, payload.raw_text]))


def _infer_market(text_value: str) -> Optional[str]:
    for market, pattern in MARKET_PATTERNS.items():
        if pattern.search(text_value):
            return market
    return None


def _infer_event_type(text_value: str) -> str:
    lower = text_value.lower()
    if any(token in lower for token in ['award', 'awards', 'ranking', 'leading', 'report', 'forecast']):
        return 'market_news'
    if any(token in lower for token in ['appointed', 'appointment', 'named ceo', 'executive', 'hires', 'promotes']):
        return 'personnel_change'
    if any(token in lower for token in ['ownership transfer', 'acquisition of', 'acquired', 'sold for', 'sale of property', 'changes hands']):
        return 'ownership_transfer'
    if any(token in lower for token in ['lease signed', 'new lease', 'lease agreement']):
        return 'lease_signed'
    if any(token in lower for token in ['lease expiring', 'lease expiration']):
        return 'lease_expiring'
    if any(token in lower for token in ['groundbreaking', 'construction begins', 'development starts', 'breaks ground']):
        return 'construction_start'
    if any(token in lower for token in ['completion', 'opens', 'delivered', 'delivery of']):
        return 'construction_completion'
    if 'permit' in lower:
        return 'permit_filed'
    if 'zoning' in lower:
        return 'zoning_action'
    if any(token in lower for token in ['relocation', 'moves to', 'headquarters']):
        return 'corporate_relocation'
    return 'market_news'


def _infer_brands(text_value: str, event_type: str) -> tuple[Optional[str], list[str], list[str], int, int]:
    lower = text_value.lower()
    brands = []
    badges = []
    relevance = 40
    urgency = 22

    if event_type in {'ownership_transfer', 'construction_start', 'construction_completion'}:
        brands.extend(['clean_scapes', 'partners_cc', 'scout_security'])
        badges.append('multi_brand_target')
        relevance = 82
        urgency = 64
    elif event_type in {'lease_signed', 'lease_expiring', 'corporate_relocation'}:
        brands.extend(['partners_cc', 'clean_scapes'])
        relevance = 63
        urgency = 42
    elif event_type == 'personnel_change':
        brands.extend(['partners_cc'])
        relevance = 46
        urgency = 24
    elif event_type == 'market_news':
        relevance = 28
        urgency = 10

    if 'security' in lower:
        brands.insert(0, 'scout_security')
    if 'restoration' in lower or 'damage' in lower or 'flood' in lower or 'fire' in lower:
        brands.insert(0, 'revival_restoration')
    if 'cleaning' in lower or 'janitorial' in lower:
        brands.insert(0, 'partners_cc')

    if event_type == 'ownership_transfer':
        badges.append('ownership_transition')
    if 'broker' in lower:
        badges.append('warm_path_broker')
    if event_type == 'market_news' and any(token in lower for token in ['award', 'awards', 'leading', 'report']):
        badges.append('low_signal_news')
        relevance = max(relevance - 10, 8)
        urgency = max(urgency - 8, 3)

    seen = []
    for brand in brands:
        if brand not in seen:
            seen.append(brand)
    primary_brand = seen[0] if seen else None
    return primary_brand, seen, badges, max(relevance, 5), max(urgency, 1)


def fallback_classification(payload: RawScrapePayload) -> ClassificationResult:
    text_value = _combined_text(payload)
    summary = (payload.raw_text or payload.title or "")[:280] or None
    event_type = _infer_event_type(text_value)
    market = _infer_market(text_value)
    primary_brand, brand_relevance, badges, relevance_score, urgency_score = _infer_brands(text_value, event_type)
    confidence_score = 0.78 if payload.source_name != 'manual.seed' else 0.81
    extracted_entities = {
        'source': payload.source_name,
        'market': market,
        'title_tokens': (payload.title or '').split()[:8],
    }
    return ClassificationResult(
        title=payload.title or 'Untitled event',
        summary=summary,
        event_type=event_type,
        market=market,
        urgency_score=urgency_score,
        relevance_score=relevance_score,
        confidence_score=confidence_score,
        primary_brand=primary_brand,
        brand_relevance=brand_relevance,
        badges=badges,
        rationale='Fallback classifier result used because Anthropic is not configured or response parsing failed.',
        extracted_entities=extracted_entities,
    )


def _extract_text_block(content: list) -> str:
    parts = []
    for block in content:
        text = getattr(block, 'text', None)
        if text:
            parts.append(text)
    return '\n'.join(parts).strip()


async def classify_with_anthropic(payload: RawScrapePayload) -> Optional[ClassificationResult]:
    if not settings.anthropic_api_key:
        return None

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model='claude-3-5-sonnet-latest',
        max_tokens=800,
        temperature=0,
        system=CLASSIFICATION_PROMPT_NOTES,
        messages=[
            {
                'role': 'user',
                'content': json.dumps(
                    {
                        'source_name': payload.source_name,
                        'source_url': str(payload.source_url),
                        'title': payload.title,
                        'published_at': payload.published_at,
                        'raw_text': payload.raw_text,
                        'payload': payload.payload,
                    }
                ),
            }
        ],
    )

    text_output = _extract_text_block(message.content)
    if not text_output:
        return None

    try:
        parsed = json.loads(text_output)
        return ClassificationResult(**parsed)
    except Exception:
        return None


async def classify_raw_scrape(payload: RawScrapePayload) -> ClassificationResult:
    result = await classify_with_anthropic(payload)
    if result is not None:
        return result
    return fallback_classification(payload)
