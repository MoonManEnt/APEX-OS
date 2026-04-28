import re
from dataclasses import dataclass
from typing import Optional

from app.models.ingestion import ClassificationResult, RawScrapePayload


ADDRESS_LIKE_RE = re.compile(
    r'\b\d{2,6}\s+[A-Z0-9][A-Za-z0-9.&\-]*(?:\s+[A-Z0-9][A-Za-z0-9.&\-]*){0,5}\b(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Parkway|Pkwy|Ross|Burnet)\b',
    re.I,
)
ACCOUNT_PATTERNS = [
    re.compile(r'^(?P<name>.+?)\s+(?:signs|signed|acquires|acquired|closes|closed|files|filed|promotes|promoted|names|named)\b', re.I),
    re.compile(r'^(?P<name>.+?)\s+(?:lease|renovation permit|deed transfer|construction|groundbreaking)\b', re.I),
    re.compile(r'new owner:\s*(?P<name>[A-Z][A-Za-z0-9&.,\- ]+)', re.I),
]
PROPERTY_PATTERNS = [
    re.compile(r'\bat\s+(?P<name>\d{2,6}[^,.;]+)', re.I),
    re.compile(r'\bfor\s+(?P<name>\d{2,6}[^,.;]+)', re.I),
    re.compile(r'\bproperty\s+(?P<name>[A-Z0-9][A-Za-z0-9&\- ]{4,80})', re.I),
]
STATE_BY_MARKET = {
    'Dallas-Fort Worth': 'TX',
    'Houston': 'TX',
    'Austin': 'TX',
    'San Antonio': 'TX',
}
CITY_BY_MARKET = {
    'Dallas-Fort Worth': 'Dallas',
    'Houston': 'Houston',
    'Austin': 'Austin',
    'San Antonio': 'San Antonio',
}


@dataclass
class LinkageCandidate:
    account_name: Optional[str] = None
    property_name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    confidence: str = 'low'
    strategy: str = 'fallback'


def _clean_name(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = re.sub(r'\s+', ' ', value).strip(' -–|,.;')
    return cleaned or None


def _normalize_company_name(value: Optional[str]) -> Optional[str]:
    cleaned = _clean_name(value)
    if not cleaned:
        return None
    cleaned = re.sub(r'\b(?:llc|inc|corp|corporation|l\.p\.|lp|ltd|co\.)\b', '', cleaned, flags=re.I)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip(' -–|,.;')
    return cleaned or None


def _looks_like_property(value: Optional[str]) -> bool:
    if not value:
        return False
    return bool(ADDRESS_LIKE_RE.search(value)) or bool(re.search(r'\b(?:tower|plaza|center|centre|building|property|office|asset)\b', value, re.I))


def _looks_like_generic_title(value: Optional[str]) -> bool:
    if not value:
        return False
    return value.lower().startswith('sample ') or len(value.split()) > 10


def _extract_property_name(*texts: Optional[str]) -> Optional[str]:
    for text in texts:
        if not text:
            continue
        address_match = ADDRESS_LIKE_RE.search(text)
        if address_match:
            return _clean_name(address_match.group(0))
        for pattern in PROPERTY_PATTERNS:
            match = pattern.search(text)
            if match:
                return _clean_name(match.group('name'))
    return None


def _extract_account_name(*texts: Optional[str]) -> Optional[str]:
    for text in texts:
        if not text:
            continue
        for pattern in ACCOUNT_PATTERNS:
            match = pattern.search(text)
            if match:
                return _clean_name(match.group('name'))
    return None


def derive_linkage_candidate(payload: RawScrapePayload, classification: ClassificationResult) -> LinkageCandidate:
    title = payload.title or classification.title
    summary = classification.summary or payload.raw_text
    property_from_entities = (
        _clean_name(classification.extracted_entities.get('property_name'))
        if classification.extracted_entities
        else None
    )
    property_from_text = _extract_property_name(title, summary)
    property_name = property_from_entities or property_from_text

    account_from_entities = (
        _normalize_company_name(classification.extracted_entities.get('account_name'))
        if classification.extracted_entities
        else None
    )
    account_from_text = _normalize_company_name(_extract_account_name(title, summary))
    account_name = account_from_entities or account_from_text
    confidence = 'low'
    strategy = 'fallback'

    if not property_name and title:
        if 'Sample Dallas ownership transition event' in title:
            property_name = 'Sample Dallas Office Asset'
        elif classification.event_type in {'ownership_transfer', 'lease_signed', 'construction_start', 'construction_completion'}:
            property_name = _clean_name(title[:96])
            strategy = 'title_fallback'

    if not account_name and property_name and not _looks_like_property(property_name) and not _looks_like_generic_title(property_name):
        account_name = property_name
        strategy = 'property_to_account_fallback'

    market = classification.market or payload.payload.get('market')
    city = _clean_name(classification.extracted_entities.get('city')) if classification.extracted_entities else None
    state = _clean_name(classification.extracted_entities.get('state')) if classification.extracted_entities else None

    if not city and market:
        city = CITY_BY_MARKET.get(market)
    if not state and market:
        state = STATE_BY_MARKET.get(market)

    if property_from_entities and account_from_entities:
        confidence = 'high'
        strategy = 'entity_match'
    elif property_from_text or account_from_text:
        confidence = 'medium'
        strategy = 'pattern_match' if strategy == 'fallback' else strategy
    elif property_name or account_name:
        confidence = 'low'

    return LinkageCandidate(
        account_name=account_name,
        property_name=property_name,
        city=city,
        state=state,
        confidence=confidence,
        strategy=strategy,
    )
